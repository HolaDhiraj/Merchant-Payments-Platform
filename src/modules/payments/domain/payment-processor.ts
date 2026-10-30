import { CardDetails } from './card';

// The instrument to charge: a card, or a bank account authorised with its PIN.
export type ChargeInstrument =
  | { method: 'CARD'; card: CardDetails }
  | { method: 'BANK_TRANSFER'; bank: { accountNumber: string; pin: string } };

export type ChargeRequest = ChargeInstrument & {
  idempotencyKey: string;
  amountMinor: number;
  currency: string;
};

export type ChargeResult =
  | { approved: true; authorizationCode: string }
  | { approved: false; declineReason: string };

// Port to the card network / bank. The idempotency key is forwarded so a retried call
// cannot move money twice. Implementations must never log or persist card or PIN data.
export interface PaymentProcessor {
  charge(request: ChargeRequest): Promise<ChargeResult>;
  // Releases an authorization that was held for review and then rejected.
  release(authorizationCode: string): Promise<void>;
}

export const PAYMENT_PROCESSOR = Symbol('PAYMENT_PROCESSOR');

// Keyed one-way fingerprint of a card or account number (HMAC), used to spot repeated
// attempts with the same instrument without storing the number itself.
export interface InstrumentFingerprinter {
  fingerprint(kind: 'card' | 'account', value: string): string;
}

export const INSTRUMENT_FINGERPRINTER = Symbol('INSTRUMENT_FINGERPRINTER');
