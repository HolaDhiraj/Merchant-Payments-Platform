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
import {
  BusinessDetailsChanges,
  changedFieldNames,
  toBusinessDetailsChanges,
} from '../services/business-details.input';

// Partially updates application data while it is still editable (DRAFT / INFO_REQUESTED).
@Injectable()
export class UpdateMerchantApplicationUseCase {
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
    changes: BusinessDetailsChanges,
  ): Promise<MerchantApplication> {
    return this.unitOfWork.run(async () => {
      const application = await this.reader.getEditable(actor, applicationId);
      application.updateDetails(toBusinessDetailsChanges(changes), this.clock.now());
      await this.applications.update(application);
      await this.audit.record({
        actor,
        action: AuditAction.APPLICATION_UPDATED,
        entityType: 'MerchantApplication',
        entityId: application.id,
        metadata: { changedFields: changedFieldNames(changes) },
      });
      return application;
    });
  }
}
