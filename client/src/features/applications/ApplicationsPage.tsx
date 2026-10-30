import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useApplications } from '@/api/queries';
import type { ApplicationStatus, User } from '@/api/types';
import { useCurrentUser } from '@/auth/AuthProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { Pagination } from '@/components/ui/Pagination';
import { Panel } from '@/components/ui/Panel';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { serialNumber } from '@/components/ui/tableSerial';
import { Tabs } from '@/components/ui/Tabs';
import table from '@/components/ui/Table.module.css';
import { cx } from '@/lib/cx';
import { formatMoney, formatRelative } from '@/lib/format';
import { STATUS_LABEL, STATUS_ORDER } from '@/lib/labels';
import { RiskSummary, StatusBadge } from './Badges';
import { canCreate } from './permissions';
import styles from './ApplicationsPage.module.css';

type StatusFilter = ApplicationStatus | 'ALL';
const PAGE_SIZE = 20;

const SUBTITLE: Record<User['role'], string> = {
  SALES: 'Merchants you are onboarding.',
  REVIEWER: 'Submitted merchants waiting on a risk decision.',
  ADMIN: 'Every merchant application across the team.',
};

export function ApplicationsPage() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const status = (params.get('status') as ApplicationStatus | null) ?? undefined;
  const assignedToMe = params.get('mine') === '1';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const query = useApplications({ status, assignedToMe: assignedToMe || undefined, page, pageSize: PAGE_SIZE });

  // Reviewers never see drafts, so that filter would always be empty for them.
  const statuses = STATUS_ORDER.filter((value) => user.role !== 'REVIEWER' || value !== 'DRAFT');
  const filterOptions: Array<{ value: StatusFilter; label: string }> = [
    { value: 'ALL', label: 'All' },
    ...statuses.map((value) => ({ value, label: STATUS_LABEL[value] })),
  ];

  function update(next: Record<string, string | null>) {
    const merged = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value === null) merged.delete(key);
      else merged.set(key, value);
    }
    setParams(merged, { replace: true });
  }

  const data = query.data;
  const isFiltered = Boolean(status || assignedToMe);

  return (
    <>
      <PageHeader
        title="Applications"
        subtitle={SUBTITLE[user.role]}
        actions={
          canCreate(user) && (
            <ButtonLink to="/applications/new" variant="primary" icon="plus">
              New application
            </ButtonLink>
          )
        }
      />

      <div className={styles.toolbar}>
        <Tabs
          label="Filter by status"
          value={status ?? 'ALL'}
          options={filterOptions}
          onChange={(value) => update({ status: value === 'ALL' ? null : value, page: null })}
        />
        {user.role === 'REVIEWER' && (
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={assignedToMe}
              onChange={(event) => update({ mine: event.target.checked ? '1' : null, page: null })}
            />
            Assigned to me
          </label>
        )}
      </div>

      {query.isError && (
        <Callout tone="danger" title="Couldn't load applications">
          {query.error.message}
        </Callout>
      )}

      {!query.isError && (
        <Panel flush>
          {data && data.totalItems === 0 ? (
            <EmptyState
              title={isFiltered ? 'No applications match this filter' : 'No applications yet'}
              action={
                !isFiltered &&
                canCreate(user) && (
                  <ButtonLink to="/applications/new" variant="primary" icon="plus">
                    Start an application
                  </ButtonLink>
                )
              }
            >
              {isFiltered
                ? 'Try another status, or clear the filter to see everything.'
                : 'Applications appear here once a merchant has been captured.'}
            </EmptyState>
          ) : (
            <>
              <div className={cx(table.wrap, query.isPlaceholderData && table.stale)}>
                <table className={table.table}>
                  <thead>
                    <tr>
                      <th className={table.serial}>S.No</th>
                      <th>Merchant</th>
                      <th>Status</th>
                      <th>Risk</th>
                      <th className={table.numeric}>Monthly volume</th>
                      <th>Last activity</th>
                      <th aria-hidden="true" />
                    </tr>
                  </thead>
                  <tbody>
                    {!data && <TableSkeleton columns={7} />}
                    {data?.items.map((application, index) => (
                      <tr
                        key={application.id}
                        className={table.clickable}
                        onClick={() => navigate(`/applications/${application.id}`)}
                      >
                        <td className={table.serial}>{serialNumber(data.page, data.pageSize, index)}</td>
                        <td>
                          {/* A real link keeps keyboard navigation and "open in new tab" working. */}
                          <Link
                            to={`/applications/${application.id}`}
                            className={table.primary}
                            onClick={(event) => event.stopPropagation()}
                          >
                            {application.businessName}
                          </Link>
                          <span className={table.secondary}>{application.legalBusinessName}</span>
                        </td>
                        <td>
                          <StatusBadge status={application.status} />
                        </td>
                        <td>
                          <RiskSummary application={application} />
                        </td>
                        <td className={cx(table.numeric, 'mono')}>
                          {formatMoney(application.processing.expectedMonthlyVolumeMinor, application.processing.currency)}
                        </td>
                        <td className={table.muted} title={application.updatedAt}>
                          {formatRelative(application.updatedAt)}
                        </td>
                        <td className={table.chevron}>
                          <Icon name="chevronRight" />
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
                  onChange={(next) => update({ page: next === 1 ? null : String(next) })}
                />
              )}
            </>
          )}
        </Panel>
      )}
    </>
  );
}
