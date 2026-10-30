import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { paymentsConfig, PaymentsConfig } from '../../../config/app.config';
import { ChargeRequest, ChargeResult, PaymentProcessor } from '../domain/payment-processor';

// Card numbers that the simulated network declines, for demos and tests (all pass Luhn).
const DECLINED_CARDS: Record<string, string> = {
  '4000000000000002': 'Declined by the card issuer',
  '4000000000009995': 'Insufficient funds',
  '4000000000000069': 'The card is reported lost or stolen',
};
// Above this amount the simulated bank answers "insufficient funds" (10,000,000.00).
const BANK_BALANCE_LIMIT_MINOR = 1_000_000_000;

// Stand-in for a card acquirer and a bank's account-to-account transfer API.
//  - Cards: any valid card is approved except the test numbers above and CVV "000".
//  - Bank transfers: approved only with the configured PIN (BANK_SIMULATOR_PIN, default 0000).
//  - Results are cached per idempotency key, like a real processor, so retries never double-charge.
// Nothing about the card or PIN is logged or kept beyond the in-memory response cache.
@Injectable()
export class SimulatedPaymentProcessor implements PaymentProcessor {
  private readonly results = new Map<string, ChargeResult>();
  private readonly released = new Set<string>();

  constructor(@Inject(paymentsConfig.KEY) private readonly config: PaymentsConfig) {}

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    if (this.config.processorLatencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.config.processorLatencyMs));
    }
    const cached = this.results.get(request.idempotencyKey);
    if (cached) return cached;

    const result = request.method === 'CARD' ? this.chargeCard(request) : this.chargeBank(request);
    this.results.set(request.idempotencyKey, result);
    return result;
  }

  async release(authorizationCode: string): Promise<void> {
    this.released.add(authorizationCode);
  }

  private chargeCard(request: Extract<ChargeRequest, { method: 'CARD' }>): ChargeResult {
    const declined = DECLINED_CARDS[request.card.number];
    if (declined) return { approved: false, declineReason: declined };
    if (request.card.cvv === '000' || request.card.cvv === '0000') {
      return { approved: false, declineReason: 'The security code is incorrect' };
    }
    return { approved: true, authorizationCode: authorizationCode('CRD') };
  }

  private chargeBank(request: Extract<ChargeRequest, { method: 'BANK_TRANSFER' }>): ChargeResult {
    if (request.bank.pin !== this.config.bankSimulatorPin) {
      return { approved: false, declineReason: 'Incorrect PIN' };
    }
    if (request.amountMinor > BANK_BALANCE_LIMIT_MINOR) {
      return { approved: false, declineReason: 'Insufficient funds in the account' };
    }
    return { approved: true, authorizationCode: authorizationCode('BNK') };
  }
}

function authorizationCode(prefix: string): string {
  return `${prefix}-${randomBytes(4).toString('hex').toUpperCase()}`;
}
