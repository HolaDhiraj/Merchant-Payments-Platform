// Port for field-level encryption of highly sensitive values (e.g. tax identifiers)
// before they are written to the database.
export interface FieldCipher {
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
}

export const FIELD_CIPHER = Symbol('FIELD_CIPHER');
