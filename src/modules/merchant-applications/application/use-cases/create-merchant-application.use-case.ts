import { Inject, Injectable } from '@nestjs/common';
import { Actor } from '../../../../shared/domain/actor';
import { Clock, CLOCK } from '../../../../shared/domain/clock';
import { IdGenerator, ID_GENERATOR } from '../../../../shared/domain/id-generator';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/application/unit-of-work';
import { AuditLogger } from '../../../audit/application/audit-logger';
import { AuditAction } from '../../../audit/domain/audit-action.enum';
import { MerchantApplication } from '../../domain/model/merchant-application';
import {
  MERCHANT_APPLICATION_REPOSITORY,
  MerchantApplicationRepository,
} from '../../domain/ports/merchant-application.repository';
import { BusinessDetailsInput, toBusinessDetails } from '../services/business-details.input';

// Creates a new application in DRAFT, owned by the calling sales user (or admin).
@Injectable()
export class CreateMerchantApplicationUseCase {
  constructor(
    @Inject(MERCHANT_APPLICATION_REPOSITORY)
    private readonly applications: MerchantApplicationRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly audit: AuditLogger,
  ) {}

  async execute(actor: Actor, input: BusinessDetailsInput): Promise<MerchantApplication> {
    const application = MerchantApplication.create({
      id: this.ids.next(),
      createdById: actor.userId,
      details: toBusinessDetails(input),
      now: this.clock.now(),
    });

    await this.unitOfWork.run(async () => {
      await this.applications.insert(application);
      await this.audit.record({
        actor,
        action: AuditAction.APPLICATION_CREATED,
        entityType: 'MerchantApplication',
        entityId: application.id,
        metadata: { businessName: application.details.businessName, status: application.status },
      });
    });

    return application;
  }
}
