import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { portalApi } from '@/api/endpoints';
import type { Customer, Merchant } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Field, Input } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { formatMoney } from '@/lib/format';
import styles from './Checkout.module.css';

export interface CustomerDraft {
  phone: string;
  fullName: string;
  points: number;
}

export const EMPTY_CUSTOMER: CustomerDraft = { phone: '', fullName: '', points: 0 };

// Enough digits to be a full international number (country code + subscriber).
export function phoneLooksComplete(phone: string): boolean {
  return /^\+?\d{8,15}$/.test(phone.replace(/[\s()-]/g, ''));
}

export function normalisePhone(phone: string): string {
  const digits = phone.replace(/[\s()-]/g, '');
  return digits.startsWith('+') ? digits : `+${digits}`;
}

// The most points usable on this order: limited by balance and the merchant's cap.
export function maxPoints(customer: Customer | null, merchant: Merchant, orderMinor: number): number {
  if (!customer || !merchant.loyalty.enabled) return 0;
  const capMinor = Math.floor((orderMinor * merchant.loyalty.maxRedeemPercent) / 100);
  return Math.min(customer.pointsBalance, Math.floor(capMinor / merchant.loyalty.pointValueMinor));
}

interface CustomerSectionProps {
  merchant: Merchant;
  draft: CustomerDraft;
  required: boolean;
  orderMinor: number;
  showErrors: boolean;
  onChange(draft: CustomerDraft): void;
  onResolved(customer: Customer | null): void;
}

// Returning customers are found by phone number; new ones only need a name.
export function CustomerSection({ merchant, draft, required, orderMinor, showErrors, onChange, onResolved }: CustomerSectionProps) {
  const [phone, setPhone] = useState(draft.phone);
  const complete = phoneLooksComplete(phone);
  const lookup = useQuery({
    queryKey: ['portal', 'customers', 'lookup', complete ? normalisePhone(phone) : ''],
    queryFn: () => portalApi.lookupCustomer(normalisePhone(phone)),
    enabled: complete,
    staleTime: 10_000,
  });
  const customer = complete ? (lookup.data?.customer ?? null) : null;
  const isNew = complete && lookup.isSuccess && !customer;
  const limit = maxPoints(customer, merchant, orderMinor);

  useEffect(() => setPhone(draft.phone), [draft.phone]);
  useEffect(() => onResolved(customer), [customer, onResolved]);
  // Never keep more points than currently allowed (e.g. after removing items).
  useEffect(() => {
    if (draft.points > limit) onChange({ ...draft, points: limit });
  }, [draft, limit, onChange]);

  const phoneError =
    showErrors && required && !complete ? 'Cash payments need the customer’s phone number.' : undefined;
  const nameError = showErrors && isNew && draft.fullName.trim().length < 2 ? 'Enter the new customer’s name.' : undefined;

  return (
    <div className={styles.customer}>
      <div className={styles.sectionHead}>
        <h3 className={styles.sectionTitle}>Customer</h3>
        <span className={styles.sectionHint}>{required ? 'Required for cash' : 'Optional'}</span>
      </div>
      <Field label="Phone number" error={phoneError}>
        <Input
          type="tel"
          inputMode="tel"
          placeholder="+977 98XXXXXXXX"
          value={phone}
          onChange={(event) => {
            setPhone(event.target.value);
            onChange({ ...draft, phone: event.target.value, points: 0 });
          }}
          className="mono"
        />
      </Field>

      {complete && lookup.isFetching && !lookup.data && (
        <div className={styles.lookupState}>
          <Spinner size="sm" /> Looking up customer…
        </div>
      )}

      {customer && (
        <div className={styles.found}>
          <span className={styles.avatar}>
            <Icon name="user" />
          </span>
          <div className={styles.foundText}>
            <strong>{customer.fullName}</strong>
            <span>
              {customer.visitCount} {customer.visitCount === 1 ? 'visit' : 'visits'} ·{' '}
              {formatMoney(customer.totalSpentMinor, merchant.currency)} spent
            </span>
          </div>
          {merchant.loyalty.enabled && (
            <Badge tone="accent">
              <Icon name="gift" size={12} />
              {customer.pointsBalance} pts
            </Badge>
          )}
        </div>
      )}

      {customer && limit > 0 && (
        <Field
          label="Use points"
          hint={`Up to ${limit} points (${formatMoney(limit * merchant.loyalty.pointValueMinor, merchant.currency)}) on this order.`}
        >
          <div className={styles.pointsRow}>
            <Input
              type="number"
              min={0}
              max={limit}
              inputMode="numeric"
              value={draft.points || ''}
              placeholder="0"
              onChange={(event) =>
                onChange({ ...draft, points: Math.max(0, Math.min(limit, Math.floor(Number(event.target.value) || 0))) })
              }
            />
            <button type="button" className={styles.linkButton} onClick={() => onChange({ ...draft, points: limit })}>
              Use max
            </button>
          </div>
        </Field>
      )}

      {isNew && (
        <Field label="New customer's name" error={nameError} hint="Saved with the phone number for next time.">
          <Input value={draft.fullName} onChange={(event) => onChange({ ...draft, fullName: event.target.value })} />
        </Field>
      )}
    </div>
  );
}
