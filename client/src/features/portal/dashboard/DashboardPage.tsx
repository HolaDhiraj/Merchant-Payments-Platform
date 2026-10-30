import { useMerchantScope } from '@/api/merchantScope';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMerchantProfile, usePayments, useSalesSummary } from '@/api/portalQueries';
import type { SalesSummary } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatTile } from '@/components/portal/StatTile';
import { ButtonLink } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { EmptyState } from '@/components/ui/EmptyState';
import { Panel } from '@/components/ui/Panel';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs } from '@/components/ui/Tabs';
import { errorMessage } from '@/lib/errors';
import { formatMoney } from '@/lib/format';
import { PAYMENT_METHOD_LABEL } from '@/lib/labels';
import { PaymentsTable } from '../payments/PaymentsTable';
import { BarList, ColumnChart } from './ColumnChart';
import styles from './Dashboard.module.css';

type Range = '7' | '14' | '30';

const dayLabel = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' });
const dayTitle = new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric', month: 'short' });
// "2026-10-30" is a calendar day in the merchant's time zone; parse it as such, not as UTC midnight.
const asLocalDay = (date: string) => new Date(`${date}T12:00:00`);

export function DashboardPage() {
  const [range, setRange] = useState<Range>('14');
  const summary = useSalesSummary(Number(range));
  const merchant = useMerchantProfile();
  const { hasRole } = useAuth();
  const recent = usePayments({ page: 1, pageSize: 5 });
  const { path, oversight } = useMerchantScope();

  return (
    <>
      <PageHeader
        title={merchant.data && !oversight ? `Good to see you, ${merchant.data.tradingName}` : 'Overview'}
        subtitle="Money collected, how customers pay and what sells."
        actions={
          hasRole('MERCHANT_ADMIN') && (
            <ButtonLink to="/portal/checkout" variant="primary" icon="cart">
              New sale
            </ButtonLink>
          )
        }
      />
      {summary.isError ? (
        <Callout tone="danger" title="Couldn't load your figures">
          {errorMessage(summary.error)}
        </Callout>
      ) : !summary.data ? (
        <div className={styles.loading}>
          <Skeleton height={120} />
          <Skeleton height={260} />
        </div>
      ) : (
        <Overview summary={summary.data} range={range} onRange={setRange} stale={summary.isPlaceholderData} />
      )}

      <Panel
        title="Latest payments"
        flush
        actions={<Link to={path('/payments')}>See all</Link>}
        className={styles.recent}
      >
        {recent.data && recent.data.totalItems === 0 ? (
          <EmptyState icon="receipt" title="No payments yet">
            {oversight ? 'This merchant has not taken a payment yet.' : 'Your first sale will show up here.'}
          </EmptyState>
        ) : (
          <PaymentsTable data={recent.data} stale={false} onPage={() => undefined} />
        )}
      </Panel>
    </>
  );
}

function Overview({ summary, range, onRange, stale }: { summary: SalesSummary; range: Range; onRange(range: Range): void; stale: boolean }) {
  const { path, oversight } = useMerchantScope();
  const money = (minor: number) => formatMoney(minor, summary.currency);
  const compact = (minor: number) => formatMoney(minor, summary.currency, { compact: true });
  const todayKey = summary.daily.at(-1)?.date;
  const periodTotal = summary.daily.reduce((sum, day) => sum + day.collectedMinor, 0);

  return (
    <div className={stale ? styles.stale : undefined}>
      {summary.pendingReview.count > 0 && (
        <Callout tone="warning" icon="shield" title={`${summary.pendingReview.count} payment${summary.pendingReview.count === 1 ? '' : 's'} held for review`} className={styles.callout}>
          {money(summary.pendingReview.collectedMinor)} is waiting for a reviewer.{' '}
          <Link to={path('/payments?status=PENDING_REVIEW')}>{oversight ? 'See them' : 'Review now'}</Link>
        </Callout>
      )}

      <section className={styles.headline} aria-label="Collected today">
        <div className={styles.hero}>
          <span className={styles.heroLabel}>Collected today</span>
          <span className={styles.heroValue}>{money(summary.today.collectedMinor)}</span>
          <span className={styles.heroHint}>
            {summary.today.count} {summary.today.count === 1 ? 'payment' : 'payments'}
            {summary.declinedToday > 0 && ` · ${summary.declinedToday} declined`}
          </span>
        </div>
        <div className={styles.tiles}>
          <StatTile label="Last 7 days" value={money(summary.last7Days.collectedMinor)} hint={`${summary.last7Days.count} payments`} />
          <StatTile label="Last 30 days" value={money(summary.last30Days.collectedMinor)} hint={`${summary.last30Days.count} payments`} />
          <StatTile label="All time" value={money(summary.allTime.collectedMinor)} hint={`${summary.allTime.count} payments`} />
          <StatTile label="Average sale" value={money(summary.averageTicketMinor)} hint="Across all completed payments" />
        </div>
      </section>

      <div className={styles.grid}>
        <Panel
          title="Collected per day"
          description={`${money(periodTotal)} in the last ${range} days`}
          actions={
            <Tabs
              label="Period"
              value={range}
              options={[
                { value: '7', label: '7 days' },
                { value: '14', label: '14 days' },
                { value: '30', label: '30 days' },
              ]}
              onChange={onRange}
            />
          }
          className={styles.wide}
        >
          <ColumnChart
            caption={`Money collected per day, last ${range} days`}
            highlightKey={todayKey}
            formatValue={money}
            formatTick={compact}
            columns={summary.daily.map((day) => ({
              key: day.date,
              label: day.date === todayKey ? 'Today' : dayLabel.format(asLocalDay(day.date)),
              title: dayTitle.format(asLocalDay(day.date)),
              value: day.collectedMinor,
              detail: `${day.count} ${day.count === 1 ? 'payment' : 'payments'}`,
            }))}
          />
        </Panel>

        <Panel title="How customers pay" description={`Last ${range} days`}>
          {summary.byMethod.length === 0 ? (
            <p className={styles.muted}>No completed payments in this period.</p>
          ) : (
            <BarList
              caption="Collected by payment method"
              rows={summary.byMethod.map((row) => ({
                key: row.method,
                label: PAYMENT_METHOD_LABEL[row.method],
                value: row.collectedMinor,
                valueLabel: money(row.collectedMinor),
                detail: `${row.count} payments`,
              }))}
            />
          )}
        </Panel>

        <Panel title="Best sellers" description={`By revenue, last ${range} days`}>
          {summary.topProducts.length === 0 ? (
            <p className={styles.muted}>No sales in this period.</p>
          ) : (
            <BarList
              caption="Top products by revenue"
              rows={summary.topProducts.map((product) => ({
                key: product.name,
                label: product.name,
                value: product.revenueMinor,
                valueLabel: money(product.revenueMinor),
                detail: `${product.quantity} sold`,
              }))}
            />
          )}
        </Panel>

        <Panel title="Loyalty & savings" description={`Last ${range} days`} className={styles.wide}>
          <div className={styles.miniStats}>
            <StatTile label="Customers served" value={summary.customersServed.toLocaleString('en')} />
            <StatTile label="Discounts given" value={money(summary.discountsGivenMinor)} />
            <StatTile label="Paid with points" value={money(summary.pointsRedeemedMinor)} />
            <StatTile label="Held for review" value={money(summary.pendingReview.collectedMinor)} hint={`${summary.pendingReview.count} payments, not yet collected`} />
          </div>
        </Panel>
      </div>
    </div>
  );
}
