import { Inject, Injectable } from '@nestjs/common';
import { createHmac } from 'crypto';
import { securityConfig, SecurityConfig } from '../../../config/app.config';
import { InstrumentFingerprinter } from '../domain/payment-processor';

// HMAC-SHA256 with a key derived from FIELD_ENCRYPTION_KEY (separate purpose label), so the
// fingerprint cannot be reversed or brute-forced from the small card-number space without the key.
@Injectable()
export class HmacInstrumentFingerprinter implements InstrumentFingerprinter {
  private readonly key: Buffer;

  constructor(@Inject(securityConfig.KEY) config: SecurityConfig) {
    this.key = createHmac('sha256', Buffer.from(config.fieldEncryptionKey, 'base64'))
      .update('instrument-fingerprint-v1')
      .digest();
  }

  fingerprint(kind: 'card' | 'account', value: string): string {
    return createHmac('sha256', this.key).update(`${kind}:${value}`).digest('hex');
  }
}
