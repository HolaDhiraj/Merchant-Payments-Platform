import { useMerchantScope } from '@/api/merchantScope';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError } from '@/api/http';
import { useCustomer, useCustomerPoints, useMerchantProfile, usePayments } from '@/api/portalQueries';
import type { Customer } from '@/api/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatTile } from '@/components/portal/StatTile';
import { Badge } from '@/components/ui/Badge';
import { Callout } from '@/components/ui/Callout';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { Panel } from '@/components/ui/Panel';
import { PageLoader } from '@/components/ui/Spinner';
import { NotFound } from '@/features/errors/NotAllowed';
import { errorMessage } from '@/lib/errors';
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';
import { LOYALTY_ENTRY_LABEL } from '@/lib/labels';
import { PaymentsTable } from '../payments/PaymentsTable';
import styles from './Customers.module.css';

export function CustomerDetailPage() {
  const { id = '' } = useParams();
  const customer = useCustomer(id);
  if (customer.isPending) return <PageLoader label="Loading customer" />;
  if (customer.error instanceof ApiError && customer.error.isNotFound) return <NotFound />;
  if (customer.isError) return <Callout tone="danger">{errorMessage(customer.error)}</Callout>;
  return <CustomerDetail customer={customer.data} />;
}

function CustomerDetail({ customer }: { customer: Customer }) {
  const merchant = useMerchantProfile();
  const currency = merchant.data?.currency ?? 'USD';
  const pointValue = merchant.data?.loyalty.pointValueMinor ?? 0;
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [pointsPage, setPointsPage] = useState(1);
  const payments = usePayments({ customerId: customer.id, page: paymentsPage, pageSize: 10 });
  const points = useCustomerPoints(customer.id, pointsPage);
  const { path } = useMerchantScope();
  const average = customer.visitCount ? Math.round(customer.totalSpentMinor / customer.visitCount) : 0;

  return (
    <>
      <PageHeader
        back={{ to: path('/customers'), label: 'Customers' }}
        title={customer.fullName}
        subtitle={
          <span>
            <span className="mono">{customer.phone}</span>
            {customer.email && ` · ${customer.email}`} · customer since {formatDate(customer.createdAt)}
          </span>
        }
      />
      <div className={styles.stats}>
        <StatTile
          label="Points balance"
          value={customer.pointsBalance.toLocaleString('en')}
          hint={pointValue ? `Worth ${formatMoney(customer.pointsBalance * pointValue, currency)}` : undefined}
          accent
        />
        <StatTile label="Total spent" value={formatMoney(customer.totalSpentMinor, currency)} />
        <StatTile label="Visits" value={String(customer.visitCount)} hint={average ? `${formatMoney(average, currency)} on average` : undefined} />
        <StatTile label="Last purchase" value={customer.lastPurchaseAt ? formatDate(customer.lastPurchaseAt) : '—'} />
      </div>

      <div className={styles.grid}>
        <Panel title="Purchases" flush>
          {payments.isError ? (
            <Callout tone="danger">{errorMessage(payments.error)}</Callout>
          ) : payments.data && payments.data.totalItems === 0 ? (
            <EmptyState icon="receipt" title="No purchases yet" />
          ) : (
            <PaymentsTable data={payments.data} stale={payments.isPlaceholderData} showCustomer={false} onPage={setPaymentsPage} />
          )}
        </Panel>

        <Panel title="Points history" flush>
          {points.data && points.data.totalItems === 0 ? (
            <EmptyState icon="gift" title="No points yet">
              Points are earned on every completed purchase.
            </EmptyState>
          ) : (
            <>
              <ul className={styles.ledger}>
                {points.data?.items.map((entry) => (
                  <li key={entry.id}>
                    <div>
                      <Badge tone={entry.points > 0 ? 'success' : 'warning'}>{LOYALTY_ENTRY_LABEL[entry.type]}</Badge>
                      <span className={styles.ledgerDate}>{formatDateTime(entry.createdAt)}</span>
                    </div>
                    <div className={styles.ledgerPoints}>
                      <strong className={entry.points > 0 ? styles.plus : styles.minus}>
                        {entry.points > 0 ? '+' : ''}
                        {entry.points}
                      </strong>
                      <span>balance {entry.balanceAfter}</span>
                    </div>
                  </li>
                ))}
              </ul>
              {points.data && (
                <Pagination page={points.data.page} pageSize={points.data.pageSize} totalItems={points.data.totalItems} totalPages={points.data.totalPages} onChange={setPointsPage} />
              )}
            </>
          )}
        </Panel>
      </div>
    </>
  );
}
