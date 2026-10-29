import {
  BusinessDetails,
  BusinessType,
  OwnerContact,
  ProcessingProfile,
} from '../../domain/model/business-details';
import { TaxId } from '../../domain/model/tax-id';

// Plain input shape accepted by create/update use cases (tax id as a raw string).
export interface BusinessDetailsInput {
  businessName: string;
  legalBusinessName: string;
  businessType: BusinessType;
  taxId: string;
  owner: OwnerContact;
  processing: ProcessingProfile;
}

export type BusinessDetailsChanges = Partial<
  Omit<BusinessDetailsInput, 'owner' | 'processing'> & {
    owner: Partial<OwnerContact>;
    processing: Partial<ProcessingProfile>;
  }
>;

export function toBusinessDetails(input: BusinessDetailsInput): BusinessDetails {
  return {
    businessName: input.businessName.trim(),
    legalBusinessName: input.legalBusinessName.trim(),
    businessType: input.businessType,
    taxId: TaxId.of(input.taxId),
    owner: { ...input.owner, email: input.owner.email.trim().toLowerCase() },
    processing: { ...input.processing, currency: input.processing.currency.toUpperCase() },
  };
}

// Converts a partial update into domain types, leaving untouched fields undefined.
export function toBusinessDetailsChanges(
  changes: BusinessDetailsChanges,
): Partial<BusinessDetails> {
  const result: Record<string, unknown> = {};
  if (changes.businessName !== undefined) result.businessName = changes.businessName.trim();
  if (changes.legalBusinessName !== undefined)
    result.legalBusinessName = changes.legalBusinessName.trim();
  if (changes.businessType !== undefined) result.businessType = changes.businessType;
  if (changes.taxId !== undefined) result.taxId = TaxId.of(changes.taxId);
  if (changes.owner !== undefined) {
    result.owner = {
      ...changes.owner,
      ...(changes.owner.email !== undefined && { email: changes.owner.email.trim().toLowerCase() }),
    };
  }
  if (changes.processing !== undefined) {
    result.processing = {
      ...changes.processing,
      ...(changes.processing.currency !== undefined && {
        currency: changes.processing.currency.toUpperCase(),
      }),
    };
  }
  return result as Partial<BusinessDetails>;
}

// Lists changed field paths for the audit trail (names only, never values).
export function changedFieldNames(changes: BusinessDetailsChanges): string[] {
  return Object.entries(changes).flatMap(([key, value]) =>
    value !== null && typeof value === 'object'
      ? Object.keys(value).map((nested) => `${key}.${nested}`)
      : [key],
  );
}
