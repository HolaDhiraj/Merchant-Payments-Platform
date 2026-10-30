import { Link } from 'react-router-dom';
import type { Payment } from '@/api/types';
import { PaymentMethodLabel } from '@/components/portal/PaymentBadges';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Dialog } from '@/components/ui/Dialog';
import { Icon, type IconName } from '@/components/ui/Icon';
import { cx } from '@/lib/cx';
import { formatMoney } from '@/lib/format';
import { FRAUD_REASON_LABEL } from '@/lib/labels';
import styles from './Checkout.module.css';

const OUTCOME: Record<string, { icon: IconName; title: string; tone: string }> = {
  COMPLETED: { icon: 'check', title: 'Payment received', tone: styles.ok },
  PENDING_REVIEW: { icon: 'shield', title: 'Held for review', tone: styles.held },
  DECLINED: { icon: 'close', title: 'Payment declined', tone: styles.declined },
};

interface ReceiptDialogProps {
  payment: Payment;
  onNewSale(): void;
  onRetry(): void;
}

// The outcome of a checkout, as a receipt.
export function ReceiptDialog({ payment, onNewSale, onRetry }: ReceiptDialogProps) {
  const outcome = OUTCOME[payment.status] ?? OUTCOME.DECLINED;
  const declined = payment.status === 'DECLINED';
  const money = (minor: number) => formatMoney(minor, payment.currency);

  return (
    <Dialog
      open
      onClose={declined ? onRetry : onNewSale}
      title={outcome.title}
      description={payment.reference}
      footer={
        declined ? (
          <>
            <Button onClick={onNewSale}>Cancel sale</Button>
            <Button variant="primary" icon="refresh" onClick={onRetry}>
              Try again
            </Button>
          </>
        ) : (
          <>
            <Link to={`/portal/payments/${payment.id}`} className={styles.receiptLink}>
              View details
            </Link>
            <Button variant="primary" icon="plus" onClick={onNewSale} autoFocus>
              New sale
            </Button>
          </>
        )
      }
    >
      <div className={styles.receipt}>
        <span className={cx(styles.outcomeIcon, outcome.tone)}>
          <Icon name={outcome.icon} size={22} />
        </span>
        <strong className={cx(styles.receiptTotal, 'mono')}>{money(payment.totalMinor)}</strong>
        <PaymentMethodLabel payment={payment} />
      </div>

      {payment.status === 'PENDING_REVIEW' && (
        <Callout tone="warning" title="A reviewer needs to approve this payment">
          The money is held, not collected yet.
          {payment.fraud.reasons.length > 0 && ` Why: ${payment.fraud.reasons.map((r) => FRAUD_REASON_LABEL[r] ?? r).join('; ')}.`}
        </Callout>
      )}
      {declined && (
        <Callout tone="danger" title={payment.declineReason ?? 'Declined'}>
          Nothing was charged{payment.pointsRedeemed > 0 ? ' and the points were returned to the customer' : ''}.
        </Callout>
      )}

      <dl className={styles.receiptLines}>
        {payment.lines.map((line) => (
          <div key={line.sku} className={styles.receiptLine}>
            <dt>
              {line.quantity} × {line.name}
              {line.discountPercent > 0 && <span className={styles.lineOff}> −{line.discountPercent}%</span>}
            </dt>
            <dd className="mono">{money(line.lineTotalMinor)}</dd>
          </div>
        ))}
        {payment.discountMinor > 0 && (
          <div className={styles.receiptLine}>
            <dt>Discounts</dt>
            <dd className="mono">−{money(payment.discountMinor)}</dd>
          </div>
        )}
        {payment.pointsDiscountMinor > 0 && (
          <div className={styles.receiptLine}>
            <dt>{payment.pointsRedeemed} points</dt>
            <dd className="mono">−{money(payment.pointsDiscountMinor)}</dd>
          </div>
        )}
        {payment.changeMinor !== null && payment.status !== 'DECLINED' && (
          <div className={cx(styles.receiptLine, styles.emphasis)}>
            <dt>Change to give</dt>
            <dd className="mono">{money(payment.changeMinor)}</dd>
          </div>
        )}
        {payment.pointsEarned > 0 && (
          <div className={styles.receiptLine}>
            <dt>Points earned{payment.customer ? ` by ${payment.customer.name}` : ''}</dt>
            <dd>+{payment.pointsEarned}</dd>
          </div>
        )}
      </dl>
    </Dialog>
  );
}
