import { useSetUserActive } from '@/api/queries';
import type { User } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/errors';
import { ROLE_LABEL } from '@/lib/labels';
import styles from './TeamPage.module.css';

// Confirms deactivating or reactivating an account; the direction follows the current status.
export function UserStatusDialog({ user, onClose }: { user: User; onClose(): void }) {
  const setActive = useSetUserActive();
  const toast = useToast();
  const deactivating = user.isActive;

  function submit() {
    setActive.mutate(
      { id: user.id, isActive: !deactivating },
      {
        onSuccess: () => {
          toast.success(
            deactivating ? `${user.fullName} has been deactivated` : `${user.fullName} can sign in again`,
          );
          onClose();
        },
      },
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      onSubmit={submit}
      busy={setActive.isPending}
      title={deactivating ? `Deactivate ${user.fullName}?` : `Reactivate ${user.fullName}?`}
      description={
        deactivating
          ? "They're signed out straight away and can't sign in until an administrator reactivates them."
          : 'They can sign in again with their current password.'
      }
      footer={
        <>
          <Button onClick={onClose} disabled={setActive.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant={deactivating ? 'danger' : 'primary'}
            icon={deactivating ? 'power' : 'check'}
            loading={setActive.isPending}
          >
            {deactivating ? 'Deactivate account' : 'Reactivate account'}
          </Button>
        </>
      }
    >
      {setActive.isError && <Callout tone="danger">{errorMessage(setActive.error)}</Callout>}
      <dl className={styles.facts}>
        <dt>Email</dt>
        <dd>{user.email}</dd>
        <dt>Role</dt>
        <dd>{ROLE_LABEL[user.role]}</dd>
      </dl>
      {deactivating ? (
        <Callout>Their applications, decisions and audit history stay exactly as they are.</Callout>
      ) : (
        user.isLocked && (
          <Callout tone="warning" title="Also locked">
            This account is locked after too many wrong passwords. Unlock it too before they sign in.
          </Callout>
        )
      )}
    </Dialog>
  );
}
