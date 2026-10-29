import { AuthenticationFailedError } from '../../../../shared/domain/domain-errors';
import { HmacWebhookSignatureVerifier } from './hmac-webhook-signature.verifier';

// Synthetic test secret, generated for this test only.
const SECRET = 'test-secret-'.padEnd(48, 'x');
const NOW_MS = Date.UTC(2026, 0, 1);
const NOW_SECONDS = String(NOW_MS / 1000);
const EVENT_ID = 'evt_0000000001';
const BODY = Buffer.from('{"score":10}');

describe('HmacWebhookSignatureVerifier', () => {
  const verifier = new HmacWebhookSignatureVerifier({ secret: SECRET, toleranceSeconds: 300 });

  const request = (overrides: Partial<Parameters<typeof verifier.verify>[0]> = {}) => ({
    eventId: EVENT_ID,
    timestamp: NOW_SECONDS,
    signatureHeader: HmacWebhookSignatureVerifier.sign(SECRET, EVENT_ID, NOW_SECONDS, BODY),
    rawBody: BODY,
    ...overrides,
  });

  it('accepts a correctly signed, fresh request', () => {
    expect(() => verifier.verify(request(), NOW_MS)).not.toThrow();
  });

  it('accepts any of several signatures (secret rotation)', () => {
    const valid = HmacWebhookSignatureVerifier.sign(SECRET, EVENT_ID, NOW_SECONDS, BODY);
    expect(() =>
      verifier.verify(request({ signatureHeader: `v1=${'0'.repeat(64)}, ${valid}` }), NOW_MS),
    ).not.toThrow();
  });

  it.each([
    ['a modified body', { rawBody: Buffer.from('{"score":99}') }],
    ['a different event id (replay under a new id)', { eventId: 'evt_0000000002' }],
    [
      'a wrong secret',
      {
        signatureHeader: HmacWebhookSignatureVerifier.sign(
          'other-secret'.padEnd(40, 'y'),
          EVENT_ID,
          NOW_SECONDS,
          BODY,
        ),
      },
    ],
    ['a truncated signature', { signatureHeader: 'v1=abc' }],
    ['missing headers', { signatureHeader: undefined }],
    ['a malformed event id', { eventId: 'bad id!' }],
    ['a missing raw body', { rawBody: undefined }],
  ])('rejects %s', (_case, overrides) => {
    expect(() => verifier.verify(request(overrides), NOW_MS)).toThrow(AuthenticationFailedError);
  });

  it('rejects requests outside the replay window, even when correctly signed', () => {
    const old = String(NOW_MS / 1000 - 301);
    const signed = request({
      timestamp: old,
      signatureHeader: HmacWebhookSignatureVerifier.sign(SECRET, EVENT_ID, old, BODY),
    });
    expect(() => verifier.verify(signed, NOW_MS)).toThrow('outside the allowed window');
  });
});
