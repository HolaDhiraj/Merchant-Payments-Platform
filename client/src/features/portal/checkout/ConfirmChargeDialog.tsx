import type { CheckoutInput, Merchant } from '@/api/types';
import { METHOD_ICON } from '@/components/portal/PaymentBadges';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/lib/cx';
import { formatMoney } from '@/lib/format';
import { PAYMENT_METHOD_LABEL } from '@/lib/labels';
import type { CartLine } from './useCart';
import styles from './Checkout.module.css';

export interface ChargeSummary {
  input: CheckoutInput;
  lines: CartLine[];
  subtotalMinor: number;
  discountMinor: number;
  pointsValueMinor: number;
  totalMinor: number;
  customerName: string | null;
}

function cardBrand(number: string): string {
  const digits = number.replace(/\D/g, '');
  if (/^4/.test(digits)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard';
  if (/^3[47]/.test(digits)) return 'Amex';
  if (/^6/.test(digits)) return 'Discover';
  return 'Card';
}

// What is about to be charged, read back before any money moves.
function instrumentLine(input: CheckoutInput): string {
  if (input.card) return `${cardBrand(input.card.number)} •••• ${input.card.number.replace(/\D/g, '').slice(-4)}`;
  if (input.bankTransfer) return `Account •••• ${input.bankTransfer.accountNumber.replace(/\D/g, '').slice(-4)}`;
  return PAYMENT_METHOD_LABEL[input.method];
}

interface ConfirmChargeDialogProps {
  merchant: Merchant;
  summary: ChargeSummary;
  busy: boolean;
  onConfirm(): void;
  onClose(): void;
}

export function ConfirmChargeDialog({ merchant, summary, busy, onConfirm, onClose }: ConfirmChargeDialogProps) {
  const money = (minor: number) => formatMoney(minor, merchant.currency);
  const { input } = summary;
  const items = summary.lines.reduce((n, line) => n + line.quantity, 0);
  const change = input.cashTenderedMinor !== undefined ? input.cashTenderedMinor - summary.totalMinor : null;

  return (
    <Dialog
      open
      onClose={onClose}
      onSubmit={onConfirm}
      busy={busy}
      title="Confirm payment"
      description="Check the details with the customer before charging."
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Back
          </Button>
          <Button type="submit" variant="primary" icon="check" loading={busy} autoFocus>
            Charge {money(summary.totalMinor)}
          </Button>
        </>
      }
    >
      <div className={styles.confirmHead}>
        <span className={styles.confirmMethod}>
          <Icon name={METHOD_ICON[input.method]} size={18} />
          {PAYMENT_METHOD_LABEL[input.method]}
        </span>
        <strong className={cx(styles.receiptTotal, 'mono')}>{money(summary.totalMinor)}</strong>
        <span className={styles.confirmSub}>
          {items} {items === 1 ? 'item' : 'items'} · {summary.customerName ?? 'Walk-in customer'}
        </span>
      </div>

      <dl className={styles.receiptLines}>
        {summary.lines.map(({ product, quantity }) => (
          <div key={product.id} className={styles.receiptLine}>
            <dt>
              {quantity} × {product.name}
              {product.price.discountPercent > 0 && <span className={styles.lineOff}> −{product.price.discountPercent}%</span>}
            </dt>
            <dd className="mono">{money(product.price.finalPriceMinor * quantity)}</dd>
          </div>
        ))}
        {summary.discountMinor > 0 && (
          <div className={styles.receiptLine}>
            <dt>Discounts included</dt>
            <dd className="mono">−{money(summary.discountMinor)}</dd>
          </div>
        )}
        {summary.pointsValueMinor > 0 && (
          <div className={styles.receiptLine}>
            <dt>{input.pointsToRedeem} points used</dt>
            <dd className="mono">−{money(summary.pointsValueMinor)}</dd>
          </div>
        )}
        <div className={cx(styles.receiptLine, styles.confirmTotal)}>
          <dt>To charge</dt>
          <dd className="mono">{money(summary.totalMinor)}</dd>
        </div>
      </dl>

      <dl className={styles.confirmFacts}>
        <div>
          <dt>Pay with</dt>
          <dd className={input.card || input.bankTransfer ? 'mono' : undefined}>{instrumentLine(input)}</dd>
        </div>
        {input.customer && (
          <div>
            <dt>Customer</dt>
            <dd>
              {summary.customerName ?? input.customer.fullName} · <span className="mono">{input.customer.phone}</span>
            </dd>
          </div>
        )}
        {change !== null && input.cashTenderedMinor !== undefined && (
          <>
            <div>
              <dt>Cash received</dt>
              <dd className="mono">{money(input.cashTenderedMinor)}</dd>
            </div>
            <div className={styles.emphasis}>
              <dt>Change to give</dt>
              <dd className="mono">{money(change)}</dd>
            </div>
          </>
        )}
      </dl>
      {input.bankTransfer && <p className={styles.secureNote}>The customer's bank checks the PIN when you confirm.</p>}
    </Dialog>
  );
}
