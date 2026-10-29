import { BusinessType, SalesChannel } from '../model/business-details';
import { RiskLevel } from '../model/risk.enums';

export interface RiskProviderRequest {
  // Forwarded to the provider so it can de-duplicate our retries on its side.
  idempotencyKey: string;
  applicationId: string;
  legalBusinessName: string;
  businessType: BusinessType;
  taxId: string;
  merchantCategoryCode: string;
  currency: string;
  expectedMonthlyVolumeMinor: number;
  averageTicketMinor: number;
  salesChannel: SalesChannel;
}

export interface RiskProviderResponse {
  provider: string;
  providerReference: string;
  score: number;
  level: RiskLevel;
  reasons: string[];
}

// Port for the third-party risk / KYB service.
export interface RiskProvider {
  assess(request: RiskProviderRequest): Promise<RiskProviderResponse>;
}

export const RISK_PROVIDER = Symbol('RISK_PROVIDER');

// Temporary problem (timeout, 5xx, rate limit): the job should be retried with backoff.
export class TransientRiskProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransientRiskProviderError';
  }
}

// Permanent problem (request rejected as invalid): retrying cannot help.
export class PermanentRiskProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentRiskProviderError';
  }
}
