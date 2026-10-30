import { useCurrentUser } from '@/auth/AuthProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { DetailList, Panel } from '@/components/ui/Panel';
import { useToast } from '@/components/ui/Toast';
import { formatDate } from '@/lib/format';
import { ROLE_LABEL } from '@/lib/labels';
import { ChangePasswordForm } from './ChangePasswordForm';
import styles from './AccountPage.module.css';

export function AccountPage() {
  const user = useCurrentUser();
  const toast = useToast();

  return (
    <>
      <PageHeader title="My account" subtitle="Your sign-in details." />
      <div className={styles.grid}>
        <Panel title="Profile">
          <DetailList
            items={[
              ['Name', user.fullName],
              ['Email', user.email],
              ['Role', ROLE_LABEL[user.role]],
              ['Member since', formatDate(user.createdAt)],
            ]}
          />
        </Panel>
        <Panel title="Change password" description="You stay signed in on this device.">
          <ChangePasswordForm onChanged={() => toast.success('Password changed')} />
        </Panel>
      </div>
    </>
  );
}
