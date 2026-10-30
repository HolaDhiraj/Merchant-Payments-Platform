import { InvalidStateTransitionError } from '../../../shared/domain/domain-errors';
import { PaymentMethod } from '../../merchants/domain/payment-method.enum';
import { FraudDecision } from './fraud-screening';

export enum PaymentStatus {
  // Recorded and waiting for the processor's answer.
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  // Authorized, but held by fraud screening until a merchant reviewer approves or voids it.
  PENDING_REVIEW = 'PENDING_REVIEW',
  DECLINED = 'DECLINED',
  // Held payment rejected on review; the authorization was released.
  VOIDED = 'VOIDED',
}

export interface PaymentLine {
  readonly id: string;
  readonly productId: string | null;
  readonly name: string;
  readonly sku: string;
  readonly unitPriceMinor: number;
  readonly discountPercent: number;
  readonly quantity: number;
  readonly lineTotalMinor: number;
}

// What is known about the instrument. Never the card number, CVV, account number or PIN.
export interface InstrumentSummary {
  readonly brand: string | null;
  readonly last4: string | null;
  // Keyed HMAC of the card or account number: links attempts without storing the number.
  readonly fingerprint: string | null;
}

export interface FraudResult {
  readonly score: number;
  readonly reasons: string[];
  readonly decision: FraudDecision;
}

export interface PaymentTransactionProps {
  id: string;
  merchantId: string;
  reference: string;
  idempotencyKey: string;
  requestFingerprint: string;
  cashierId: string;
  customerId: string | null;
  method: PaymentMethod;
  status: PaymentStatus;
  currency: string;
  lines: PaymentLine[];
  subtotalMinor: number;
  discountMinor: number;
  pointsRedeemed: number;
  pointsDiscountMinor: number;
  totalMinor: number;
  amountTenderedMinor: number | null;
  changeMinor: number | null;
  pointsEarned: number;
  instrument: InstrumentSummary;
  authorizationCode: string | null;
  declineReason: string | null;
  fraud: FraudResult;
  reviewedById: string | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  completedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export type NewPaymentProps = Omit<
  PaymentTransactionProps,
  | 'status'
  | 'pointsEarned'
  | 'authorizationCode'
  | 'declineReason'
  | 'reviewedById'
  | 'reviewedAt'
  | 'reviewNote'
  | 'completedAt'
  | 'version'
  | 'updatedAt'
>;

// One checkout: the basket, the money breakdown, the instrument summary and the fraud result.
// State machine:
//   PROCESSING -> COMPLETED | PENDING_REVIEW | DECLINED
//   PENDING_REVIEW -> COMPLETED (approved) | VOIDED (rejected)
export class PaymentTransaction {
  private constructor(private props: PaymentTransactionProps) {}

  static start(props: NewPaymentProps): PaymentTransaction {
    return new PaymentTransaction({
      ...props,
      status: PaymentStatus.PROCESSING,
      pointsEarned: 0,
      authorizationCode: null,
      declineReason: null,
      reviewedById: null,
      reviewedAt: null,
      reviewNote: null,
      completedAt: null,
      version: 1,
      updatedAt: props.createdAt,
    });
  }

  static restore(props: PaymentTransactionProps): PaymentTransaction {
    return new PaymentTransaction(props);
  }

  get id(): string {
    return this.props.id;
  }
  get merchantId(): string {
    return this.props.merchantId;
  }
  get reference(): string {
    return this.props.reference;
  }
  get idempotencyKey(): string {
    return this.props.idempotencyKey;
  }
  get requestFingerprint(): string {
    return this.props.requestFingerprint;
  }
  get cashierId(): string {
    return this.props.cashierId;
  }
  get customerId(): string | null {
    return this.props.customerId;
  }
  get method(): PaymentMethod {
    return this.props.method;
  }
  get status(): PaymentStatus {
    return this.props.status;
  }
  get currency(): string {
    return this.props.currency;
  }
  get lines(): PaymentLine[] {
    return this.props.lines;
  }
  get subtotalMinor(): number {
    return this.props.subtotalMinor;
  }
  get discountMinor(): number {
    return this.props.discountMinor;
  }
  get pointsRedeemed(): number {
    return this.props.pointsRedeemed;
  }
  get pointsDiscountMinor(): number {
    return this.props.pointsDiscountMinor;
  }
  get totalMinor(): number {
    return this.props.totalMinor;
  }
  get amountTenderedMinor(): number | null {
    return this.props.amountTenderedMinor;
  }
  get changeMinor(): number | null {
    return this.props.changeMinor;
  }
  get pointsEarned(): number {
    return this.props.pointsEarned;
  }
  get instrument(): InstrumentSummary {
    return this.props.instrument;
  }
  get authorizationCode(): string | null {
    return this.props.authorizationCode;
  }
  get declineReason(): string | null {
    return this.props.declineReason;
  }
  get fraud(): FraudResult {
    return this.props.fraud;
  }
  get reviewedById(): string | null {
    return this.props.reviewedById;
  }
  get reviewedAt(): Date | null {
    return this.props.reviewedAt;
  }
  get reviewNote(): string | null {
    return this.props.reviewNote;
  }
  get completedAt(): Date | null {
    return this.props.completedAt;
  }
  get version(): number {
    return this.props.version;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // The processor (or the till, for cash) accepted the payment.
  authorize(authorizationCode: string, now: Date): void {
    this.assertStatus(PaymentStatus.PROCESSING, 'authorize');
    this.props.authorizationCode = authorizationCode;
    if (this.props.fraud.decision === FraudDecision.REVIEW) {
      this.props.status = PaymentStatus.PENDING_REVIEW;
    } else {
      this.props.status = PaymentStatus.COMPLETED;
      this.props.completedAt = now;
    }
    this.props.updatedAt = now;
  }

  decline(reason: string, now: Date): void {
    this.assertStatus(PaymentStatus.PROCESSING, 'decline');
    this.props.status = PaymentStatus.DECLINED;
    this.props.declineReason = reason;
    this.props.updatedAt = now;
  }

  approveReview(reviewerId: string, note: string | null, now: Date): void {
    this.assertStatus(PaymentStatus.PENDING_REVIEW, 'approve');
    this.props.status = PaymentStatus.COMPLETED;
    this.props.completedAt = now;
    this.recordReview(reviewerId, note, now);
  }

  rejectReview(reviewerId: string, note: string | null, now: Date): void {
    this.assertStatus(PaymentStatus.PENDING_REVIEW, 'void');
    this.props.status = PaymentStatus.VOIDED;
    this.recordReview(reviewerId, note, now);
  }

  awardPoints(points: number): void {
    this.props.pointsEarned = points;
  }

  syncVersion(version: number): void {
    this.props.version = version;
  }

  private recordReview(reviewerId: string, note: string | null, now: Date): void {
    this.props.reviewedById = reviewerId;
    this.props.reviewedAt = now;
    this.props.reviewNote = note?.trim() || null;
    this.props.updatedAt = now;
  }

  private assertStatus(expected: PaymentStatus, action: string): void {
    if (this.props.status !== expected) {
      throw new InvalidStateTransitionError(this.props.status, `${action} a payment`);
    }
  }
}
