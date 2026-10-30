import { useState } from 'react';
import type { FormEvent } from 'react';
import { useChangePassword } from '@/api/portalQueries';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Field, PasswordInput } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import styles from './ChangePasswordForm.module.css';

// Same policy as the API: 12+ characters with letters and digits, different from the current one.
const RULES: Array<{ label: string; test(next: string, current: string): boolean }> = [
  { label: 'At least 12 characters', test: (next) => next.length >= 12 },
  { label: 'Letters and digits', test: (next) => /[A-Za-z]/.test(next) && /\d/.test(next) },
  { label: 'Different from the current password', test: (next, current) => next.length > 0 && next !== current },
];

interface ChangePasswordFormProps {
  currentLabel?: string;
  submitLabel?: string;
  onChanged(): void;
}

export function ChangePasswordForm({
  currentLabel = 'Current password',
  submitLabel = 'Change password',
  onChanged,
}: ChangePasswordFormProps) {
  const change = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [attempted, setAttempted] = useState(false);

  const rulesMet = RULES.every((rule) => rule.test(next, current));
  const mismatch = confirm.length > 0 && confirm !== next;

  function submit(event: FormEvent) {
    event.preventDefault();
    setAttempted(true);
    if (!current || !rulesMet || next !== confirm) return;
    change.mutate(
      { currentPassword: current, newPassword: next },
      {
        onSuccess: () => {
          setCurrent('');
          setNext('');
          setConfirm('');
          setAttempted(false);
          onChanged();
        },
      },
    );
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {change.isError && <Callout tone="danger">{errorMessage(change.error)}</Callout>}
      <Field label={currentLabel} error={attempted && !current ? 'Enter your current password.' : undefined}>
        <PasswordInput value={current} onChange={(event) => setCurrent(event.target.value)} autoComplete="current-password" autoFocus />
      </Field>
      <Field label="New password">
        <PasswordInput value={next} onChange={(event) => setNext(event.target.value)} autoComplete="new-password" />
      </Field>
      <ul className={styles.rules} aria-label="Password requirements">
        {RULES.map((rule) => {
          const met = rule.test(next, current);
          return (
            <li key={rule.label} className={cx(met && styles.met, attempted && !met && styles.missed)}>
              <Icon name={met ? 'check' : 'close'} size={13} />
              {rule.label}
            </li>
          );
        })}
      </ul>
      <Field label="Confirm new password" error={(attempted || mismatch) && confirm !== next ? 'The passwords do not match.' : undefined}>
        <PasswordInput value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" />
      </Field>
      <Button type="submit" variant="primary" loading={change.isPending} className={styles.submit}>
        {submitLabel}
      </Button>
    </form>
  );
}
