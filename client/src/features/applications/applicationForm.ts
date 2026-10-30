import type {
  BusinessDetailsInput,
  BusinessDetailsPatch,
  BusinessType,
  MerchantApplication,
  SalesChannel,
} from '@/api/types';
import { toMajorInput, toMinorUnits } from '@/lib/format';

// Form model for creating and editing an application, with validation that mirrors the API's
// DTO rules (business-details.dto.ts) so most mistakes are caught before a round trip.

export interface ApplicationFormValues {
  businessName: string;
  legalBusinessName: string;
  businessType: BusinessType | '';
  taxId: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  merchantCategoryCode: string;
  currency: string;
  monthlyVolume: string;
  averageTicket: string;
  salesChannel: SalesChannel | '';
}

export type FormErrors = Partial<Record<keyof ApplicationFormValues, string>>;

export const EMPTY_FORM: ApplicationFormValues = {
  businessName: '',
  legalBusinessName: '',
  businessType: '',
  taxId: '',
  ownerName: '',
  ownerEmail: '',
  ownerPhone: '',
  merchantCategoryCode: '',
  currency: 'USD',
  monthlyVolume: '',
  averageTicket: '',
  salesChannel: '',
};

export function valuesFrom(app: MerchantApplication): ApplicationFormValues {
  const { processing, owner } = app;
  return {
    businessName: app.businessName,
    legalBusinessName: app.legalBusinessName,
    businessType: app.businessType,
    // Never returned by the API (only masked); left blank means "keep the stored value".
    taxId: '',
    ownerName: owner.fullName,
    ownerEmail: owner.email,
    ownerPhone: owner.phone,
    merchantCategoryCode: processing.merchantCategoryCode,
    currency: processing.currency.toUpperCase(),
    monthlyVolume: toMajorInput(processing.expectedMonthlyVolumeMinor, processing.currency),
    averageTicket: toMajorInput(processing.averageTicketMinor, processing.currency),
    salesChannel: processing.salesChannel,
  };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164 = /^\+[1-9]\d{6,14}$/;
const TAX_ID = /^[A-Za-z0-9 -]{6,24}$/;

export function validate(values: ApplicationFormValues, mode: 'create' | 'edit'): FormErrors {
  const errors: FormErrors = {};
  const text = (key: keyof ApplicationFormValues, label: string) => {
    const length = values[key].trim().length;
    if (length === 0) errors[key] = `${label} is required.`;
    else if (length < 2 || length > 200) errors[key] = `${label} must be 2–200 characters.`;
  };

  text('businessName', 'Trading name');
  text('legalBusinessName', 'Legal name');
  text('ownerName', 'Owner name');
  if (!values.businessType) errors.businessType = 'Choose the entity type.';
  if (!values.salesChannel) errors.salesChannel = 'Choose how the merchant takes payments.';

  if (mode === 'create' && !values.taxId.trim()) errors.taxId = 'Tax ID is required.';
  else if (values.taxId.trim() && !TAX_ID.test(values.taxId.trim())) {
    errors.taxId = '6–24 letters, digits, spaces or dashes.';
  }

  if (!EMAIL.test(values.ownerEmail.trim())) errors.ownerEmail = 'Enter a valid email address.';
  if (!E164.test(values.ownerPhone.trim())) errors.ownerPhone = 'Use international format, e.g. +15555550100.';
  if (!/^\d{4}$/.test(values.merchantCategoryCode.trim())) errors.merchantCategoryCode = 'Four digits, e.g. 5812.';
  if (!/^[A-Za-z]{3}$/.test(values.currency.trim())) errors.currency = 'Three-letter ISO code, e.g. USD.';

  const currency = values.currency.trim() || 'USD';
  if (toMinorUnits(values.monthlyVolume, currency) === null) errors.monthlyVolume = 'Enter an amount above zero.';
  if (toMinorUnits(values.averageTicket, currency) === null) errors.averageTicket = 'Enter an amount above zero.';
  return errors;
}

// Only call after validate() returned no errors.
export function toCreateInput(values: ApplicationFormValues): BusinessDetailsInput {
  const currency = values.currency.trim().toUpperCase();
  return {
    businessName: values.businessName.trim(),
    legalBusinessName: values.legalBusinessName.trim(),
    businessType: values.businessType as BusinessType,
    taxId: values.taxId.trim(),
    owner: {
      fullName: values.ownerName.trim(),
      email: values.ownerEmail.trim(),
      phone: values.ownerPhone.trim(),
    },
    processing: {
      merchantCategoryCode: values.merchantCategoryCode.trim(),
      currency,
      expectedMonthlyVolumeMinor: toMinorUnits(values.monthlyVolume, currency)!,
      averageTicketMinor: toMinorUnits(values.averageTicket, currency)!,
      salesChannel: values.salesChannel as SalesChannel,
    },
  };
}

// Sends only what changed, so the audit trail records exactly which fields were edited.
export function toPatch(values: ApplicationFormValues, original: MerchantApplication): BusinessDetailsPatch {
  const next = toCreateInput(values);
  const patch: BusinessDetailsPatch = {};

  if (next.businessName !== original.businessName) patch.businessName = next.businessName;
  if (next.legalBusinessName !== original.legalBusinessName) patch.legalBusinessName = next.legalBusinessName;
  if (next.businessType !== original.businessType) patch.businessType = next.businessType;
  if (next.taxId) patch.taxId = next.taxId;

  const owner = changed(next.owner, original.owner);
  if (owner) patch.owner = owner;
  const processing = changed(next.processing, { ...original.processing, currency: original.processing.currency.toUpperCase() });
  if (processing) patch.processing = processing;
  return patch;
}

function changed<T extends object>(next: T, previous: T): Partial<T> | null {
  const diff: Partial<T> = {};
  for (const key of Object.keys(next) as Array<keyof T>) {
    if (next[key] !== previous[key]) diff[key] = next[key];
  }
  return Object.keys(diff).length ? diff : null;
}
