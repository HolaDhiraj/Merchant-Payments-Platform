import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash, randomInt } from 'crypto';
import { Actor } from '../../../shared/domain/actor';
import { Clock, CLOCK } from '../../../shared/domain/clock';
import {
  BusinessRuleViolationError,
  DuplicateEntityError,
  IdempotencyKeyReusedError,
} from '../../../shared/domain/domain-errors';
import { IdGenerator, ID_GENERATOR } from '../../../shared/domain/id-generator';
import { UNIT_OF_WORK, UnitOfWork } from '../../../shared/application/unit-of-work';
import { CatalogPricing } from '../../catalog/application/catalog.use-cases';
import { LoyaltyAccounts } from '../../customers/application/customer.use-cases';
import { Customer } from '../../customers/domain/customer';
import { redemptionValue } from '../../customers/domain/loyalty';
import { CurrentMerchantReader } from '../../merchants/application/merchant-profile.use-cases';
import { Merchant } from '../../merchants/domain/merchant';
import { PaymentMethod } from '../../merchants/domain/payment-method.enum';
import { CardDetails, validateCard } from '../domain/card';
import { FraudDecision, screenPayment } from '../domain/fraud-screening';
import {
  ChargeInstrument,
  ChargeResult,
  INSTRUMENT_FINGERPRINTER,
  InstrumentFingerprinter,
  PAYMENT_PROCESSOR,
  PaymentProcessor,
} from '../domain/payment-processor';
import {
  InstrumentSummary,
  PaymentLine,
  PaymentStatus,
  PaymentTransaction,
} from '../domain/payment-transaction';
import {
  PAYMENT_TRANSACTION_REPOSITORY,
  PaymentTransactionRepository,
} from '../domain/payment-transaction.repository';
import { PaymentSettlement } from './payment-settlement.service';

export interface CheckoutCommand {
  items: Array<{ productId: string; quantity: number }>;
  method: PaymentMethod;
  // Required for cash. A returning customer is found by phone; a new one also needs a name.
  customer?: { phone: string; fullName?: string; email?: string | null } | null;
  pointsToRedeem?: number;
  cashTenderedMinor?: number;
  card?: CardDetails;
  bankTransfer?: { accountNumber: string; pin: string };
}

export interface CheckoutResult {
  payment: PaymentTransaction;
  // True when this Idempotency-Key was already processed and the stored result is returned.
  replayed: boolean;
}

// Instrument data that lives only for this request: what to charge, and what may be stored.
interface PreparedInstrument {
  summary: InstrumentSummary;
  charge: ChargeInstrument | null;
}

const REFERENCE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const MAX_QUANTITY = 999;

// Takes a payment at the merchant's till.
//
// Three phases, so no database transaction is held open while the processor is called:
//   1. record (transaction): price the basket from the catalogue, attach the customer, reserve
//      points, screen for fraud and store the payment as PROCESSING (or DECLINED if blocked);
//   2. charge (no transaction): call the processor with the payment id as idempotency key;
//   3. settle (transaction): complete, hold for review, or decline and give the points back.
//
// The client's Idempotency-Key makes the whole call safe to retry: the same key returns the
// stored result instead of charging again, and the database enforces one payment per key.
@Injectable()
export class CheckoutUseCase {
  private readonly logger = new Logger(CheckoutUseCase.name);

