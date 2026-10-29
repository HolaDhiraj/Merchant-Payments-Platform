import { BusinessType, SalesChannel } from '../../domain/model/business-details';
import { RiskLevel } from '../../domain/model/risk.enums';
import { RiskProviderRequest, TransientRiskProviderError } from '../../domain/ports/risk-provider';
import { SimulatedKybRiskProvider } from './simulated-kyb-risk.provider';

const baseRequest: RiskProviderRequest = {
  idempotencyKey: 'risk-review:app:1',
  applicationId: 'app',
  legalBusinessName: 'Test Coffee LLC',
  businessType: BusinessType.LLC,
  taxId: '000001234',
  merchantCategoryCode: '5812',
  currency: 'USD',
  expectedMonthlyVolumeMinor: 2_500_000,
  averageTicketMinor: 4_500,
  salesChannel: SalesChannel.CARD_PRESENT,
};

function provider(failureRate = 0): SimulatedKybRiskProvider {
  return new SimulatedKybRiskProvider({
    maxAttempts: 3,
    backoffMs: 10,
    providerTransientFailureRate: failureRate,
    providerLatencyMs: 0,
  });
}

describe('SimulatedKybRiskProvider', () => {
  it('scores a low-risk restaurant as LOW', () => {
    const result = SimulatedKybRiskProvider.score(baseRequest);
    expect(result.level).toBe(RiskLevel.LOW);
    expect(result.reasons).toEqual([]);
  });

  it('flags high-risk MCC, large volume and card-not-present as HIGH', () => {
    const result = SimulatedKybRiskProvider.score({
      ...baseRequest,
      merchantCategoryCode: '7995',
      expectedMonthlyVolumeMinor: 200_000_000,
      salesChannel: SalesChannel.CARD_NOT_PRESENT,
    });
    expect(result.level).toBe(RiskLevel.HIGH);
    expect(result.reasons).toEqual(['HIGH_RISK_MCC', 'HIGH_MONTHLY_VOLUME', 'CARD_NOT_PRESENT']);
  });

  it('is deterministic for the same idempotency key', () => {
    expect(SimulatedKybRiskProvider.score(baseRequest)).toEqual(
      SimulatedKybRiskProvider.score(baseRequest),
    );
  });

  it('returns the cached response for a repeated idempotency key', async () => {
    const instance = provider();
    const first = await instance.assess(baseRequest);
    const second = await instance.assess({ ...baseRequest, merchantCategoryCode: '7995' });
    expect(second).toBe(first);
  });

  it('raises transient errors when configured to fail', async () => {
    await expect(provider(1).assess(baseRequest)).rejects.toBeInstanceOf(
      TransientRiskProviderError,
    );
  });
});
