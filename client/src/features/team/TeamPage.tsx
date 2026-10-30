import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUsers } from '@/api/queries';
import type { Role } from '@/api/types';
import { useCurrentUser } from '@/auth/AuthProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { Panel } from '@/components/ui/Panel';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { Tabs } from '@/components/ui/Tabs';
import table from '@/components/ui/Table.module.css';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { ROLE_LABEL } from '@/lib/labels';
import { CreateUserDialog } from './CreateUserDialog';
import styles from './TeamPage.module.css';

type RoleFilter = Role | 'ALL';

export function TeamPage() {
  const me = useCurrentUser();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const role = (params.get('role') as Role | null) ?? undefined;
  const page = Math.max(1, Number(params.get('page')) || 1);
  const query = useUsers({ role, page });
  const data = query.data;

  function update(next: Record<string, string | undefined>) {
    const merged = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value) merged.set(key, value);
      else merged.delete(key);
    }
    setParams(merged, { replace: true });
  }

  const roleOptions: Array<{ value: RoleFilter; label: string }> = [
    { value: 'ALL', label: 'Everyone' },
    { value: 'SALES', label: 'Sales' },
    { value: 'REVIEWER', label: 'Reviewers' },
    { value: 'ADMIN', label: 'Admins' },
  ];

  return (
    <>
      <PageHeader
        title="Team"
        subtitle="People who can sign in to Merchant Desk."
        actions={
          <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
            Add person
          </Button>
        }
      />

      <div className={styles.toolbar}>
        <Tabs
          label="Filter by role"
          value={role ?? 'ALL'}
          options={roleOptions}
          onChange={(value) => update({ role: value === 'ALL' ? undefined : value, page: undefined })}
        />
      </div>

      {query.isError ? (
        <Callout tone="danger" title="Couldn't load the team">
          {errorMessage(query.error)}
        </Callout>
      ) : (
        <Panel flush>
          {data && data.totalItems === 0 ? (
            <EmptyState icon="users" title="Nobody with this role yet" />
          ) : (
            <>
              <div className={cx(table.wrap, query.isPlaceholderData && table.stale)}>
                <table className={table.table}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Added</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!data && <TableSkeleton columns={4} />}
                    {data?.items.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <span className={table.primary}>
                            {user.fullName}
                            {user.id === me.id && ' (you)'}
                          </span>
                          <span className={table.secondary}>{user.email}</span>
                        </td>
                        <td>
                          <Badge tone={user.role === 'ADMIN' ? 'accent' : 'outline'}>{ROLE_LABEL[user.role]}</Badge>
                        </td>
                        <td>
                          {user.isActive ? <Badge tone="success" dot>Active</Badge> : <Badge dot>Deactivated</Badge>}
                        </td>
                        <td className={table.muted}>{formatDate(user.createdAt)}</td>
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

      {creating && <CreateUserDialog onClose={() => setCreating(false)} />}
    </>
  );
}