  constructor(
    private readonly currentMerchant: CurrentMerchantReader,
    private readonly pricing: CatalogPricing,
    private readonly loyalty: LoyaltyAccounts,
    private readonly settlement: PaymentSettlement,
    @Inject(PAYMENT_TRANSACTION_REPOSITORY) private readonly payments: PaymentTransactionRepository,
    @Inject(PAYMENT_PROCESSOR) private readonly processor: PaymentProcessor,
    @Inject(INSTRUMENT_FINGERPRINTER) private readonly fingerprints: InstrumentFingerprinter,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(actor: Actor, command: CheckoutCommand, idempotencyKey: string): Promise<CheckoutResult> {
    const merchant = await this.currentMerchant.get(actor);
    this.assertMethodAccepted(merchant, command.method);

    const instrument = this.prepareInstrument(command);
    const requestFingerprint = this.requestFingerprint(command, instrument.summary);

    const existing = await this.payments.findByIdempotencyKey(merchant.id, idempotencyKey);
    if (existing) return this.replay(existing, requestFingerprint);

    let payment: PaymentTransaction;
    try {
      payment = await this.unitOfWork.run(() =>
        this.record(actor, merchant, command, instrument.summary, idempotencyKey, requestFingerprint),
      );
    } catch (error) {
      // Two identical requests raced: the unique key let only one in; return its result.
      if (error instanceof DuplicateEntityError) {
        const winner = await this.payments.findByIdempotencyKey(merchant.id, idempotencyKey);
        if (winner) return this.replay(winner, requestFingerprint);
      }
      throw error;
    }
    if (payment.status !== PaymentStatus.PROCESSING) {
      return { payment, replayed: false };
    }

    const result = await this.charge(payment, instrument, command);
    const settled = await this.unitOfWork.run(() => this.settle(merchant, payment.id, result));
    return { payment: settled, replayed: false };
  }

  private assertMethodAccepted(merchant: Merchant, method: PaymentMethod): void {
    if (method === PaymentMethod.QR) {
      throw new BusinessRuleViolationError('QR payments are coming soon; choose another method');
    }
    if (!merchant.accepts(method)) {
      throw new BusinessRuleViolationError('This payment method is switched off in your settings');
    }
  }

  private prepareInstrument(command: CheckoutCommand): PreparedInstrument {
    switch (command.method) {
      case PaymentMethod.CARD: {
        if (!command.card) throw new BusinessRuleViolationError('Enter the card details');
        const { number, brand } = validateCard(command.card, this.clock.now());
        return {
          summary: { brand, last4: number.slice(-4), fingerprint: this.fingerprints.fingerprint('card', number) },
          charge: { method: 'CARD', card: { ...command.card, number } },
        };
      }
      case PaymentMethod.BANK_TRANSFER: {
        const bank = command.bankTransfer;
        if (!bank) throw new BusinessRuleViolationError('Enter the bank account and PIN');
        const accountNumber = bank.accountNumber.replace(/[\s-]/g, '');
        if (!/^\d{6,20}$/.test(accountNumber)) {
          throw new BusinessRuleViolationError('The account number must be 6-20 digits');
        }
        if (!/^\d{4,6}$/.test(bank.pin)) throw new BusinessRuleViolationError('The PIN must be 4-6 digits');
        return {
          summary: {
            brand: 'BANK',
            last4: accountNumber.slice(-4),
            fingerprint: this.fingerprints.fingerprint('account', accountNumber),
          },
          charge: { method: 'BANK_TRANSFER', bank: { accountNumber, pin: bank.pin } },
        };
      }
      default:
        return { summary: { brand: null, last4: null, fingerprint: null }, charge: null };
    }
  }

  // Phase 1, inside a transaction.
  private async record(
    actor: Actor,
    merchant: Merchant,
    command: CheckoutCommand,
    instrument: InstrumentSummary,
    idempotencyKey: string,
    requestFingerprint: string,
  ): Promise<PaymentTransaction> {
    const now = this.clock.now();
    const lines = await this.priceBasket(merchant.id, command.items);
    const subtotalMinor = lines.reduce((sum, line) => sum + line.unitPriceMinor * line.quantity, 0);
    const discountMinor = subtotalMinor - lines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
    const afterDiscountMinor = subtotalMinor - discountMinor;

    const customer = await this.resolveCustomer(merchant.id, command);
    if (command.method === PaymentMethod.CASH && !customer) {
      throw new BusinessRuleViolationError("Cash payments need the customer's name and phone number");
    }

    const pointsRedeemed = command.pointsToRedeem ?? 0;
    if (pointsRedeemed > 0 && !customer) {
      throw new BusinessRuleViolationError('Add the customer to use their points');
    }
    const pointsDiscountMinor = redemptionValue(
      merchant.loyalty,
      pointsRedeemed,
      customer?.pointsBalance ?? 0,
      afterDiscountMinor,
    );
    const totalMinor = afterDiscountMinor - pointsDiscountMinor;
    if (totalMinor <= 0) {
      throw new BusinessRuleViolationError('The amount to pay must be more than zero');
    }

    let changeMinor: number | null = null;
    if (command.method === PaymentMethod.CASH) {
      const tendered = command.cashTenderedMinor ?? 0;
      if (tendered < totalMinor) {
        throw new BusinessRuleViolationError('The cash received is less than the amount to pay');
      }
      changeMinor = tendered - totalMinor;
    }

    const activity = await this.payments.recentActivity({
      merchantId: merchant.id,
      instrumentFingerprint: instrument.fingerprint,
      customerId: customer?.id ?? null,
      now,
    });
    const fraud = screenPayment({
      method: command.method,
      amountMinor: totalMinor,
      highValueThresholdMinor: merchant.highValueThresholdMinor,
      ...activity,
      isNewCustomer: customer ? customer.visitCount === 0 : null,
    });

    const payment = PaymentTransaction.start({
      id: this.ids.next(),
      merchantId: merchant.id,
      reference: this.newReference(now),
      idempotencyKey,
      requestFingerprint,
      cashierId: actor.userId,
      customerId: customer?.id ?? null,
      method: command.method,
      currency: merchant.currency,
      lines,
      subtotalMinor,
      discountMinor,
      pointsRedeemed,
      pointsDiscountMinor,
      totalMinor,
      amountTenderedMinor: command.method === PaymentMethod.CASH ? (command.cashTenderedMinor ?? null) : null,
      changeMinor,
      instrument,
      fraud,
      createdAt: now,
    });

    if (fraud.decision === FraudDecision.BLOCK) {
      payment.decline(`Blocked by fraud screening (score ${fraud.score})`, now);
      await this.payments.insert(payment);
      return payment;
    }

    await this.payments.insert(payment);
    // Reserve the points now; they are given back if the payment does not go through.
    if (customer && pointsRedeemed > 0) {
      await this.loyalty.redeem(customer, pointsRedeemed, payment.id);
    }
    return payment;
  }

  // Phase 2, outside any transaction.
  private async charge(
    payment: PaymentTransaction,
    instrument: PreparedInstrument,
    command: CheckoutCommand,
  ): Promise<ChargeResult> {
    if (command.method === PaymentMethod.CASH || !instrument.charge) {
      return { approved: true, authorizationCode: `CASH-${payment.reference}` };
    }
    try {
      return await this.processor.charge({
        ...instrument.charge,
        idempotencyKey: payment.id,
        amountMinor: payment.totalMinor,
        currency: payment.currency,
      });
    } catch (error) {
      // Only the error type is logged: the request holds card / PIN data.
      this.logger.error(`Processor error for payment ${payment.id}: ${(error as Error).name}`);
      return { approved: false, declineReason: 'The payment processor did not respond; nothing was charged' };
    }
  }

  // Phase 3, inside a transaction.
  private async settle(merchant: Merchant, paymentId: string, result: ChargeResult): Promise<PaymentTransaction> {
    const payment = await this.payments.findById(merchant.id, paymentId);
    if (!payment) throw new Error(`Payment ${paymentId} disappeared during checkout`);
    const now = this.clock.now();
    if (result.approved) {
      payment.authorize(result.authorizationCode, now);
      await this.settlement.completed(payment, merchant);
    } else {
      payment.decline(result.declineReason, now);
      await this.settlement.cancelled(payment);
    }
    await this.payments.update(payment);
    return payment;
  }

  // Prices always come from the catalogue, never from the client. Repeated products are merged.
  private async priceBasket(
    merchantId: string,
    items: CheckoutCommand['items'],
  ): Promise<PaymentLine[]> {
    if (items.length === 0) throw new BusinessRuleViolationError('Add at least one product');
    const quantities = new Map<string, number>();
    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        throw new BusinessRuleViolationError('Quantities must be whole numbers of at least 1');
      }
      quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
    }
    if ([...quantities.values()].some((quantity) => quantity > MAX_QUANTITY)) {
      throw new BusinessRuleViolationError(`At most ${MAX_QUANTITY} of one product per payment`);
    }

