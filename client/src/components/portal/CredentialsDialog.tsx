import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import styles from './CredentialsDialog.module.css';

interface CredentialsDialogProps {
  title: string;
  description: string;
  email: string;
  temporaryPassword: string;
  onClose(): void;
}

// A one-time password is shown exactly once: the server keeps only its hash.
export function CredentialsDialog({ title, description, email, temporaryPassword, onClose }: CredentialsDialogProps) {
  const toast = useToast();

  function copy(label: string, value: string) {
    void navigator.clipboard?.writeText(value).then(() => toast.success(`${label} copied`));
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className={styles.credentials}>
        <CredentialRow label="Email" value={email} onCopy={() => copy('Email', email)} />
        <CredentialRow
          label="Temporary password"
          value={temporaryPassword}
          mono
          onCopy={() => copy('Password', temporaryPassword)}
        />
      </div>
      <Callout tone="warning" icon="shield" title="Shown only once">
        Share it privately. They will be asked to choose their own password the first time they sign in.
      </Callout>
    </Dialog>
  );
}

function CredentialRow({ label, value, mono, onCopy }: { label: string; value: string; mono?: boolean; onCopy(): void }) {
  return (
    <div className={styles.row}>
      <div className={styles.text}>
        <span className={styles.label}>{label}</span>
        <span className={mono ? `${styles.value} mono` : styles.value}>{value}</span>
      </div>
      <Button size="sm" variant="ghost" onClick={onCopy} aria-label={`Copy ${label.toLowerCase()}`}>
        <Icon name="copy" />
        Copy
      </Button>
    </div>
  );
}
