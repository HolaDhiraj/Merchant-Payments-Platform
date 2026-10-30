import { useMerchantScope } from '@/api/merchantScope';
import { Link, useNavigate } from 'react-router-dom';
import type { Page, Payment } from '@/api/types';
import { PaymentMethodLabel, PaymentStatusBadge } from '@/components/portal/PaymentBadges';
import { Icon } from '@/components/ui/Icon';
import { Pagination } from '@/components/ui/Pagination';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { serialNumber } from '@/components/ui/tableSerial';
import table from '@/components/ui/Table.module.css';
import { cx } from '@/lib/cx';
import { formatDateTime, formatMoney, formatRelative } from '@/lib/format';

interface PaymentsTableProps {
  data: Page<Payment> | undefined;
  stale: boolean;
  showCustomer?: boolean;
  onPage(page: number): void;
}

// Shared by the payments page and a customer's history.
export function PaymentsTable({ data, stale, showCustomer = true, onPage }: PaymentsTableProps) {
  const navigate = useNavigate();
  const { path } = useMerchantScope();
  return (
    <>
      <div className={cx(table.wrap, stale && table.stale)}>
        <table className={table.table}>
          <thead>
            <tr>
              <th className={table.serial}>S.No</th>
              <th>Payment</th>
              {showCustomer && <th>Customer</th>}
              <th>Method</th>
              <th>Status</th>
              <th className={table.numeric}>Amount</th>
              <th aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {!data && <TableSkeleton columns={showCustomer ? 7 : 6} />}
            {data?.items.map((payment, index) => (
              <tr key={payment.id} className={table.clickable} onClick={() => navigate(path(`/payments/${payment.id}`))}>
                <td className={table.serial}>{serialNumber(data.page, data.pageSize, index)}</td>
                <td>
                  <Link
                    to={path(`/payments/${payment.id}`)}
                    className={cx(table.primary, 'mono')}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {payment.reference}
                  </Link>
                  <span className={table.secondary} title={formatDateTime(payment.createdAt)}>
                    {formatRelative(payment.createdAt)} · {payment.cashier.name}
                  </span>
                </td>
                {showCustomer && (
                  <td>
                    {payment.customer ? (
                      <>
                        {payment.customer.name}
                        <span className={cx(table.secondary, 'mono')}>{payment.customer.phone}</span>
                      </>
                    ) : (
                      <span className={table.muted}>Walk-in</span>
                    )}
                  </td>
                )}
                <td>
                  <PaymentMethodLabel payment={payment} />
                </td>
                <td>
                  <PaymentStatusBadge status={payment.status} />
                </td>
                <td className={cx(table.numeric, 'mono')}>{formatMoney(payment.totalMinor, payment.currency)}</td>
                <td className={table.chevron}>
                  <Icon name="chevronRight" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && (
        <Pagination page={data.page} pageSize={data.pageSize} totalItems={data.totalItems} totalPages={data.totalPages} onChange={onPage} />
      )}
    </>
  );
}
