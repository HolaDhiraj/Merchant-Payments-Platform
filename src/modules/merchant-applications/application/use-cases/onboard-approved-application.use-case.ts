import { Inject, Injectable } from '@nestjs/common';
import { Actor } from '../../../../shared/domain/actor';
import { BusinessRuleViolationError } from '../../../../shared/domain/domain-errors';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/application/unit-of-work';
import { ApplicationStatus } from '../../domain/model/application-status.enum';
import {
  MERCHANT_ONBOARDING,
  MerchantOnboarding,
  OnboardingCredentials,
} from '../../domain/ports/merchant-onboarding';
import { MerchantApplicationReader } from '../services/merchant-application-reader';
import { toOnboardingRequest } from '../services/onboarding-request';

// Opens the merchant account for an application approved before automatic onboarding existed
// (ADMIN only, enforced at the controller). Fails if the merchant already exists.
@Injectable()
export class OnboardApprovedApplicationUseCase {
  constructor(
    private readonly reader: MerchantApplicationReader,
    @Inject(MERCHANT_ONBOARDING) private readonly onboarding: MerchantOnboarding,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  execute(actor: Actor, applicationId: string): Promise<OnboardingCredentials> {
    return this.unitOfWork.run(async () => {
      const application = await this.reader.getVisible(actor, applicationId);
      if (application.status !== ApplicationStatus.APPROVED) {
        throw new BusinessRuleViolationError('Only approved applications can be onboarded');
      }
      return this.onboarding.onboard(actor, toOnboardingRequest(application));
    });
  }
}
