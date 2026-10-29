import { Inject, Injectable } from '@nestjs/common';
import { Actor } from '../../../../shared/domain/actor';
import { Clock, CLOCK } from '../../../../shared/domain/clock';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/application/unit-of-work';
import { AuditLogger } from '../../../audit/application/audit-logger';
import { AuditAction } from '../../../audit/domain/audit-action.enum';
import { MerchantApplication } from '../../domain/model/merchant-application';
import {
  MERCHANT_APPLICATION_REPOSITORY,
  MerchantApplicationRepository,
} from '../../domain/ports/merchant-application.repository';
import { MerchantApplicationReader } from '../services/merchant-application-reader';
import { RiskReviewScheduler } from '../services/risk-review-scheduler';

// Submits (or re-submits) an application. State change, audit entry and the outbox message that
// requests the asynchronous risk review are committed in one transaction.
@Injectable()
export class SubmitMerchantApplicationUseCase {
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
    return this.unitOfWork.run(async () => {
      const application = await this.reader.getEditable(actor, applicationId);
      const submissionNumber = application.submit(this.clock.now());
      await this.applications.update(application);
      await this.audit.record({
        actor,
        action: AuditAction.APPLICATION_SUBMITTED,
        entityType: 'MerchantApplication',
        entityId: application.id,
        metadata: { submissionNumber },
      });
      await this.scheduler.schedule(application.id, submissionNumber);
      return application;
    });
  }
}
