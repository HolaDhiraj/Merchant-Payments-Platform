import { Inject, Injectable } from '@nestjs/common';
import { Clock, CLOCK } from '../../../../shared/domain/clock';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/application/unit-of-work';
import { AuditLogger } from '../../../audit/application/audit-logger';
import { AuditAction } from '../../../audit/domain/audit-action.enum';
import {
  MERCHANT_APPLICATION_REPOSITORY,
  MerchantApplicationRepository,
} from '../../domain/ports/merchant-application.repository';
import { RiskReviewJob } from '../../domain/ports/risk-review-queue';

// Called once all retries are exhausted (or on a permanent provider error).
// Moves the risk status to FAILED so the application is visibly stuck instead of silently pending.
@Injectable()
export class MarkRiskReviewFailedUseCase {
  constructor(
    @Inject(MERCHANT_APPLICATION_REPOSITORY)
    private readonly applications: MerchantApplicationRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(job: RiskReviewJob, failureReason: string, attempts: number): Promise<boolean> {
    return this.unitOfWork.run(async () => {
      const application = await this.applications.findById(job.applicationId);
      if (!application || !application.failRiskReview(job.submissionNumber, this.clock.now())) {
        return false;
      }
      await this.applications.update(application);
      await this.audit.record({
        actor: null,
        action: AuditAction.RISK_REVIEW_FAILED,
        entityType: 'MerchantApplication',
        entityId: application.id,
        // Only a short, non-sensitive reason is stored, never provider payloads.
        metadata: {
          submissionNumber: job.submissionNumber,
          attempts,
          reason: failureReason.slice(0, 200),
        },
      });
      return true;
    });
  }
}
