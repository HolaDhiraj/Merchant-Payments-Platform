import { BusinessRuleViolationError } from '../../../shared/domain/domain-errors';
import { BusinessType } from '../../merchant-applications/domain/model/business-details';
import { PaymentMethod } from './payment-method.enum';

export enum MerchantStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export interface AcceptedMethods {
  readonly cash: boolean;
  readonly card: boolean;
  readonly bankTransfer: boolean;
}

// Where the merchant's money is paid out. The account number is held only as ciphertext.
export interface SettlementAccount {
  readonly bankName: string;
  readonly accountHolder: string;
  readonly accountNumberEncrypted: string;
  readonly accountLast4: string;
}

// Customers earn 1 point per `earnUnitMinor` spent; 1 point is worth `pointValueMinor`
// at checkout, and points can pay for at most `maxRedeemPercent` of an order.
export interface LoyaltySettings {
  readonly enabled: boolean;
  readonly earnUnitMinor: number;
  readonly pointValueMinor: number;
  readonly maxRedeemPercent: number;
}

export interface MerchantProps {
  id: string;
  applicationId: string;
  ownerUserId: string | null;
  tradingName: string;
  legalName: string;
  businessType: BusinessType;
  merchantCategoryCode: string;
  currency: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  status: MerchantStatus;
  acceptedMethods: AcceptedMethods;
  settlement: SettlementAccount | null;
  // Payments at or above this amount get extra fraud scrutiny.
  highValueThresholdMinor: number;
  loyalty: LoyaltySettings;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export type NewMerchantProps = Pick<
  MerchantProps,
  | 'id'
  | 'applicationId'
  | 'tradingName'
  | 'legalName'
  | 'businessType'
  | 'merchantCategoryCode'
  | 'currency'
  | 'contactName'
  | 'contactEmail'
  | 'contactPhone'
>;

export interface MerchantSettingsChanges {
  contactPhone?: string;
  acceptedMethods?: Partial<AcceptedMethods>;
  highValueThresholdMinor?: number;
  loyalty?: Partial<LoyaltySettings>;
}

// Defaults in minor units: high value from 5,000.00; 1 point per 100.00 spent; 1 point = 1.00.
export const DEFAULT_HIGH_VALUE_THRESHOLD_MINOR = 500_000;
export const DEFAULT_LOYALTY: LoyaltySettings = {
  enabled: true,
  earnUnitMinor: 10_000,
  pointValueMinor: 100,
  maxRedeemPercent: 50,
};

const MAX_MONEY_MINOR = 100_000_000_000;

// A business onboarded from an approved application. Owns its payment acceptance,
// settlement and loyalty configuration; its users, catalogue and payments reference it.
export class Merchant {
  private constructor(private props: MerchantProps) {}

  static open(props: NewMerchantProps, now: Date): Merchant {
    return new Merchant({
      ...props,
      contactEmail: props.contactEmail.trim().toLowerCase(),
      currency: props.currency.toUpperCase(),
      ownerUserId: null,
      status: MerchantStatus.ACTIVE,
      acceptedMethods: { cash: true, card: true, bankTransfer: true },
      settlement: null,
      highValueThresholdMinor: DEFAULT_HIGH_VALUE_THRESHOLD_MINOR,
      loyalty: DEFAULT_LOYALTY,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: MerchantProps): Merchant {
    return new Merchant(props);
  }

  get id(): string {
    return this.props.id;
  }
  get applicationId(): string {
    return this.props.applicationId;
  }
  get ownerUserId(): string | null {
    return this.props.ownerUserId;
  }
  get tradingName(): string {
    return this.props.tradingName;
  }
  get legalName(): string {
    return this.props.legalName;
  }
  get businessType(): BusinessType {
    return this.props.businessType;
  }
  get merchantCategoryCode(): string {
    return this.props.merchantCategoryCode;
  }
  get currency(): string {
    return this.props.currency;
  }
  get contactName(): string {
    return this.props.contactName;
  }
  get contactEmail(): string {
    return this.props.contactEmail;
  }
  get contactPhone(): string {
    return this.props.contactPhone;
  }
  get status(): MerchantStatus {
    return this.props.status;
  }
  get acceptedMethods(): AcceptedMethods {
    return this.props.acceptedMethods;
  }
  get settlement(): SettlementAccount | null {
    return this.props.settlement;
  }
  get highValueThresholdMinor(): number {
    return this.props.highValueThresholdMinor;
  }
  get loyalty(): LoyaltySettings {
    return this.props.loyalty;
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

  accepts(method: PaymentMethod): boolean {
    if (this.props.status !== MerchantStatus.ACTIVE) return false;
    switch (method) {
      case PaymentMethod.CASH:
        return this.props.acceptedMethods.cash;
      case PaymentMethod.CARD:
        return this.props.acceptedMethods.card;
      case PaymentMethod.BANK_TRANSFER:
        return this.props.acceptedMethods.bankTransfer;
      default:
        return false;
    }
  }

  assignOwner(userId: string): void {
    this.props.ownerUserId = userId;
  }

  updateSettings(changes: MerchantSettingsChanges, now: Date): void {
    const acceptedMethods = { ...this.props.acceptedMethods, ...changes.acceptedMethods };
    if (!acceptedMethods.cash && !acceptedMethods.card && !acceptedMethods.bankTransfer) {
      throw new BusinessRuleViolationError('Accept at least one payment method');
    }
    const loyalty = { ...this.props.loyalty, ...changes.loyalty };
    Merchant.assertMoney(loyalty.earnUnitMinor, 'The amount per point');
    Merchant.assertMoney(loyalty.pointValueMinor, 'The value of a point');
    if (!Number.isInteger(loyalty.maxRedeemPercent) || loyalty.maxRedeemPercent < 0 || loyalty.maxRedeemPercent > 100) {
      throw new BusinessRuleViolationError('Points can cover between 0 and 100 percent of an order');
    }
    const threshold = changes.highValueThresholdMinor ?? this.props.highValueThresholdMinor;
    Merchant.assertMoney(threshold, 'The high-value threshold');

    this.props = {
      ...this.props,
      contactPhone: changes.contactPhone ?? this.props.contactPhone,
      acceptedMethods,
      loyalty,
      highValueThresholdMinor: threshold,
      updatedAt: now,
    };
  }

  changeSettlementAccount(account: SettlementAccount | null, now: Date): void {
    this.props.settlement = account;
    this.props.updatedAt = now;
  }

  syncVersion(version: number): void {
    this.props.version = version;
  }

  private static assertMoney(value: number, label: string): void {
    if (!Number.isInteger(value) || value <= 0 || value > MAX_MONEY_MINOR) {
      throw new BusinessRuleViolationError(`${label} must be a positive amount`);
    }
  }
}
