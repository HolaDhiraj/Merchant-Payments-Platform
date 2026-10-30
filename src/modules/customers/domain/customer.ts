import { BusinessRuleViolationError } from '../../../shared/domain/domain-errors';

export interface Customer {
  readonly id: string;
  readonly merchantId: string;
  readonly fullName: string;
  // E.164; unique per merchant, so the till can find a returning customer by phone.
  readonly phone: string;
  readonly email: string | null;
  readonly pointsBalance: number;
  readonly totalSpentMinor: number;
  readonly visitCount: number;
  readonly lastPurchaseAt: Date | null;
  readonly createdAt: Date;
}

export enum LoyaltyEntryType {
  EARN = 'EARN',
  REDEEM = 'REDEEM',
  // Points given back when a payment that redeemed them is voided.
  RESTORE = 'RESTORE',
}

export interface LoyaltyEntry {
  readonly id: string;
  readonly merchantId: string;
  readonly customerId: string;
  readonly transactionId: string | null;
  readonly type: LoyaltyEntryType;
  // Signed: positive for EARN/RESTORE, negative for REDEEM.
  readonly points: number;
  readonly balanceAfter: number;
  readonly createdAt: Date;
}

const E164 = /^\+[1-9]\d{6,14}$/;

export function normalisePhone(raw: string): string {
  const phone = raw.replace(/[\s()-]/g, '');
  if (!E164.test(phone)) {
    throw new BusinessRuleViolationError('Enter the phone number in international format, e.g. +9779812345678');
  }
  return phone;
}
