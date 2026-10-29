import { randomBytes } from 'crypto';
import { AesGcmFieldCipher } from './aes-gcm-field-cipher';

function cipherWith(key: Buffer): AesGcmFieldCipher {
  return new AesGcmFieldCipher({
    fieldEncryptionKey: key.toString('base64'),
    loginThrottleLimit: 5,
    loginThrottleTtlSeconds: 60,
  });
}

describe('AesGcmFieldCipher', () => {
  const key = randomBytes(32);

  it('round-trips a value and never stores it in clear text', () => {
    const cipher = cipherWith(key);
    const encrypted = cipher.encrypt('000001234');
    expect(encrypted).not.toContain('000001234');
    expect(encrypted.startsWith('v1.')).toBe(true);
    expect(cipher.decrypt(encrypted)).toBe('000001234');
  });

  it('uses a random IV, so equal inputs give different ciphertexts', () => {
    const cipher = cipherWith(key);
    expect(cipher.encrypt('same')).not.toBe(cipher.encrypt('same'));
  });

  it('detects tampering through the GCM auth tag', () => {
    const cipher = cipherWith(key);
    const [version, iv, tag, data] = cipher.encrypt('000001234').split('.');
    const tampered = Buffer.from(data, 'base64');
    tampered[0] ^= 0xff;
    expect(() =>
      cipher.decrypt([version, iv, tag, tampered.toString('base64')].join('.')),
    ).toThrow();
  });

  it('cannot decrypt with a different key', () => {
    const encrypted = cipherWith(key).encrypt('000001234');
    expect(() => cipherWith(randomBytes(32)).decrypt(encrypted)).toThrow();
  });

  it('rejects keys that are not 32 bytes', () => {
    expect(() => cipherWith(randomBytes(16))).toThrow('32 bytes');
  });
});
