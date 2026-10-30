import { useMerchantScope } from '@/api/merchantScope';
import { Link, useNavigate } from 'react-router-dom';
import { useCustomers, useMerchantProfile } from '@/api/portalQueries';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Callout } from '@/components/ui/Callout';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { Pagination } from '@/components/ui/Pagination';
import { Panel } from '@/components/ui/Panel';
import { SearchField } from '@/components/ui/SearchField';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { serialNumber } from '@/components/ui/tableSerial';
import table from '@/components/ui/Table.module.css';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { formatMoney, formatRelative } from '@/lib/format';
import { useUrlFilters } from '@/lib/useUrlFilters';
import styles from './Customers.module.css';

export function CustomersPage() {
  const { params, page, update } = useUrlFilters();
  const q = params.get('q') ?? '';
  const query = useCustomers({ q: q || undefined, page });
  const currency = useMerchantProfile().data?.currency ?? 'USD';
  const navigate = useNavigate();
  const { path, oversight } = useMerchantScope();
  const data = query.data;

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle={oversight ? 'People who have paid this merchant, with their loyalty points.' : 'People who have paid you, found by phone number at the till.'}
      />
      <div className={styles.toolbar}>
        <SearchField label="Search customers" placeholder="Name or phone" value={q} onSearch={(value) => update({ q: value || undefined, page: undefined })} />
      </div>
      {query.isError ? (
        <Callout tone="danger" title="Couldn't load customers">
          {errorMessage(query.error)}
        </Callout>
      ) : (
        <Panel flush>
          {data && data.totalItems === 0 ? (
            <EmptyState icon="users" title={q ? 'No matching customers' : 'No customers yet'}>
              {q ? 'Try a different name or number.' : 'Customers are added when you take a payment with their phone number.'}
            </EmptyState>
          ) : (
            <>
              <div className={cx(table.wrap, query.isPlaceholderData && table.stale)}>
                <table className={table.table}>
                  <thead>
                    <tr>
                      <th className={table.serial}>S.No</th>
                      <th>Customer</th>
                      <th>Points</th>
                      <th className={table.numeric}>Visits</th>
                      <th className={table.numeric}>Total spent</th>
                      <th>Last purchase</th>
                      <th aria-hidden="true" />
                    </tr>
                  </thead>
                  <tbody>
                    {!data && <TableSkeleton columns={7} />}
                    {data?.items.map((customer, index) => (
                      <tr key={customer.id} className={table.clickable} onClick={() => navigate(path(`/customers/${customer.id}`))}>
                        <td className={table.serial}>{serialNumber(data.page, data.pageSize, index)}</td>
                        <td>
                          <Link to={path(`/customers/${customer.id}`)} className={table.primary} onClick={(event) => event.stopPropagation()}>
                            {customer.fullName}
                          </Link>
                          <span className={cx(table.secondary, 'mono')}>{customer.phone}</span>
                        </td>
                        <td>
                          <Badge tone={customer.pointsBalance > 0 ? 'accent' : 'neutral'}>
                            <Icon name="gift" size={12} />
                            {customer.pointsBalance.toLocaleString('en')}
                          </Badge>
                        </td>
                        <td className={cx(table.numeric, 'tabular')}>{customer.visitCount}</td>
                        <td className={cx(table.numeric, 'mono')}>{formatMoney(customer.totalSpentMinor, currency)}</td>
                        <td className={table.muted}>{formatRelative(customer.lastPurchaseAt)}</td>
                        <td className={table.chevron}>
                          <Icon name="chevronRight" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data && (
                <Pagination page={data.page} pageSize={data.pageSize} totalItems={data.totalItems} totalPages={data.totalPages} onChange={(next) => update({ page: next === 1 ? undefined : String(next) })} />
              )}
            </>
          )}
        </Panel>
      )}
    </>
  );
}
