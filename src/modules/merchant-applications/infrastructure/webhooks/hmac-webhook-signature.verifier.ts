import { Inject, Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { riskWebhookConfig, RiskWebhookConfig } from '../../../../config/app.config';
import { AuthenticationFailedError } from '../../../../shared/domain/domain-errors';

export interface SignedWebhookRequest {
  eventId: string | undefined;
  timestamp: string | undefined;
  signatureHeader: string | undefined;
  rawBody: Buffer | undefined;
}

const SIGNATURE_VERSION = 'v1';
const EVENT_ID_PATTERN = /^[A-Za-z0-9_-]{8,100}$/;

// Verifies provider webhooks signed with HMAC-SHA256 over "<eventId>.<timestamp>.<raw body>".
//
// - The raw request bytes are signed, not re-serialised JSON, so any change to the body breaks it.
// - The timestamp must be within the tolerance window, which blocks replay of captured requests.
// - Including the event id in the signed content stops an attacker from replaying a valid body
//   under a different id to bypass de-duplication.
// - The header may carry several "v1=" signatures (comma separated) to allow zero-downtime
//   secret rotation; comparison is constant-time.
@Injectable()
export class HmacWebhookSignatureVerifier {
  constructor(@Inject(riskWebhookConfig.KEY) private readonly config: RiskWebhookConfig) {}

  static sign(
    secret: string,
    eventId: string,
    timestamp: string,
    rawBody: Buffer | string,
  ): string {
    const digest = createHmac('sha256', secret)
      .update(`${eventId}.${timestamp}.`)
      .update(rawBody)
      .digest('hex');
    return `${SIGNATURE_VERSION}=${digest}`;
  }

  verify(request: SignedWebhookRequest, nowMs = Date.now()): void {
    const { eventId, timestamp, signatureHeader, rawBody } = request;
    if (!eventId || !EVENT_ID_PATTERN.test(eventId) || !timestamp || !signatureHeader || !rawBody) {
      throw new AuthenticationFailedError('Missing or malformed webhook signature headers');
    }

    const timestampSeconds = Number(timestamp);
    if (!Number.isInteger(timestampSeconds)) {
      throw new AuthenticationFailedError('Malformed webhook timestamp');
    }
    if (Math.abs(nowMs / 1000 - timestampSeconds) > this.config.toleranceSeconds) {
      throw new AuthenticationFailedError('Webhook timestamp outside the allowed window');
    }

    const expected = Buffer.from(
      HmacWebhookSignatureVerifier.sign(this.config.secret, eventId, timestamp, rawBody),
    );
    const matches = signatureHeader
      .split(',')
      .map((candidate) => Buffer.from(candidate.trim()))
      .some(
        (candidate) => candidate.length === expected.length && timingSafeEqual(candidate, expected),
      );

    if (!matches) {
      throw new AuthenticationFailedError('Invalid webhook signature');
    }
  }
}
