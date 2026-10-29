import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { riskReviewConfig, RiskReviewConfig } from '../../../../config/app.config';
import { BusinessType, SalesChannel } from '../../domain/model/business-details';
import { RiskLevel } from '../../domain/model/risk.enums';
import {
  RiskProvider,
  RiskProviderRequest,
  RiskProviderResponse,
  TransientRiskProviderError,
} from '../../domain/ports/risk-provider';

// MCCs that card networks commonly treat as high risk (gambling, crypto, money transfer, ...).
const HIGH_RISK_MCCS = new Set(['4829', '5933', '5967', '5993', '6051', '6211', '7273', '7995']);

// Volume / ticket thresholds in minor units.
const HIGH_MONTHLY_VOLUME_MINOR = 100_000_000; // 1,000,000.00
const HIGH_AVERAGE_TICKET_MINOR = 500_000; // 5,000.00

// Stand-in for a third-party KYB / risk vendor.
// - Scoring is deterministic, so tests and demos are reproducible.
// - Latency and transient failures can be configured to exercise retries and backoff.
// - Responses are cached per idempotency key, mimicking a vendor that honours idempotency keys.
@Injectable()
export class SimulatedKybRiskProvider implements RiskProvider {
  private readonly logger = new Logger(SimulatedKybRiskProvider.name);
  private readonly responsesByIdempotencyKey = new Map<string, RiskProviderResponse>();

  constructor(@Inject(riskReviewConfig.KEY) private readonly config: RiskReviewConfig) {}

  async assess(request: RiskProviderRequest): Promise<RiskProviderResponse> {
    await this.simulateLatency();

    const cached = this.responsesByIdempotencyKey.get(request.idempotencyKey);
    if (cached) {
      return cached;
    }

    if (Math.random() < this.config.providerTransientFailureRate) {
      this.logger.warn(`Simulated provider outage for ${request.applicationId}`);
      throw new TransientRiskProviderError('Risk provider temporarily unavailable (simulated 503)');
    }

    const response = SimulatedKybRiskProvider.score(request);
    this.responsesByIdempotencyKey.set(request.idempotencyKey, response);
    return response;
  }

  // Pure scoring function, exposed for unit tests.
  static score(request: RiskProviderRequest): RiskProviderResponse {
    const reasons: string[] = [];
    let score = 10;

    if (HIGH_RISK_MCCS.has(request.merchantCategoryCode)) {
      score += 45;
      reasons.push('HIGH_RISK_MCC');
    }
    if (request.expectedMonthlyVolumeMinor >= HIGH_MONTHLY_VOLUME_MINOR) {
      score += 20;
      reasons.push('HIGH_MONTHLY_VOLUME');
    }
    if (request.averageTicketMinor >= HIGH_AVERAGE_TICKET_MINOR) {
      score += 15;
      reasons.push('HIGH_AVERAGE_TICKET');
    }
    if (request.salesChannel === SalesChannel.CARD_NOT_PRESENT) {
      score += 10;
      reasons.push('CARD_NOT_PRESENT');
    }
    if (request.businessType === BusinessType.SOLE_PROPRIETORSHIP) {
      score += 5;
      reasons.push('SOLE_PROPRIETORSHIP');
    }

    score = Math.min(score, 100);
    const level = score >= 60 ? RiskLevel.HIGH : score >= 30 ? RiskLevel.MEDIUM : RiskLevel.LOW;
    const providerReference =
      'kyb_sim_' + createHash('sha256').update(request.idempotencyKey).digest('hex').slice(0, 16);

    return { provider: 'simulated-kyb', providerReference, score, level, reasons };
  }

  private async simulateLatency(): Promise<void> {
    if (this.config.providerLatencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.config.providerLatencyMs));
    }
  }
}
