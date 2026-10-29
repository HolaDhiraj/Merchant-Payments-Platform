import { Inject, Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { securityConfig, SecurityConfig } from '../../config/app.config';
import { FieldCipher } from './field-cipher';

// Payload format version, so the algorithm or key can be rotated later without ambiguity.
const FORMAT_VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;
const KEY_LENGTH_BYTES = 32;

// AES-256-GCM authenticated encryption. Output: "v1.<iv>.<authTag>.<ciphertext>" (base64 parts).
// A fresh random IV per value means equal plaintexts produce different ciphertexts.
@Injectable()
export class AesGcmFieldCipher implements FieldCipher {
  private readonly key: Buffer;

  constructor(@Inject(securityConfig.KEY) config: SecurityConfig) {
    this.key = Buffer.from(config.fieldEncryptionKey, 'base64');
    if (this.key.length !== KEY_LENGTH_BYTES) {
      throw new Error('FIELD_ENCRYPTION_KEY must be 32 bytes encoded as base64');
    }
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [FORMAT_VERSION, iv, authTag, encrypted]
      .map((part) => (typeof part === 'string' ? part : part.toString('base64')))
      .join('.');
  }

  decrypt(payload: string): string {
    const [version, iv, authTag, encrypted] = payload.split('.');
    if (version !== FORMAT_VERSION || !iv || !authTag || !encrypted) {
      throw new Error('Unsupported encrypted field format');
    }
    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(authTag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
}
