import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMerchants, useResetOwnerPassword } from '@/api/portalQueries';
import type { Merchant } from '@/api/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { CredentialsDialog } from '@/components/portal/CredentialsDialog';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { Panel } from '@/components/ui/Panel';
import { SearchField } from '@/components/ui/SearchField';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { serialNumber } from '@/components/ui/tableSerial';
import { useToast } from '@/components/ui/Toast';
import table from '@/components/ui/Table.module.css';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { useUrlFilters } from '@/lib/useUrlFilters';
import styles from './MerchantsPage.module.css';

// Platform admins: every merchant opened from an approved application. A row opens the
// merchant's workspace, where the admin monitors its sales, customers, catalogue and team.
export function MerchantsPage() {
  const { params, page, update } = useUrlFilters();
  const q = params.get('q') ?? '';
  const query = useMerchants({ q: q || undefined, page });
  const resetPassword = useResetOwnerPassword();
  const toast = useToast();
  const navigate = useNavigate();
  const [issued, setIssued] = useState<{ merchant: Merchant; email: string; temporaryPassword: string } | null>(null);
  const data = query.data;

  function newOwnerPassword(merchant: Merchant) {
    resetPassword.mutate(merchant.id, {
      onSuccess: (result) => setIssued({ merchant, ...result }),
      onError: (error) => toast.error(errorMessage(error)),
    });
  }

  return (
    <>
      <PageHeader title="Merchants" subtitle="Businesses onboarded from approved applications. Open one to monitor its payments, customers and products." />
      <div className={styles.toolbar}>
        <SearchField
          label="Search merchants"
          placeholder="Name or owner email"
          value={q}
          onSearch={(value) => update({ q: value || undefined, page: undefined })}
        />
      </div>

      {query.isError ? (
        <Callout tone="danger" title="Couldn't load merchants">
          {errorMessage(query.error)}
        </Callout>
      ) : (
        <Panel flush>
          {data && data.totalItems === 0 ? (
            <EmptyState icon="store" title={q ? 'No merchants match' : 'No merchants yet'}>
              {q ? 'Try another name or email.' : 'Approving an application opens its merchant account here.'}
            </EmptyState>
          ) : (
            <>
              <div className={cx(table.wrap, query.isPlaceholderData && table.stale)}>
                <table className={table.table}>
                  <thead>
                    <tr>
                      <th className={table.serial}>S.No</th>
                      <th>Merchant</th>
                      <th>Owner</th>
                      <th>Accepts</th>
                      <th>Currency</th>
                      <th>Opened</th>
                      <th>
                        <span className="visually-hidden">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {!data && <TableSkeleton columns={7} />}
                    {data?.items.map((merchant, index) => (
                      <tr
                        key={merchant.id}
                        className={table.clickable}
                        onClick={() => navigate(`/merchants/${merchant.id}`)}
                      >
                        <td className={table.serial}>{serialNumber(data.page, data.pageSize, index)}</td>
                        <td>
                          <Link
                            to={`/merchants/${merchant.id}`}
                            className={table.primary}
                            onClick={(event) => event.stopPropagation()}
                          >
                            {merchant.tradingName}
                          </Link>
                          <span className={table.secondary}>{merchant.legalName}</span>
                        </td>
                        <td>
                          {merchant.contactName}
                          <span className={table.secondary}>{merchant.contactEmail}</span>
                        </td>
                        <td>
                          <span className={styles.methods}>
                            {merchant.acceptedMethods.cash && <Badge tone="outline">Cash</Badge>}
                            {merchant.acceptedMethods.card && <Badge tone="outline">Card</Badge>}
                            {merchant.acceptedMethods.bankTransfer && <Badge tone="outline">Bank</Badge>}
                          </span>
                        </td>
                        <td className="mono">{merchant.currency}</td>
                        <td className={table.muted}>{formatDate(merchant.createdAt)}</td>
                        <td className={styles.actions}>
                          <Button
                            size="sm"
                            variant="ghost"
                            icon="shield"
                            loading={resetPassword.isPending && resetPassword.variables === merchant.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              newOwnerPassword(merchant);
                            }}
                          >
                            New owner password
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data && (
                <Pagination
                  page={data.page}
                  pageSize={data.pageSize}
                  totalItems={data.totalItems}
                  totalPages={data.totalPages}
                  onChange={(next) => update({ page: next === 1 ? undefined : String(next) })}
                />
              )}
            </>
          )}
        </Panel>
      )}

      {issued && (
        <CredentialsDialog
          title="New owner password"
          description={`Owner sign-in for ${issued.merchant.tradingName}. The previous password no longer works.`}
          email={issued.email}
          temporaryPassword={issued.temporaryPassword}
          onClose={() => setIssued(null)}
        />
      )}
    </>
  );
}
