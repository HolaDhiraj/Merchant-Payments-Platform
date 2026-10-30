import { BusinessRuleViolationError } from '../../../shared/domain/domain-errors';

// Loyalty maths, shared by checkout and the customer screens. Integer minor units throughout.

export interface LoyaltyRules {
  readonly enabled: boolean;
  // Minor units spent per point earned (e.g. 10000 = 1 point per 100.00).
  readonly earnUnitMinor: number;
  // What one point is worth when redeemed, in minor units.
  readonly pointValueMinor: number;
  // Points may pay for at most this share of an order.
  readonly maxRedeemPercent: number;
}

// Points earned on what the customer actually paid (after discounts and points), rounded down.
export function pointsEarned(rules: LoyaltyRules, paidMinor: number): number {
  if (!rules.enabled || paidMinor <= 0) return 0;
  return Math.floor(paidMinor / rules.earnUnitMinor);
}

// The most points usable on an order of this amount, given the balance and the cap.
export function maxRedeemablePoints(rules: LoyaltyRules, balance: number, orderMinor: number): number {
  if (!rules.enabled) return 0;
  const capMinor = Math.floor((orderMinor * rules.maxRedeemPercent) / 100);
  return Math.min(balance, Math.floor(capMinor / rules.pointValueMinor));
}

// Validates a redemption and returns its value in minor units.
export function redemptionValue(
  rules: LoyaltyRules,
  points: number,
  balance: number,
  orderMinor: number,
): number {
  if (points === 0) return 0;
  if (!rules.enabled) throw new BusinessRuleViolationError('Loyalty points are switched off');
  if (!Number.isInteger(points) || points < 0) {
    throw new BusinessRuleViolationError('Points must be a whole number');
  }
  if (points > balance) {
    throw new BusinessRuleViolationError(`The customer has only ${balance} points`);
  }
  const max = maxRedeemablePoints(rules, balance, orderMinor);
  if (points > max) {
    throw new BusinessRuleViolationError(
      `At most ${max} points can be used on this order (${rules.maxRedeemPercent}% of the total)`,
    );
  }
  return points * rules.pointValueMinor;
}
