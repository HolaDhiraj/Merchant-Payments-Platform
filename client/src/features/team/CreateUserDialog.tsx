import { useState } from 'react';
import { useCreateUser } from '@/api/queries';
import type { Role } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Select } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/errors';
import { ROLE_LABEL } from '@/lib/labels';

interface Values {
  fullName: string;
  email: string;
  role: Role;
  password: string;
}

// Same rules as CreateUserDto on the server.
function validate(values: Values): Partial<Record<keyof Values, string>> {
  const errors: Partial<Record<keyof Values, string>> = {};
  const name = values.fullName.trim();
  if (name.length < 2 || name.length > 200) errors.fullName = 'Enter their full name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'Enter a valid email address.';
  if (values.password.length < 12 || values.password.length > 128) errors.password = 'At least 12 characters.';
  else if (!/[A-Za-z]/.test(values.password) || !/\d/.test(values.password)) {
    errors.password = 'Use both letters and digits.';
  }
  return errors;
}

export function CreateUserDialog({ onClose }: { onClose(): void }) {
  const create = useCreateUser();
  const toast = useToast();
  const [values, setValues] = useState<Values>({ fullName: '', email: '', role: 'SALES', password: '' });
  const [attempted, setAttempted] = useState(false);
  const errors = attempted ? validate(values) : {};

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function submit() {
    setAttempted(true);
    if (Object.keys(validate(values)).length > 0) return;
    create.mutate(
      { ...values, fullName: values.fullName.trim(), email: values.email.trim() },
      {
        onSuccess: (user) => {
          toast.success(`${user.fullName} can now sign in`);
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
      busy={create.isPending}
      title="Add a person"
      description="Share the password with them through a secure channel."
      footer={
        <>
          <Button onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={create.isPending}>
            Add person
          </Button>
        </>
      }
    >
      {create.isError && <Callout tone="danger">{errorMessage(create.error)}</Callout>}
      <Field label="Full name" error={errors.fullName}>
        <Input value={values.fullName} onChange={(event) => set('fullName', event.target.value)} autoFocus />
      </Field>
      <Field label="Work email" error={errors.email}>
        <Input type="email" value={values.email} onChange={(event) => set('email', event.target.value)} autoComplete="off" />
      </Field>
      <Field label="Role" hint="Sales capture merchants, reviewers decide on them, admins run the platform.">
        <Select value={values.role} onChange={(event) => set('role', event.target.value as Role)}>
          {Object.entries(ROLE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Temporary password" error={errors.password} hint="12+ characters with letters and digits.">
        <Input type="password" value={values.password} onChange={(event) => set('password', event.target.value)} autoComplete="new-password" />
      </Field>
    </Dialog>
  );
}
