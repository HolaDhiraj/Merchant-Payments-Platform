import { Inject, Injectable } from '@nestjs/common';
import { Clock, CLOCK } from '../../../../shared/domain/clock';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/application/unit-of-work';
import { AuditLogger } from '../../../audit/application/audit-logger';
import { AuditAction } from '../../../audit/domain/audit-action.enum';
import { RiskAssessment } from '../../domain/model/risk-assessment';
import {
  MERCHANT_APPLICATION_REPOSITORY,
  MerchantApplicationRepository,
} from '../../domain/ports/merchant-application.repository';
import {
  RISK_ASSESSMENT_REPOSITORY,
  RiskAssessmentRepository,
} from '../../domain/ports/risk-assessment.repository';

export enum RiskResultOutcome {
  APPLIED = 'APPLIED',
  APPLICATION_NOT_FOUND = 'APPLICATION_NOT_FOUND',
  ALREADY_PROCESSED = 'ALREADY_PROCESSED',
}

// Where a risk result came from: our worker calling the vendor, or the vendor calling our webhook.
export type RiskResultSource = 'WORKER' | 'WEBHOOK';

// Applies a risk result to its application exactly once, whichever channel delivered it.
// Assessment row, state change and audit entry are written in one transaction.
// Duplicates are detected without raising database errors, so this can join a caller's transaction.
@Injectable()
export class RiskAssessmentRecorder {
  constructor(
    @Inject(MERCHANT_APPLICATION_REPOSITORY)
    private readonly applications: MerchantApplicationRepository,
    @Inject(RISK_ASSESSMENT_REPOSITORY)
    private readonly assessments: RiskAssessmentRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  record(assessment: RiskAssessment, source: RiskResultSource): Promise<RiskResultOutcome> {
    return this.unitOfWork.run(async () => {
      const application = await this.applications.findById(assessment.applicationId);
      if (!application) {
        return RiskResultOutcome.APPLICATION_NOT_FOUND;
      }
      if (!application.isAwaitingRiskReview(assessment.submissionNumber)) {
        return RiskResultOutcome.ALREADY_PROCESSED;
      }
      if (!(await this.assessments.insertIfAbsent(assessment))) {
        return RiskResultOutcome.ALREADY_PROCESSED;
      }

      application.completeRiskReview(
        {
          submissionNumber: assessment.submissionNumber,
          level: assessment.level,
          score: assessment.score,
        },
        this.clock.now(),
      );
      // Optimistic locking: a concurrent change raises ConcurrencyConflictError and rolls back.
      await this.applications.update(application);
      await this.audit.record({
        actor: null,
        action: AuditAction.RISK_REVIEW_COMPLETED,
        entityType: 'MerchantApplication',
        entityId: application.id,
        metadata: {
          source,
          submissionNumber: assessment.submissionNumber,
          riskLevel: assessment.level,
          riskScore: assessment.score,
          providerReference: assessment.providerReference,
        },
      });
      return RiskResultOutcome.APPLIED;
    });
  }
}
