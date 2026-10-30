import { useMerchantScope } from '@/api/merchantScope';
import { useState } from 'react';
import { useMerchantUsers, useResetMerchantUserPassword, useSetMerchantUserActive } from '@/api/portalQueries';
import type { MerchantRole, User } from '@/api/types';
import { useCurrentUser } from '@/auth/AuthProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { CredentialsDialog } from '@/components/portal/CredentialsDialog';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { Panel } from '@/components/ui/Panel';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { serialNumber } from '@/components/ui/tableSerial';
import { useToast } from '@/components/ui/Toast';
import table from '@/components/ui/Table.module.css';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { MERCHANT_ROLE_LABEL } from '@/lib/labels';
import { useUrlFilters } from '@/lib/useUrlFilters';
import { AddMemberDialog } from './AddMemberDialog';
import styles from './MerchantTeam.module.css';

interface Issued {
  title: string;
  description: string;
  email: string;
  temporaryPassword: string;
}

function MemberStatus({ user }: { user: User }) {
  if (!user.isActive) return <Badge dot>Deactivated</Badge>;
  if (user.isLocked) return <Badge tone="danger" dot>Locked</Badge>;
  if (user.mustChangePassword) return <Badge tone="warning" dot>Invited</Badge>;
  return (
    <Badge tone="success" dot>
      Active
    </Badge>
  );
}

// The merchant admin's people: who can take payments, review and manage the business.
export function MerchantTeamPage() {
  const me = useCurrentUser();
  const { oversight } = useMerchantScope();
  const { page, update } = useUrlFilters();
  const query = useMerchantUsers(page);
  const setActive = useSetMerchantUserActive();
  const resetPassword = useResetMerchantUserPassword();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [deactivating, setDeactivating] = useState<User | null>(null);
  const data = query.data;

  function changeStatus(user: User) {
    setActive.mutate(
      { id: user.id, isActive: !user.isActive },
      {
        onSuccess: () => {
          toast.success(user.isActive ? `${user.fullName} deactivated` : `${user.fullName} can sign in again`);
          setDeactivating(null);
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  }

  // Deactivating signs someone out immediately, so it asks first; reactivating does not.
  const toggleActive = (user: User) => (user.isActive ? setDeactivating(user) : changeStatus(user));

  function newPassword(user: User) {
    resetPassword.mutate(user.id, {
      onSuccess: (result) =>
        setIssued({
          title: 'New temporary password',
          description: `${user.fullName}'s old password no longer works${user.isLocked ? ', and the lock is lifted' : ''}.`,
          email: result.email,
          temporaryPassword: result.temporaryPassword,
        }),
      onError: (error) => toast.error(errorMessage(error)),
    });
  }

  return (
    <>
      <PageHeader
        title="Team"
        subtitle={oversight ? 'People who can sign in to this merchant\'s portal.' : 'People who can sign in to your merchant portal.'}
        actions={
          !oversight && (
            <Button variant="primary" icon="plus" onClick={() => setAdding(true)}>
              Add person
            </Button>
          )
        }
      />
      {query.isError ? (
        <Callout tone="danger" title="Couldn't load the team">
          {errorMessage(query.error)}
        </Callout>
      ) : (
        <Panel flush>
          <div className={cx(table.wrap, query.isPlaceholderData && table.stale)}>
            <table className={table.table}>
              <thead>
                <tr>
                  <th className={table.serial}>S.No</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Added</th>
                  <th>
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {!data && <TableSkeleton columns={6} rows={3} />}
                {data?.items.map((user, index) => (
                  <tr key={user.id}>
                    <td className={table.serial}>{serialNumber(data.page, data.pageSize, index)}</td>
                    <td>
                      <span className={table.primary}>
                        {user.fullName}
                        {user.id === me.id && ' (you)'}
                      </span>
                      <span className={table.secondary}>{user.email}</span>
                    </td>
                    <td>
                      <Badge tone={user.role === 'MERCHANT_ADMIN' ? 'accent' : 'outline'}>
                        {MERCHANT_ROLE_LABEL[user.role as MerchantRole]}
                      </Badge>
                    </td>
                    <td>
                      <MemberStatus user={user} />
                    </td>
                    <td className={table.muted}>{formatDate(user.createdAt)}</td>
                    <td className={styles.actions}>
                      {user.id !== me.id && !oversight && (
                        <div className={styles.actionGroup}>
                          {user.isActive && (
                            <Button
                              size="sm"
                              variant="ghost"
                              icon="shield"
                              loading={resetPassword.isPending && resetPassword.variables === user.id}
                              onClick={() => newPassword(user)}
                            >
                              New password
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant={user.isActive ? 'ghost' : 'secondary'}
                            icon={user.isActive ? 'power' : 'check'}
                            loading={setActive.isPending && setActive.variables?.id === user.id}
                            onClick={() => toggleActive(user)}
                          >
                            {user.isActive ? 'Deactivate' : 'Reactivate'}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data && (
            <Pagination page={data.page} pageSize={data.pageSize} totalItems={data.totalItems} totalPages={data.totalPages} onChange={(next) => update({ page: next === 1 ? undefined : String(next) })} />
          )}
        </Panel>
      )}

      {adding && (
        <AddMemberDialog
          onClose={() => setAdding(false)}
          onAdded={(user, temporaryPassword) => {
            setAdding(false);
            setIssued({
              title: `${user.fullName} added`,
              description: `Give them these details to sign in as ${MERCHANT_ROLE_LABEL[user.role as MerchantRole].toLowerCase()}.`,
              email: user.email,
              temporaryPassword,
            });
          }}
        />
      )}
      {issued && <CredentialsDialog {...issued} onClose={() => setIssued(null)} />}
      {deactivating && (
        <ConfirmDialog
          title={`Deactivate ${deactivating.fullName}?`}
          confirmLabel="Deactivate"
          danger
          busy={setActive.isPending}
          onConfirm={() => changeStatus(deactivating)}
          onClose={() => setDeactivating(null)}
        >
          They are signed out straight away and can't sign in until you reactivate them. Their past payments stay as they
          are.
        </ConfirmDialog>
      )}
    </>
  );
}
