import { Inject, Injectable } from '@nestjs/common';
import { Actor } from '../../../../shared/domain/actor';
import { Clock, CLOCK } from '../../../../shared/domain/clock';
import { AccessDeniedError } from '../../../../shared/domain/domain-errors';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/application/unit-of-work';
import { AuditLogger } from '../../../audit/application/audit-logger';
import { AuditAction } from '../../../audit/domain/audit-action.enum';
import { MerchantApplication } from '../../domain/model/merchant-application';
import { ReviewDecision } from '../../domain/model/review-decision.enum';
import { MerchantApplicationAccessPolicy } from '../../domain/policies/merchant-application-access.policy';
import {
  MERCHANT_APPLICATION_REPOSITORY,
  MerchantApplicationRepository,
} from '../../domain/ports/merchant-application.repository';
import { MerchantApplicationReader } from '../services/merchant-application-reader';

export interface RecordDecisionCommand {
  decision: ReviewDecision;
  reason?: string | null;
}

// Records approve / reject / request-info. Only the assigned reviewer may do this.
@Injectable()
export class RecordReviewDecisionUseCase {
  constructor(
    private readonly reader: MerchantApplicationReader,
    @Inject(MERCHANT_APPLICATION_REPOSITORY)
    private readonly applications: MerchantApplicationRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(
    actor: Actor,
    applicationId: string,
    command: RecordDecisionCommand,
  ): Promise<MerchantApplication> {
    return this.unitOfWork.run(async () => {
      const application = await this.reader.getVisible(actor, applicationId);
      if (!MerchantApplicationAccessPolicy.canRecordDecision(actor, application)) {
        throw new AccessDeniedError('Only the assigned reviewer can record a decision');
      }

      const previousStatus = application.status;
      application.recordDecision(
        { reviewerId: actor.userId, decision: command.decision, reason: command.reason },
        this.clock.now(),
      );
      await this.applications.update(application);
      await this.audit.record({
        actor,
        action: AuditAction.REVIEW_DECISION_RECORDED,
        entityType: 'MerchantApplication',
        entityId: application.id,
        metadata: {
          decision: command.decision,
          fromStatus: previousStatus,
          toStatus: application.status,
          riskLevel: application.riskLevel,
          hasReason: Boolean(application.decisionReason),
        },
      });
      return application;
    });
  }
}
