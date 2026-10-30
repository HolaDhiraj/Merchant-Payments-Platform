import { useMerchantScope } from '@/api/merchantScope';
import { usePayments } from '@/api/portalQueries';
import type { PaymentMethod, PaymentStatus } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Field';
import { Panel } from '@/components/ui/Panel';
import { SearchField } from '@/components/ui/SearchField';
import { Tabs } from '@/components/ui/Tabs';
import { errorMessage } from '@/lib/errors';
import { PAYMENT_METHOD_LABEL } from '@/lib/labels';
import { useUrlFilters } from '@/lib/useUrlFilters';
import { PaymentsTable } from './PaymentsTable';
import styles from './Payments.module.css';

type StatusFilter = PaymentStatus | 'ALL';

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'COMPLETED', label: 'Paid' },
  { value: 'PENDING_REVIEW', label: 'Held for review' },
  { value: 'DECLINED', label: 'Declined' },
  { value: 'VOIDED', label: 'Voided' },
];

export function PaymentsPage() {
  const { hasRole } = useAuth();
  const { params, page, update } = useUrlFilters();
  const status = (params.get('status') as PaymentStatus | null) ?? undefined;
  const method = (params.get('method') as PaymentMethod | null) ?? undefined;
  const q = params.get('q') ?? '';
  const query = usePayments({ status, method, q: q || undefined, page, pageSize: 20 });
  const filtered = Boolean(status || method || q);
  const ownOnly = hasRole('MERCHANT_SALES');
  const { oversight } = useMerchantScope();

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle={oversight ? 'Every payment this merchant has taken.' : ownOnly ? 'Payments you have taken.' : 'Every payment taken at your business.'}
        actions={
          hasRole('MERCHANT_ADMIN', 'MERCHANT_SALES') && (
            <ButtonLink to="/portal/checkout" variant="primary" icon="cart">
              New sale
            </ButtonLink>
          )
        }
      />
      <div className={styles.toolbar}>
        <Tabs
          label="Filter by status"
          value={status ?? 'ALL'}
          options={STATUS_OPTIONS}
          onChange={(next) => update({ status: next === 'ALL' ? undefined : next, page: undefined })}
        />
        <div className={styles.filters}>
          <SearchField
            label="Search payments"
            placeholder="Reference, customer or phone"
            value={q}
            onSearch={(value) => update({ q: value || undefined, page: undefined })}
          />
          <Select
            aria-label="Payment method"
            className={styles.methodFilter}
            value={method ?? ''}
            onChange={(event) => update({ method: event.target.value || undefined, page: undefined })}
          >
            <option value="">All methods</option>
            {(['CASH', 'CARD', 'BANK_TRANSFER'] as PaymentMethod[]).map((value) => (
              <option key={value} value={value}>
                {PAYMENT_METHOD_LABEL[value]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {query.isError ? (
        <Callout tone="danger" title="Couldn't load payments">
          {errorMessage(query.error)}
        </Callout>
      ) : (
        <Panel flush>
          {query.data && query.data.totalItems === 0 ? (
            <EmptyState icon="receipt" title={filtered ? 'No matching payments' : 'No payments yet'}>
              {filtered ? 'Try another filter.' : 'Payments taken at the till appear here.'}
            </EmptyState>
          ) : (
            <PaymentsTable
              data={query.data}
              stale={query.isPlaceholderData}
              onPage={(next) => update({ page: next === 1 ? undefined : String(next) })}
            />
          )}
        </Panel>
      )}
    </>
  );
}
