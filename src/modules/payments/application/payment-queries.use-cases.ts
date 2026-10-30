import { Inject, Injectable } from '@nestjs/common';
import { Actor } from '../../../shared/domain/actor';
import { Clock, CLOCK } from '../../../shared/domain/clock';
import { Role } from '../../../shared/domain/role.enum';
import { BusinessRuleViolationError, EntityNotFoundError } from '../../../shared/domain/domain-errors';
import { merchantIdOf } from '../../../shared/application/merchant-scope';
import { Page, PageRequest } from '../../../shared/application/pagination';
import { CurrentMerchantReader } from '../../merchants/application/merchant-profile.use-cases';
import { Merchant } from '../../merchants/domain/merchant';
import {
  PAYMENT_REPORTS,
  PAYMENT_TRANSACTION_REPOSITORY,
  PaymentReports,
  PaymentSearch,
  PaymentTransactionRepository,
  PaymentView,
  SalesSummary,
} from '../domain/payment-transaction.repository';

// Payment history and sales figures. The portal methods are scoped to the caller's merchant;
// the *ForMerchant methods serve platform oversight, where an admin names the merchant
// (the ADMIN role is enforced by the platform controller). Both are read-only.
@Injectable()
export class PaymentQueries {
  constructor(
    @Inject(PAYMENT_TRANSACTION_REPOSITORY) private readonly payments: PaymentTransactionRepository,
    @Inject(PAYMENT_REPORTS) private readonly reports: PaymentReports,
    private readonly currentMerchant: CurrentMerchantReader,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  // Merchant sales staff see the payments they took; reviewers and the admin see all of them.
  search(actor: Actor, query: PaymentSearch, page: PageRequest): Promise<Page<PaymentView>> {
    const ownOnly = actor.role === Role.MERCHANT_SALES ? { cashierId: actor.userId } : {};
    return this.searchForMerchant(merchantIdOf(actor), { ...query, ...ownOnly }, page);
  }

  async get(actor: Actor, id: string): Promise<PaymentView> {
    const view = await this.getForMerchant(merchantIdOf(actor), id);
    if (actor.role === Role.MERCHANT_SALES && view.payment.cashierId !== actor.userId) {
      throw new EntityNotFoundError('Payment', id);
    }
    return view;
  }

  // Days are counted in the caller's time zone, so "today" matches the merchant's wall clock.
  async summary(actor: Actor, timeZone: string, days: number): Promise<SalesSummary> {
    return this.summaryForMerchant(await this.currentMerchant.get(actor), timeZone, days);
  }

  searchForMerchant(merchantId: string, query: PaymentSearch, page: PageRequest): Promise<Page<PaymentView>> {
    return this.payments.search(merchantId, query, page);
  }

  async getForMerchant(merchantId: string, id: string): Promise<PaymentView> {
    const view = await this.payments.view(merchantId, id);
    if (!view) throw new EntityNotFoundError('Payment', id);
    return view;
  }

  summaryForMerchant(merchant: Merchant, timeZone: string, days: number): Promise<SalesSummary> {
    if (!isValidTimeZone(timeZone)) throw new BusinessRuleViolationError('Unknown time zone');
    return this.reports.summary(merchant.id, merchant.currency, timeZone, days, this.clock.now());
  }
}

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone });
    return true;
  } catch {
    return false;
  }
}
