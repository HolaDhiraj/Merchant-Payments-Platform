import { PaymentMethod } from '../../merchants/domain/payment-method.enum';
import { FraudDecision, FraudSignals, screenPayment } from './fraud-screening';

const quiet: FraudSignals = {
  method: PaymentMethod.CASH,
  amountMinor: 1_000,
  highValueThresholdMinor: 500_000,
  instrumentAttempts10m: 0,
  instrumentDeclines30m: 0,
  customerPayments10m: 0,
  isNewCustomer: false,
};

describe('screenPayment', () => {
  it('allows an ordinary payment with no reasons', () => {
    expect(screenPayment(quiet)).toEqual({ score: 0, reasons: [], decision: FraudDecision.ALLOW });
  });

  it('holds a payment at the high-value threshold for review', () => {
    expect(screenPayment({ ...quiet, amountMinor: 500_000 })).toMatchObject({
      reasons: ['HIGH_AMOUNT'],
      decision: FraudDecision.REVIEW,
    });
  });

  it('scores a very high amount instead of (not on top of) a high amount', () => {
    const result = screenPayment({ ...quiet, amountMinor: 1_500_000 });
    expect(result.reasons).toEqual(['VERY_HIGH_AMOUNT']);
    expect(result.decision).toBe(FraudDecision.REVIEW);
  });

  it('blocks when signals add up past the block score', () => {
    const result = screenPayment({
      ...quiet,
      method: PaymentMethod.CARD,
      amountMinor: 1_500_000,
      isNewCustomer: true,
    });
    expect(result).toMatchObject({ score: 80, decision: FraudDecision.BLOCK });
  });

  it('flags repeated declines and velocity on the same instrument', () => {
    const result = screenPayment({ ...quiet, instrumentAttempts10m: 3, instrumentDeclines30m: 2 });
    expect(result.reasons).toEqual(['INSTRUMENT_VELOCITY', 'REPEATED_DECLINES']);
    expect(result.decision).toBe(FraudDecision.BLOCK);
  });

  it('never scores above 100', () => {
    const result = screenPayment({
      method: PaymentMethod.CARD,
      amountMinor: 9_999_999,
      highValueThresholdMinor: 1,
      instrumentAttempts10m: 9,
      instrumentDeclines30m: 9,
      customerPayments10m: 9,
      isNewCustomer: true,
    });
    expect(result.score).toBe(100);
  });
});
