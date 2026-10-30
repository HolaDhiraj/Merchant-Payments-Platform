import { BusinessRuleViolationError } from '../../../shared/domain/domain-errors';

export type CardBrand = 'VISA' | 'MASTERCARD' | 'AMEX' | 'DISCOVER' | 'UNIONPAY' | 'UNKNOWN';

// Card details exist only in memory for the length of one request: they are validated,
// fingerprinted and sent to the processor, and never stored or logged.
export interface CardDetails {
  number: string;
  expiryMonth: number;
  expiryYear: number;
  cvv: string;
  holderName: string;
}

export function luhnValid(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

export function cardBrand(digits: string): CardBrand {
  if (/^4/.test(digits)) return 'VISA';
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(digits)) return 'MASTERCARD';
  if (/^3[47]/.test(digits)) return 'AMEX';
  if (/^(6011|65|64[4-9])/.test(digits)) return 'DISCOVER';
  if (/^62/.test(digits)) return 'UNIONPAY';
  return 'UNKNOWN';
}

// Validates and normalises the card; returns the digits-only number and brand.
export function validateCard(card: CardDetails, now: Date): { number: string; brand: CardBrand } {
  const number = card.number.replace(/[\s-]/g, '');
  if (!/^\d{12,19}$/.test(number) || !luhnValid(number)) {
    throw new BusinessRuleViolationError('The card number is not valid');
  }
  const brand = cardBrand(number);
  const cvvLength = brand === 'AMEX' ? 4 : 3;
  if (!new RegExp(`^\\d{${cvvLength}}$`).test(card.cvv)) {
    throw new BusinessRuleViolationError(`The security code must be ${cvvLength} digits`);
  }
  // A card is valid until the end of its expiry month.
  const expiresAt = Date.UTC(card.expiryYear, card.expiryMonth, 1);
  if (card.expiryMonth < 1 || card.expiryMonth > 12 || expiresAt <= now.getTime()) {
    throw new BusinessRuleViolationError('The card has expired');
  }
  if (card.holderName.trim().length < 2) {
    throw new BusinessRuleViolationError("Enter the cardholder's name");
  }
  return { number, brand };
}
