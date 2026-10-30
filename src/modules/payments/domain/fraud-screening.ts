import { PaymentMethod } from '../../merchants/domain/payment-method.enum';

export enum FraudDecision {
  ALLOW = 'ALLOW',
  // Authorize, but hold for a merchant reviewer before it counts as collected.
  REVIEW = 'REVIEW',
  // Refuse without contacting the processor.
  BLOCK = 'BLOCK',
}

// Everything the rules look at. Counts are over this merchant's recent payments.
export interface FraudSignals {
  method: PaymentMethod;
  amountMinor: number;
  highValueThresholdMinor: number;
  // Same card / bank account (by fingerprint) in the last 10 minutes, and declines in the last 30.
  instrumentAttempts10m: number;
  instrumentDeclines30m: number;
  // Payments by the same customer in the last 10 minutes.
  customerPayments10m: number;
  // A customer with no completed purchase yet (null when no customer is attached).
  isNewCustomer: boolean | null;
}

export interface FraudAssessment {
  score: number;
  reasons: string[];
  decision: FraudDecision;
}

export const REVIEW_SCORE = 40;
export const BLOCK_SCORE = 70;

interface Rule {
  reason: string;
  points: number;
  applies(signals: FraudSignals): boolean;
}

// Transparent, rule-based screening: every point of the score is explained by a reason code,
// which the reviewer sees. Thresholds are deliberately simple and easy to tune.
const RULES: Rule[] = [
  {
    reason: 'VERY_HIGH_AMOUNT',
    points: 55,
    applies: (s) => s.amountMinor >= s.highValueThresholdMinor * 3,
  },
  {
    // On its own enough for a review.
    reason: 'HIGH_AMOUNT',
    points: 40,
    applies: (s) => s.amountMinor >= s.highValueThresholdMinor && s.amountMinor < s.highValueThresholdMinor * 3,
  },
  {
    reason: 'NEW_CUSTOMER_LARGE_AMOUNT',
    points: 15,
    applies: (s) => s.isNewCustomer === true && s.amountMinor >= s.highValueThresholdMinor / 2,
  },
  {
    // Card details typed in at the till carry more risk than a chip read.
    reason: 'MANUALLY_ENTERED_CARD',
    points: 10,
    applies: (s) => s.method === PaymentMethod.CARD,
  },
  {
    reason: 'INSTRUMENT_VELOCITY',
    points: 30,
    applies: (s) => s.instrumentAttempts10m >= 3,
  },
  {
    reason: 'REPEATED_DECLINES',
    points: 40,
    applies: (s) => s.instrumentDeclines30m >= 2,
  },
  {
    reason: 'CUSTOMER_VELOCITY',
    points: 25,
    applies: (s) => s.customerPayments10m >= 4,
  },
];

export function screenPayment(signals: FraudSignals): FraudAssessment {
  const matched = RULES.filter((rule) => rule.applies(signals));
  const score = Math.min(
    100,
    matched.reduce((sum, rule) => sum + rule.points, 0),
  );
  const decision =
    score >= BLOCK_SCORE ? FraudDecision.BLOCK : score >= REVIEW_SCORE ? FraudDecision.REVIEW : FraudDecision.ALLOW;
  return { score, reasons: matched.map((rule) => rule.reason), decision };
}
