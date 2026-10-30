import { useState } from 'react';
import { useAddMerchantUser } from '@/api/portalQueries';
import type { MerchantRole, User } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input } from '@/components/ui/Field';
import { errorMessage } from '@/lib/errors';
import { MERCHANT_ROLE_DESCRIPTION, MERCHANT_ROLE_LABEL } from '@/lib/labels';
import { MERCHANT_ROLES } from '@/lib/roles';
import styles from './MerchantTeam.module.css';

interface AddMemberDialogProps {
  onClose(): void;
  onAdded(user: User, temporaryPassword: string): void;
}

export function AddMemberDialog({ onClose, onAdded }: AddMemberDialogProps) {
  const add = useAddMerchantUser();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MerchantRole>('MERCHANT_SALES');
  const [attempted, setAttempted] = useState(false);
  const errors = {
    fullName: fullName.trim().length >= 2 ? undefined : 'Enter their full name.',
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? undefined : 'Enter a valid email address.',
  };

  function submit() {
    setAttempted(true);
    if (errors.fullName || errors.email) return;
    add.mutate(
      { fullName: fullName.trim(), email: email.trim(), role },
      { onSuccess: ({ user, temporaryPassword }) => onAdded(user, temporaryPassword) },
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      onSubmit={submit}
      busy={add.isPending}
      title="Add a person"
      description="They get a one-time password and choose their own when they first sign in."
      footer={
        <>
          <Button onClick={onClose} disabled={add.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={add.isPending}>
            Add person
          </Button>
        </>
      }
    >
      {add.isError && <Callout tone="danger">{errorMessage(add.error)}</Callout>}
      <Field label="Full name" error={attempted ? errors.fullName : undefined}>
        <Input value={fullName} onChange={(event) => setFullName(event.target.value)} autoFocus />
      </Field>
      <Field label="Work email" error={attempted ? errors.email : undefined}>
        <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="off" />
      </Field>
      <fieldset className={styles.roles}>
        <legend className={styles.legend}>Role</legend>
        {MERCHANT_ROLES.map((option) => (
          <label key={option} className={styles.role}>
            <input type="radio" name="role" value={option} checked={role === option} onChange={() => setRole(option)} />
            <span>
              <span className={styles.roleTitle}>{MERCHANT_ROLE_LABEL[option]}</span>
              <span className={styles.roleText}>{MERCHANT_ROLE_DESCRIPTION[option]}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </Dialog>
  );
}
