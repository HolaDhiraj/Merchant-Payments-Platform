import { Inject, Injectable } from '@nestjs/common';
import { Actor } from '../../../shared/domain/actor';
import { BusinessRuleViolationError, EntityNotFoundError } from '../../../shared/domain/domain-errors';
import { Page, PageRequest } from '../../../shared/application/pagination';
import { UNIT_OF_WORK, UnitOfWork } from '../../../shared/application/unit-of-work';
import { IssueTemporaryPasswordService } from '../../users/application/issue-temporary-password.service';
import { User } from '../../users/domain/user';
import { USER_REPOSITORY, UserRepository } from '../../users/domain/user.repository';
import { Merchant } from '../domain/merchant';
import { MERCHANT_REPOSITORY, MerchantRepository } from '../domain/merchant.repository';

export interface MerchantWithOwner {
  merchant: Merchant;
  owner: User | null;
}

// Platform admins browse onboarded merchants (ADMIN only, enforced at the controller).
@Injectable()
export class ListMerchantsUseCase {
  constructor(@Inject(MERCHANT_REPOSITORY) private readonly merchants: MerchantRepository) {}

  execute(query: { text?: string }, page: PageRequest): Promise<Page<Merchant>> {
    return this.merchants.search(query, page);
  }
}

// One merchant with its owner account, looked up by id or by the application it came from.
@Injectable()
export class GetMerchantUseCase {
  constructor(
    @Inject(MERCHANT_REPOSITORY) private readonly merchants: MerchantRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  async byId(id: string): Promise<MerchantWithOwner> {
    return this.withOwner(await this.merchants.findById(id), id);
  }

  async byApplicationId(applicationId: string): Promise<MerchantWithOwner> {
    return this.withOwner(await this.merchants.findByApplicationId(applicationId), applicationId);
  }

  private async withOwner(merchant: Merchant | null, lookup: string): Promise<MerchantWithOwner> {
    if (!merchant) throw new EntityNotFoundError('Merchant', lookup);
    const owner = merchant.ownerUserId ? await this.users.findById(merchant.ownerUserId) : null;
    return { merchant, owner };
  }
}

// Hands the owner a new one-time password, e.g. when the first one was lost.
@Injectable()
export class IssueOwnerPasswordUseCase {
  constructor(
    private readonly getMerchant: GetMerchantUseCase,
    private readonly temporaryPasswords: IssueTemporaryPasswordService,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  execute(actor: Actor, merchantId: string): Promise<{ owner: User; temporaryPassword: string }> {
    return this.unitOfWork.run(async () => {
      const { owner } = await this.getMerchant.byId(merchantId);
      if (!owner) throw new BusinessRuleViolationError('This merchant has no owner account');
      if (!owner.isActive) throw new BusinessRuleViolationError('The owner account is deactivated');
      const temporaryPassword = await this.temporaryPasswords.issue(actor, owner);
      return { owner, temporaryPassword };
    });
  }
}
