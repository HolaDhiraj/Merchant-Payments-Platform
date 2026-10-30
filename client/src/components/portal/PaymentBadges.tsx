import type { Payment, PaymentMethod, PaymentStatus } from '@/api/types';
import { Badge, type Tone } from '@/components/ui/Badge';
import { Icon, type IconName } from '@/components/ui/Icon';
import { PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from '@/lib/labels';
import styles from './PaymentBadges.module.css';

const STATUS_TONE: Record<PaymentStatus, Tone> = {
  PROCESSING: 'info',
  COMPLETED: 'success',
  PENDING_REVIEW: 'warning',
  DECLINED: 'danger',
  VOIDED: 'neutral',
};

export const METHOD_ICON: Record<PaymentMethod, IconName> = {
  CASH: 'cash',
  CARD: 'card',
  BANK_TRANSFER: 'bank',
  QR: 'qr',
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]} dot>
      {PAYMENT_STATUS_LABEL[status]}
    </Badge>
  );
}

// "Visa •••• 4242", "Bank •••• 9012" or "Cash": never more than the last four digits.
export function PaymentMethodLabel({ payment }: { payment: Pick<Payment, 'method' | 'instrumentBrand' | 'instrumentLast4'> }) {
  const brand =
    payment.method === 'CARD' && payment.instrumentBrand && payment.instrumentBrand !== 'UNKNOWN'
      ? payment.instrumentBrand.charAt(0) + payment.instrumentBrand.slice(1).toLowerCase()
      : PAYMENT_METHOD_LABEL[payment.method];
  return (
    <span className={styles.method}>
      <Icon name={METHOD_ICON[payment.method]} />
      {brand}
      {payment.instrumentLast4 && <span className="mono">•••• {payment.instrumentLast4}</span>}
    </span>
  );
}
