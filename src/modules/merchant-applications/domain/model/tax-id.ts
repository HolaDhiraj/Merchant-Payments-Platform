import { BusinessRuleViolationError } from '../../../../shared/domain/domain-errors';
import { maskValue } from '../../../../shared/security/redaction';

// Business tax identifier (e.g. EIN). Highly sensitive: encrypted at rest and masked everywhere.
// toString/toJSON return the masked form, so accidentally logging or serialising the
// aggregate never exposes the real value. Only reveal() returns the plaintext.
export class TaxId {
  private constructor(private readonly value: string) {}

  static of(raw: string): TaxId {
    const normalised = raw.replace(/[\s-]/g, '');
    if (!/^[A-Za-z0-9]{6,20}$/.test(normalised)) {
      throw new BusinessRuleViolationError('Tax id must be 6-20 alphanumeric characters');
    }
    return new TaxId(normalised.toUpperCase());
  }

  reveal(): string {
    return this.value;
  }

  lastFour(): string {
    return this.value.slice(-4);
  }

  masked(): string {
    return maskValue(this.value);
  }

  equals(other: TaxId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.masked();
  }

  toJSON(): string {
    return this.masked();
  }
}
