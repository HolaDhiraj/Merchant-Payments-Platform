import { Actor } from '../../../../shared/domain/actor';
import { BusinessType } from '../model/business-details';

// What an approved application hands over to become a live merchant.
export interface OnboardingRequest {
  applicationId: string;
  tradingName: string;
  legalName: string;
  businessType: BusinessType;
  merchantCategoryCode: string;
  currency: string;
  owner: { fullName: string; email: string; phone: string };
}

// Shown once to the approver so they can hand the owner their first sign-in.
// The temporary password is never stored in plain text and must be changed at first sign-in.
export interface OnboardingCredentials {
  merchantId: string;
  ownerUserId: string;
  ownerEmail: string;
  temporaryPassword: string;
}

// Port: turns an approved application into a merchant with an owner account.
// Implementations must join the caller's unit of work, so approval and onboarding commit together.
export interface MerchantOnboarding {
  onboard(actor: Actor, request: OnboardingRequest): Promise<OnboardingCredentials>;
}

export const MERCHANT_ONBOARDING = Symbol('MERCHANT_ONBOARDING');
