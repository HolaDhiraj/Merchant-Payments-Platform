import { useMerchantScope } from '@/api/merchantScope';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePayment, useReviewPayment } from '@/api/portalQueries';
import type { Payment } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { PaymentMethodLabel, PaymentStatusBadge } from '@/components/portal/PaymentBadges';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Field, Textarea } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { DetailList, Panel } from '@/components/ui/Panel';
import { PageLoader } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { NotFound } from '@/features/errors/NotAllowed';
import { ApiError } from '@/api/http';
import { errorMessage } from '@/lib/errors';
import { formatDateTime, formatMoney } from '@/lib/format';
import { FRAUD_DECISION_LABEL, FRAUD_REASON_LABEL, PAYMENT_METHOD_LABEL } from '@/lib/labels';
import styles from './Payments.module.css';

export function PaymentDetailPage() {
  const { id = '' } = useParams();
  const query = usePayment(id);
  if (query.isPending) return <PageLoader label="Loading payment" />;
  if (query.error instanceof ApiError && query.error.isNotFound) return <NotFound />;
  if (query.isError) return <Callout tone="danger">{errorMessage(query.error)}</Callout>;
  return <PaymentDetail payment={query.data} />;
}

function PaymentDetail({ payment }: { payment: Payment }) {
  const money = (minor: number) => formatMoney(minor, payment.currency);
  const { path } = useMerchantScope();

  return (
    <>
      <PageHeader
        back={{ to: path('/payments'), label: 'Payments' }}
        title={<span className="mono">{payment.reference}</span>}
        badge={<PaymentStatusBadge status={payment.status} />}
        subtitle={`${formatDateTime(payment.createdAt)} · taken by ${payment.cashier.name}`}
      />

      {payment.status === 'DECLINED' && (
        <Callout tone="danger" title={payment.declineReason ?? 'Declined'} className={styles.toolbar}>
          Nothing was collected for this payment.
        </Callout>
      )}

      <div className={styles.grid}>
        <div className={styles.column}>
          <Panel title="Items" flush>
            <table className={styles.items}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th className={styles.right}>Unit price</th>
                  <th className={styles.right}>Qty</th>
                  <th className={styles.right}>Total</th>
                </tr>
              </thead>
              <tbody>
                {payment.lines.map((line) => (
                  <tr key={line.sku}>
                    <td>
                      {line.name}
                      {line.discountPercent > 0 && (
                        <>
                          {' '}
                          <Badge tone="success">−{line.discountPercent}%</Badge>
                        </>
                      )}
                    </td>
                    <td className={`${styles.right} mono`}>{money(line.unitPriceMinor)}</td>
                    <td className={`${styles.right} tabular`}>{line.quantity}</td>
                    <td className={`${styles.right} mono`}>{money(line.lineTotalMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className={styles.sum}>
              <div>
                <dt>Subtotal</dt>
                <dd className="mono">{money(payment.subtotalMinor)}</dd>
              </div>
              {payment.discountMinor > 0 && (
                <div className={styles.saving}>
                  <dt>Discounts</dt>
                  <dd className="mono">−{money(payment.discountMinor)}</dd>
                </div>
              )}
              {payment.pointsDiscountMinor > 0 && (
                <div className={styles.saving}>
                  <dt>{payment.pointsRedeemed} loyalty points</dt>
                  <dd className="mono">−{money(payment.pointsDiscountMinor)}</dd>
                </div>
              )}
              <div className={styles.total}>
                <dt>Total</dt>
                <dd className="mono">{money(payment.totalMinor)}</dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Payment">
            <DetailList
              items={[
                ['Method', <PaymentMethodLabel payment={payment} />],
                ...(payment.amountTenderedMinor !== null
                  ? ([
                      ['Cash received', <span className="mono">{money(payment.amountTenderedMinor)}</span>],
                      ['Change given', <span className="mono">{money(payment.changeMinor ?? 0)}</span>],
                    ] as Array<[string, ReactNode]>)
                  : []),
                ['Authorization', payment.authorizationCode ? <span className="mono">{payment.authorizationCode}</span> : '—'],
                ['Completed', formatDateTime(payment.completedAt)],
              ]}
            />
          </Panel>
        </div>

        <div className={styles.column}>
          {payment.status === 'PENDING_REVIEW' && <ReviewPanel payment={payment} />}
          <FraudPanel payment={payment} />
          <Panel title="Customer">
            {payment.customer ? (
              <DetailList
                items={[
                  ['Name', <Link to={path(`/customers/${payment.customer.id}`)}>{payment.customer.name}</Link>],
                  ['Phone', <span className="mono">{payment.customer.phone}</span>],
                  ['Points used', payment.pointsRedeemed ? String(payment.pointsRedeemed) : '—'],
                  ['Points earned', payment.pointsEarned ? `+${payment.pointsEarned}` : '—'],
                ]}
              />
            ) : (
              <p className="tabular">Walk-in customer ({PAYMENT_METHOD_LABEL[payment.method].toLowerCase()}).</p>
            )}
          </Panel>
          {payment.review && (
            <Panel title="Review">
              <DetailList
                items={[
                  ['Reviewed by', payment.review.reviewerName],
                  ['When', formatDateTime(payment.review.reviewedAt)],
                  ['Note', payment.review.note ?? '—'],
                ]}
              />
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}

// How risky the payment looked, and why. Every point of the score has a reason.
function FraudPanel({ payment }: { payment: Payment }) {
  const { score, reasons, decision } = payment.fraud;
  const tone = decision === 'BLOCK' ? 'danger' : decision === 'REVIEW' ? 'warning' : 'success';
  return (
    <Panel title="Fraud screening" actions={<Badge tone={tone}>{FRAUD_DECISION_LABEL[decision]}</Badge>}>
      <div className={styles.meter}>
        <div className={styles.meterHead}>
          <span className={styles.score}>{score}</span>
          <span className="tabular">/ 100</span>
        </div>
        <div className={styles.track} role="img" aria-label={`Risk score ${score} of 100`}>
          <span className={styles.marker} style={{ left: `${score}%` }} />
        </div>
        <div className={styles.scale}>
          <span>Pass</span>
          <span>Review at 40</span>
          <span>Block at 70</span>
        </div>
      </div>
      {reasons.length > 0 ? (
        <ul className={styles.reasons}>
          {reasons.map((reason) => (
            <li key={reason}>
              <Icon name="alert" size={14} />
              {FRAUD_REASON_LABEL[reason] ?? reason}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.reasons}>No warning signs.</p>
      )}
    </Panel>
  );
}

function ReviewPanel({ payment }: { payment: Payment }) {
  const { hasRole } = useAuth();
  const review = useReviewPayment(payment.id);
  const toast = useToast();
  const [note, setNote] = useState('');
  const canReview = hasRole('MERCHANT_ADMIN', 'MERCHANT_REVIEWER');

  function decide(approve: boolean) {
    review.mutate(
      { approve, note: note.trim() || undefined },
      {
        onSuccess: () => toast.success(approve ? 'Payment approved and collected' : 'Payment voided; funds released'),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  }

  return (
    <Panel title="Needs your review">
      <Callout tone="warning">
        The customer's money is held. Approve to collect it, or void it to release the hold
        {payment.pointsRedeemed ? ' and give the points back' : ''}.
      </Callout>
      {canReview ? (
        <>
          <Field label="Note" optional className={styles.toolbar}>
            <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={500} placeholder="e.g. Checked ID" />
          </Field>
          <div className={styles.reviewActions}>
            <Button variant="primary" icon="check" loading={review.isPending && review.variables?.approve} disabled={review.isPending} onClick={() => decide(true)}>
              Approve
            </Button>
            <Button variant="danger" icon="close" loading={review.isPending && !review.variables?.approve} disabled={review.isPending} onClick={() => decide(false)}>
              Void
            </Button>
          </div>
        </>
      ) : (
        <p>A reviewer or your admin will look at it.</p>
      )}
    </Panel>
  );
}