    const priced = await this.pricing.priceForSale(merchantId, [...quantities.keys()]);
    return [...quantities.entries()].map(([productId, quantity]) => {
      const { product, price } = priced.get(productId)!;
      return {
        id: this.ids.next(),
        productId,
        name: product.name,
        sku: product.sku,
        unitPriceMinor: price.listPriceMinor,
        discountPercent: price.discountPercent,
        quantity,
        lineTotalMinor: price.finalPriceMinor * quantity,
      };
    });
  }

  private async resolveCustomer(merchantId: string, command: CheckoutCommand): Promise<Customer | null> {
    if (!command.customer?.phone) return null;
    return this.loyalty.findOrRegister(merchantId, {
      phone: command.customer.phone,
      fullName: command.customer.fullName ?? '',
      email: command.customer.email,
    });
  }

  private replay(existing: PaymentTransaction, requestFingerprint: string): CheckoutResult {
    if (existing.requestFingerprint !== requestFingerprint) throw new IdempotencyKeyReusedError();
    return { payment: existing, replayed: true };
  }

  // Identifies the request's content for idempotent replays. Built only from non-secret data:
  // the instrument appears as its keyed fingerprint, never as the raw number, CVV or PIN.
  private requestFingerprint(command: CheckoutCommand, instrument: InstrumentSummary): string {
    const canonical = JSON.stringify({
      items: [...command.items]
        .map((item) => [item.productId, item.quantity])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
      method: command.method,
      customer: command.customer?.phone?.replace(/[\s()-]/g, '') ?? null,
      points: command.pointsToRedeem ?? 0,
      tendered: command.cashTenderedMinor ?? null,
      instrument: instrument.fingerprint,
    });
    return createHash('sha256').update(canonical).digest('hex');
  }

  // Human-friendly receipt number, e.g. PAY-261030-K7QM2X (unique per merchant, enforced in SQL).
  private newReference(now: Date): string {
    const date = now.toISOString().slice(2, 10).replace(/-/g, '');
    const suffix = Array.from({ length: 6 }, () => REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)]).join('');
    return `PAY-${date}-${suffix}`;
  }
}
