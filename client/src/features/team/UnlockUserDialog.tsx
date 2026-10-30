import { useUnlockUser } from '@/api/queries';
import type { User } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import styles from './TeamPage.module.css';

// Confirms lifting a sign-in lockout. The person keeps their current password.
export function UnlockUserDialog({ user, onClose }: { user: User; onClose(): void }) {
  const unlock = useUnlockUser();
  const toast = useToast();

  function submit() {
    unlock.mutate(user.id, {
      onSuccess: () => {
        toast.success(`${user.fullName} can sign in again`);
        onClose();
      },
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      onSubmit={submit}
      busy={unlock.isPending}
      title={`Unlock ${user.fullName}?`}
      description="They can sign in again straight away with their current password."
      footer={
        <>
          <Button onClick={onClose} disabled={unlock.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" icon="unlock" loading={unlock.isPending}>
            Unlock account
          </Button>
        </>
      }
    >
      {unlock.isError && <Callout tone="danger">{errorMessage(unlock.error)}</Callout>}
      <dl className={styles.facts}>
        <dt>Email</dt>
        <dd>{user.email}</dd>
        <dt>Locked</dt>
        <dd>{user.lockedAt ? formatDateTime(user.lockedAt) : '—'}</dd>
      </dl>
      <Callout tone="warning" title="Check it was them">
        Accounts lock after repeated wrong passwords. If the person doesn't recognise those attempts, give them a
        new password instead of unlocking.
      </Callout>
    </Dialog>
  );
}
