import { Inject, Injectable } from '@nestjs/common';
import { Actor } from '../../../shared/domain/actor';
import { Clock, CLOCK } from '../../../shared/domain/clock';
import { BusinessRuleViolationError, EntityNotFoundError } from '../../../shared/domain/domain-errors';
import { IdGenerator, ID_GENERATOR } from '../../../shared/domain/id-generator';
import { merchantIdOf } from '../../../shared/application/merchant-scope';
import { Page, PageRequest } from '../../../shared/application/pagination';
import { Customer, LoyaltyEntry, LoyaltyEntryType, normalisePhone } from '../domain/customer';
import { CUSTOMER_REPOSITORY, CustomerRepository } from '../domain/customer.repository';

export interface CustomerDetails {
  fullName: string;
  phone: string;
  email?: string | null;
}

// Customer records and point balances as used by checkout. Join the caller's unit of work.
@Injectable()
export class LoyaltyAccounts {
  constructor(
    @Inject(CUSTOMER_REPOSITORY) private readonly customers: CustomerRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  find(merchantId: string, id: string): Promise<Customer | null> {
    return this.customers.findById(merchantId, id);
  }

  async register(merchantId: string, details: CustomerDetails): Promise<Customer> {
    const fullName = details.fullName.trim();
    if (fullName.length < 2) throw new BusinessRuleViolationError("Enter the customer's name");
    const customer: Customer = {
      id: this.ids.next(),
      merchantId,
      fullName,
      phone: normalisePhone(details.phone),
      email: details.email?.trim().toLowerCase() || null,
      pointsBalance: 0,
      totalSpentMinor: 0,
      visitCount: 0,
      lastPurchaseAt: null,
      createdAt: this.clock.now(),
    };
    await this.customers.insert(customer);
    return customer;
  }

  // Returning customers are matched by phone; new numbers are registered on the spot.
  async findOrRegister(merchantId: string, details: CustomerDetails): Promise<Customer> {
    const existing = await this.customers.findByPhone(merchantId, normalisePhone(details.phone));
    return existing ?? this.register(merchantId, details);
  }

  async redeem(customer: Customer, points: number, transactionId: string): Promise<void> {
    if (points <= 0) return;
    const balance = await this.customers.deductPoints(customer.merchantId, customer.id, points);
    if (balance === null) {
      throw new BusinessRuleViolationError('The customer no longer has enough points');
    }
    await this.ledgerEntry(customer, LoyaltyEntryType.REDEEM, -points, balance, transactionId);
  }

  async earn(customer: Customer, points: number, transactionId: string): Promise<void> {
    if (points <= 0) return;
    const balance = await this.customers.addPoints(customer.merchantId, customer.id, points);
    await this.ledgerEntry(customer, LoyaltyEntryType.EARN, points, balance, transactionId);
  }

  async restore(customer: Customer, points: number, transactionId: string): Promise<void> {
    if (points <= 0) return;
    const balance = await this.customers.addPoints(customer.merchantId, customer.id, points);
    await this.ledgerEntry(customer, LoyaltyEntryType.RESTORE, points, balance, transactionId);
  }

  recordPurchase(customer: Customer, paidMinor: number): Promise<void> {
    return this.customers.recordPurchase(customer.merchantId, customer.id, paidMinor, this.clock.now());
  }

  private ledgerEntry(
    customer: Customer,
    type: LoyaltyEntryType,
    points: number,
    balanceAfter: number,
    transactionId: string,
  ): Promise<void> {
    return this.customers.appendLedger({
      id: this.ids.next(),
      merchantId: customer.merchantId,
      customerId: customer.id,
      transactionId,
      type,
      points,
      balanceAfter,
      createdAt: this.clock.now(),
    });
  }
}

// Customer screens of the merchant portal (any merchant role), scoped to the caller's merchant,
// plus read-only *ForMerchant methods for platform oversight.
@Injectable()
export class CustomerUseCases {
  constructor(
    @Inject(CUSTOMER_REPOSITORY) private readonly customers: CustomerRepository,
    private readonly accounts: LoyaltyAccounts,
  ) {}

  search(actor: Actor, text: string | undefined, page: PageRequest): Promise<Page<Customer>> {
    return this.searchForMerchant(merchantIdOf(actor), text, page);
  }

  get(actor: Actor, id: string): Promise<Customer> {
    return this.getForMerchant(merchantIdOf(actor), id);
  }

  // The till's "returning customer?" check. null when the number is new.
  findByPhone(actor: Actor, phone: string): Promise<Customer | null> {
    return this.customers.findByPhone(merchantIdOf(actor), normalisePhone(phone));
  }

  ledger(actor: Actor, id: string, page: PageRequest): Promise<Page<LoyaltyEntry>> {
    return this.ledgerForMerchant(merchantIdOf(actor), id, page);
  }

  create(actor: Actor, details: CustomerDetails): Promise<Customer> {
    return this.accounts.register(merchantIdOf(actor), details);
  }

  async update(actor: Actor, id: string, changes: { fullName?: string; email?: string | null }): Promise<Customer> {
    const customer = await this.get(actor, id);
    await this.customers.updateProfile(customer.merchantId, customer.id, {
      ...(changes.fullName !== undefined && { fullName: changes.fullName.trim() }),
      ...(changes.email !== undefined && { email: changes.email?.trim().toLowerCase() || null }),
    });
    return this.get(actor, id);
  }

  // Platform oversight (a platform admin names the merchant; read-only).
  searchForMerchant(merchantId: string, text: string | undefined, page: PageRequest): Promise<Page<Customer>> {
    return this.customers.search(merchantId, text?.trim() || undefined, page);
  }

  async getForMerchant(merchantId: string, id: string): Promise<Customer> {
    const customer = await this.customers.findById(merchantId, id);
    if (!customer) throw new EntityNotFoundError('Customer', id);
    return customer;
  }

  ledgerForMerchant(merchantId: string, id: string, page: PageRequest): Promise<Page<LoyaltyEntry>> {
    return this.customers.ledger(merchantId, id, page);
  }
}
