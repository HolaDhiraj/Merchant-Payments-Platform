import { BusinessRuleViolationError } from '../../../shared/domain/domain-errors';
import { maxRedeemablePoints, pointsEarned, redemptionValue } from './loyalty';

const rules = { enabled: true, earnUnitMinor: 10_000, pointValueMinor: 100, maxRedeemPercent: 50 };

describe('loyalty', () => {
  it('earns one point per full earn unit actually paid', () => {
    expect(pointsEarned(rules, 9_999)).toBe(0);
    expect(pointsEarned(rules, 25_000)).toBe(2);
    expect(pointsEarned({ ...rules, enabled: false }, 25_000)).toBe(0);
  });

  it('caps redemption by balance and by the share of the order', () => {
    expect(maxRedeemablePoints(rules, 1_000, 10_000)).toBe(50);
    expect(maxRedeemablePoints(rules, 7, 10_000)).toBe(7);
  });

  it('values a valid redemption and rejects an invalid one', () => {
    expect(redemptionValue(rules, 3, 10, 10_000)).toBe(300);
    expect(redemptionValue(rules, 0, 0, 10_000)).toBe(0);
    expect(() => redemptionValue(rules, 11, 10, 10_000)).toThrow(BusinessRuleViolationError);
    expect(() => redemptionValue(rules, 60, 100, 10_000)).toThrow('At most 50 points');
  });
});
