import { BusinessRuleViolationError } from '../../../shared/domain/domain-errors';
import { cardBrand, luhnValid, validateCard } from './card';

const now = new Date('2026-10-30T00:00:00Z');
const card = { number: '4242 4242 4242 4242', expiryMonth: 12, expiryYear: 2028, cvv: '123', holderName: 'A B' };

describe('card validation', () => {
  it('checks the Luhn digit', () => {
    expect(luhnValid('4242424242424242')).toBe(true);
    expect(luhnValid('4242424242424241')).toBe(false);
  });

  it('detects common brands', () => {
    expect(cardBrand('4242424242424242')).toBe('VISA');
    expect(cardBrand('5555555555554444')).toBe('MASTERCARD');
    expect(cardBrand('378282246310005')).toBe('AMEX');
  });

  it('normalises a valid card', () => {
    expect(validateCard(card, now)).toEqual({ number: '4242424242424242', brand: 'VISA' });
  });

  it('accepts a card until the end of its expiry month', () => {
    expect(() => validateCard({ ...card, expiryMonth: 10, expiryYear: 2026 }, now)).not.toThrow();
    expect(() => validateCard({ ...card, expiryMonth: 9, expiryYear: 2026 }, now)).toThrow('The card has expired');
  });

  it('requires a 4-digit security code for Amex', () => {
    expect(() => validateCard({ ...card, number: '378282246310005' }, now)).toThrow(BusinessRuleViolationError);
    expect(() => validateCard({ ...card, number: '378282246310005', cvv: '1234' }, now)).not.toThrow();
  });
});
