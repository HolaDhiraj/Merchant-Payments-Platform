import { Link, useNavigate } from 'react-router-dom';
import { useAuth, useCurrentUser } from '@/auth/AuthProvider';
import { Wordmark } from '@/components/layout/Wordmark';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { homePathFor } from '@/lib/roles';
import { ChangePasswordForm } from './ChangePasswordForm';
import styles from './ChangePasswordPage.module.css';

// Shown right after signing in with a temporary password; nothing else is reachable until it is done.
export function ChangePasswordPage() {
  const user = useCurrentUser();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <Wordmark />
        <Button variant="ghost" size="sm" icon="logout" onClick={signOut}>
          Sign out
        </Button>
      </header>
      <main className={styles.center}>
        <div className={styles.card}>
          <span className={styles.badge}>
            <Icon name="shield" size={22} />
          </span>
          <h1 className={styles.title}>Set your own password</h1>
          <p className={styles.lede}>
            Welcome, {user.fullName.split(' ')[0]}. You signed in with a temporary password. Choose a new one to
            continue{user.merchantId ? ' to your merchant portal' : ''}.
          </p>
          {user.mustChangePassword ? (
            <ChangePasswordForm
              currentLabel="Temporary password"
              submitLabel="Save and continue"
              onChanged={() => {
                toast.success('Password changed');
                navigate(homePathFor(user.role), { replace: true });
              }}
            />
          ) : (
            <Callout tone="success" title="All set">
              Your password is already yours.{' '}
              <Link to={homePathFor(user.role)}>Continue</Link>
            </Callout>
          )}
        </div>
      </main>
    </div>
  );
}
