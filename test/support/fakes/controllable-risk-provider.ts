import {
  PermanentRiskProviderError,
  RiskProvider,
  RiskProviderRequest,
  RiskProviderResponse,
  TransientRiskProviderError,
} from '../../../src/modules/merchant-applications/domain/ports/risk-provider';
import { SimulatedKybRiskProvider } from '../../../src/modules/merchant-applications/infrastructure/risk-provider/simulated-kyb-risk.provider';

// Test double for the third-party provider: can fail a given number of times, fail
// permanently, or always fail, and records every call so tests can assert on idempotency.
export class ControllableRiskProvider implements RiskProvider {
  readonly calls: RiskProviderRequest[] = [];
  transientFailuresRemaining = 0;
  alwaysFailTransiently = false;
  failPermanently = false;

  async assess(request: RiskProviderRequest): Promise<RiskProviderResponse> {
    this.calls.push(request);
    if (this.failPermanently) {
      throw new PermanentRiskProviderError('Provider rejected the request');
    }
    if (this.alwaysFailTransiently || this.transientFailuresRemaining > 0) {
      this.transientFailuresRemaining = Math.max(0, this.transientFailuresRemaining - 1);
      throw new TransientRiskProviderError('Provider unavailable');
    }
    return SimulatedKybRiskProvider.score(request);
  }

  reset(): void {
    this.calls.length = 0;
    this.transientFailuresRemaining = 0;
    this.alwaysFailTransiently = false;
    this.failPermanently = false;
  }
}
