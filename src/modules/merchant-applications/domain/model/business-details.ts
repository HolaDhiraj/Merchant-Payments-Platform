import { BusinessRuleViolationError } from '../../../../shared/domain/domain-errors';
import { TaxId } from './tax-id';

export enum BusinessType {
  SOLE_PROPRIETORSHIP = 'SOLE_PROPRIETORSHIP',
  PARTNERSHIP = 'PARTNERSHIP',
  LLC = 'LLC',
  CORPORATION = 'CORPORATION',
  NON_PROFIT = 'NON_PROFIT',
}

// How the merchant will accept payments; drives part of the risk assessment.
export enum SalesChannel {
  CARD_PRESENT = 'CARD_PRESENT',
  CARD_NOT_PRESENT = 'CARD_NOT_PRESENT',
  OMNICHANNEL = 'OMNICHANNEL',
}

export interface OwnerContact {
  readonly fullName: string;
  readonly email: string;
  readonly phone: string;
}

// Requested processing profile. Money is always an integer amount in minor units
// (e.g. cents) to avoid floating point rounding errors.
export interface ProcessingProfile {
  readonly merchantCategoryCode: string;
  readonly currency: string;
  readonly expectedMonthlyVolumeMinor: number;
  readonly averageTicketMinor: number;
  readonly salesChannel: SalesChannel;
}

// Everything the sales user captures about the merchant.
export interface BusinessDetails {
  readonly businessName: string;
  readonly legalBusinessName: string;
  readonly businessType: BusinessType;
  readonly taxId: TaxId;
  readonly owner: OwnerContact;
  readonly processing: ProcessingProfile;
}

const MCC_PATTERN = /^\d{4}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

// Domain invariants that must hold no matter which adapter (HTTP, CLI, test) creates the data.
export function assertValidBusinessDetails(details: BusinessDetails): void {
  if (!details.businessName.trim() || !details.legalBusinessName.trim()) {
    throw new BusinessRuleViolationError('Business name and legal business name are required');
  }
  if (
    !details.owner.fullName.trim() ||
    !details.owner.email.trim() ||
    !details.owner.phone.trim()
  ) {
    throw new BusinessRuleViolationError('Owner name, email and phone are required');
  }

  const { processing } = details;
  if (!MCC_PATTERN.test(processing.merchantCategoryCode)) {
    throw new BusinessRuleViolationError('Merchant category code must be 4 digits');
  }
  if (!CURRENCY_PATTERN.test(processing.currency)) {
    throw new BusinessRuleViolationError('Currency must be an ISO 4217 code');
  }
  for (const amount of [processing.expectedMonthlyVolumeMinor, processing.averageTicketMinor]) {
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new BusinessRuleViolationError(
        'Processing amounts must be positive integers in minor units',
      );
    }
  }
  if (processing.averageTicketMinor > processing.expectedMonthlyVolumeMinor) {
    throw new BusinessRuleViolationError('Average ticket cannot exceed expected monthly volume');
  }
}
