import { Inject, Injectable } from '@nestjs/common';
import { Actor } from '../../../../shared/domain/actor';
import { Clock, CLOCK } from '../../../../shared/domain/clock';
import { AccessDeniedError } from '../../../../shared/domain/domain-errors';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/application/unit-of-work';
import { AuditLogger } from '../../../audit/application/audit-logger';
import { AuditAction } from '../../../audit/domain/audit-action.enum';
import { MerchantApplication } from '../../domain/model/merchant-application';
import { MerchantApplicationAccessPolicy } from '../../domain/policies/merchant-application-access.policy';
import {
  MERCHANT_APPLICATION_REPOSITORY,
  MerchantApplicationRepository,
} from '../../domain/ports/merchant-application.repository';
import { MerchantApplicationReader } from '../services/merchant-application-reader';
import { RiskReviewScheduler } from '../services/risk-review-scheduler';

// Operational recovery: re-queues a risk review that failed permanently (all retries exhausted).
// The new request goes through the outbox in the same transaction as the state change.
@Injectable()
export class RetryRiskReviewUseCase {
  constructor(
    private readonly reader: MerchantApplicationReader,
    @Inject(MERCHANT_APPLICATION_REPOSITORY)
    private readonly applications: MerchantApplicationRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly audit: AuditLogger,
    private readonly scheduler: RiskReviewScheduler,
  ) {}

  async execute(actor: Actor, applicationId: string): Promise<MerchantApplication> {
    if (!MerchantApplicationAccessPolicy.canRetryRiskReview(actor)) {
      throw new AccessDeniedError('Only an admin can retry a risk review');
    }

    return this.unitOfWork.run(async () => {
      const application = await this.reader.getVisible(actor, applicationId);
      const submissionNumber = application.restartRiskReview(this.clock.now());
      await this.applications.update(application);
      await this.audit.record({
        actor,
        action: AuditAction.RISK_REVIEW_RETRIED,
        entityType: 'MerchantApplication',
        entityId: application.id,
        metadata: { submissionNumber },
      });
      await this.scheduler.schedule(application.id, submissionNumber);
      return application;
    });
  }
}
