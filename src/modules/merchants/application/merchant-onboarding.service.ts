import { Inject, Injectable } from '@nestjs/common';
import { Actor } from '../../../shared/domain/actor';
import { Clock, CLOCK } from '../../../shared/domain/clock';
import { DuplicateEntityError } from '../../../shared/domain/domain-errors';
import { IdGenerator, ID_GENERATOR } from '../../../shared/domain/id-generator';
import { Role } from '../../../shared/domain/role.enum';
import { UNIT_OF_WORK, UnitOfWork } from '../../../shared/application/unit-of-work';
import { generateTemporaryPassword } from '../../../shared/security/temporary-password';
import { AuditLogger } from '../../audit/application/audit-logger';
import { AuditAction } from '../../audit/domain/audit-action.enum';
import {
  MerchantOnboarding,
  OnboardingCredentials,
  OnboardingRequest,
} from '../../merchant-applications/domain/ports/merchant-onboarding';
import { CreateUserUseCase } from '../../users/application/create-user.use-case';
import { USER_REPOSITORY, UserRepository } from '../../users/domain/user.repository';
import { Merchant } from '../domain/merchant';
import { MERCHANT_REPOSITORY, MerchantRepository } from '../domain/merchant.repository';

// Opens the merchant and its owner account (MERCHANT_ADMIN, temporary password) for an
// approved application. Runs inside the caller's unit of work: if anything fails, the
// approval itself rolls back, so there is never an approved application half onboarded.
@Injectable()
export class MerchantOnboardingService implements MerchantOnboarding {
  constructor(
    @Inject(MERCHANT_REPOSITORY) private readonly merchants: MerchantRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly createUser: CreateUserUseCase,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly audit: AuditLogger,
  ) {}

  onboard(actor: Actor, request: OnboardingRequest): Promise<OnboardingCredentials> {
    return this.unitOfWork.run(async () => {
      if (await this.merchants.findByApplicationId(request.applicationId)) {
        throw new DuplicateEntityError('This application already has a merchant account');
      }
      if (await this.users.findByEmail(request.owner.email)) {
        throw new DuplicateEntityError(
          `${request.owner.email} already has an account; request a different owner email before approving`,
        );
      }

      const merchant = Merchant.open(
        {
          id: this.ids.next(),
          applicationId: request.applicationId,
          tradingName: request.tradingName,
          legalName: request.legalName,
          businessType: request.businessType,
          merchantCategoryCode: request.merchantCategoryCode,
          currency: request.currency,
          contactName: request.owner.fullName,
          contactEmail: request.owner.email,
          contactPhone: request.owner.phone,
        },
        this.clock.now(),
      );
      await this.merchants.insert(merchant);

      const temporaryPassword = generateTemporaryPassword();
      const owner = await this.createUser.execute(actor, {
        email: request.owner.email,
        fullName: request.owner.fullName,
        role: Role.MERCHANT_ADMIN,
        password: temporaryPassword,
        merchantId: merchant.id,
        mustChangePassword: true,
      });
      merchant.assignOwner(owner.id);
      await this.merchants.update(merchant);

      await this.audit.record({
        actor,
        action: AuditAction.MERCHANT_PROVISIONED,
        entityType: 'Merchant',
        entityId: merchant.id,
        metadata: { applicationId: request.applicationId, ownerUserId: owner.id },
      });

      return {
        merchantId: merchant.id,
        ownerUserId: owner.id,
        ownerEmail: owner.email,
        temporaryPassword,
      };
    });
  }
}
