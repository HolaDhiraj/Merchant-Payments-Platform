import type { Merchant, PaymentMethod } from '@/api/types';
import { METHOD_ICON } from '@/components/portal/PaymentBadges';
import { Field, Input, PasswordInput } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/lib/cx';
import { formatMoney, toMinorUnits } from '@/lib/format';
import { PAYMENT_METHOD_LABEL } from '@/lib/labels';
import styles from './Checkout.module.css';

export interface PaymentDetails {
  tendered: string;
  cardNumber: string;
  cardExpiry: string;
  cardCvv: string;
  cardHolder: string;
  accountNumber: string;
  pin: string;
}

export const EMPTY_DETAILS: PaymentDetails = {
  tendered: '',
  cardNumber: '',
  cardExpiry: '',
  cardCvv: '',
  cardHolder: '',
  accountNumber: '',
  pin: '',
};

const METHODS: PaymentMethod[] = ['CASH', 'CARD', 'BANK_TRANSFER', 'QR'];

export function isAccepted(merchant: Merchant, method: PaymentMethod): boolean {
  switch (method) {
    case 'CASH':
      return merchant.acceptedMethods.cash;
    case 'CARD':
      return merchant.acceptedMethods.card;
    case 'BANK_TRANSFER':
      return merchant.acceptedMethods.bankTransfer;
    default:
      return false;
  }
}

// "4242424242424242" -> "4242 4242 4242 4242" as it is typed.
function formatCardNumber(value: string): string {
  return value
    .replace(/\D/g, '')
    .slice(0, 19)
    .replace(/(.{4})/g, '$1 ')
    .trim();
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

export function parseExpiry(value: string): { month: number; year: number } | null {
  const match = /^(\d{2})\/(\d{2})$/.exec(value);
  if (!match) return null;
  const month = Number(match[1]);
  return month >= 1 && month <= 12 ? { month, year: 2000 + Number(match[2]) } : null;
}

// What is still missing before this method can be charged (shown after a first attempt).
export function detailErrors(method: PaymentMethod, details: PaymentDetails, totalMinor: number, currency: string) {
  const errors: Partial<Record<keyof PaymentDetails, string>> = {};
  if (method === 'CASH') {
    const tendered = toMinorUnits(details.tendered, currency);
    if (!tendered || tendered < totalMinor) errors.tendered = 'At least the amount to pay.';
  }
  if (method === 'CARD') {
    if (details.cardNumber.replace(/\D/g, '').length < 12) errors.cardNumber = 'Enter the card number.';
    if (!parseExpiry(details.cardExpiry)) errors.cardExpiry = 'MM/YY';
    if (!/^\d{3,4}$/.test(details.cardCvv)) errors.cardCvv = '3 or 4 digits';
    if (details.cardHolder.trim().length < 2) errors.cardHolder = 'Name on the card.';
  }
  if (method === 'BANK_TRANSFER') {
    if (!/^\d{6,20}$/.test(details.accountNumber.replace(/[\s-]/g, ''))) errors.accountNumber = '6 to 20 digits.';
    if (!/^\d{4,6}$/.test(details.pin)) errors.pin = '4 to 6 digits.';
  }
  return errors;
}

interface PaymentMethodFormProps {
  merchant: Merchant;
  method: PaymentMethod;
  details: PaymentDetails;
  totalMinor: number;
  showErrors: boolean;
  onMethodChange(method: PaymentMethod): void;
  onChange(details: PaymentDetails): void;
}

export function PaymentMethodForm({ merchant, method, details, totalMinor, showErrors, onMethodChange, onChange }: PaymentMethodFormProps) {
  const set = (key: keyof PaymentDetails, value: string) => onChange({ ...details, [key]: value });
  const errors = showErrors ? detailErrors(method, details, totalMinor, merchant.currency) : {};
  const tendered = toMinorUnits(details.tendered, merchant.currency);
  const change = tendered && tendered >= totalMinor ? tendered - totalMinor : null;

  return (
    <div className={styles.payment}>
      <div className={styles.sectionHead}>
        <h3 className={styles.sectionTitle}>Payment</h3>
      </div>
      <div className={styles.methods} role="radiogroup" aria-label="Payment method">
        {METHODS.map((option) => {
          const accepted = isAccepted(merchant, option);
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={method === option}
              disabled={!accepted}
              className={cx(styles.method, method === option && styles.methodActive)}
              onClick={() => onMethodChange(option)}
              title={option === 'QR' ? 'QR payments are coming soon' : accepted ? undefined : 'Switched off in Settings'}
            >
              <Icon name={METHOD_ICON[option]} size={18} />
              <span>{PAYMENT_METHOD_LABEL[option]}</span>
              {option === 'QR' && <span className={styles.soon}>Soon</span>}
            </button>
          );
        })}
      </div>

      {method === 'CASH' && (
        <div className={styles.methodFields}>
          <Field label="Cash received" error={errors.tendered}>
            <Input
              value={details.tendered}
              onChange={(event) => set('tendered', event.target.value)}
              prefix={merchant.currency}
              inputMode="decimal"
              className="mono"
              placeholder={formatMoney(totalMinor, merchant.currency).replace(/[^\d.,]/g, '')}
            />
          </Field>
          <div className={styles.change}>
            <span>Change</span>
            <strong className="mono">{change === null ? '—' : formatMoney(change, merchant.currency)}</strong>
          </div>
        </div>
      )}

      {method === 'CARD' && (
        <div className={cx(styles.methodFields, styles.cardFields)}>
          <Field label="Card number" error={errors.cardNumber} className={styles.full}>
            <Input
              value={details.cardNumber}
              onChange={(event) => set('cardNumber', formatCardNumber(event.target.value))}
              inputMode="numeric"
              autoComplete="off"
              placeholder="4242 4242 4242 4242"
              className="mono"
            />
          </Field>
          <Field label="Expiry" error={errors.cardExpiry}>
            <Input value={details.cardExpiry} onChange={(event) => set('cardExpiry', formatExpiry(event.target.value))} inputMode="numeric" placeholder="MM/YY" className="mono" autoComplete="off" />
          </Field>
          <Field label="Security code" error={errors.cardCvv}>
            <PasswordInput value={details.cardCvv} onChange={(event) => set('cardCvv', event.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="CVV" autoComplete="off" />
          </Field>
          <Field label="Name on card" error={errors.cardHolder} className={styles.full}>
            <Input value={details.cardHolder} onChange={(event) => set('cardHolder', event.target.value)} autoComplete="off" />
          </Field>
          <p className={styles.secureNote}>
            <Icon name="shield" size={13} /> Card details go straight to the processor and are never stored.
          </p>
        </div>
      )}

      {method === 'BANK_TRANSFER' && (
        <div className={cx(styles.methodFields, styles.cardFields)}>
          <Field label="Customer's account number" error={errors.accountNumber} className={styles.full}>
            <Input value={details.accountNumber} onChange={(event) => set('accountNumber', event.target.value.replace(/[^\d -]/g, ''))} inputMode="numeric" autoComplete="off" className="mono" />
          </Field>
          <Field label="Account PIN" error={errors.pin} hint="Entered by the customer. Demo bank PIN: 0000.">
            <PasswordInput value={details.pin} onChange={(event) => set('pin', event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="off" />
          </Field>
          <p className={styles.secureNote}>
            <Icon name="shield" size={13} /> Only the last 4 digits of the account are kept.
          </p>
        </div>
      )}
    </div>
  );
}
