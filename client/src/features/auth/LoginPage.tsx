import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '@/api/http';
import { useAuth } from '@/auth/AuthProvider';
import { Wordmark } from '@/components/layout/Wordmark';
import { ThemeSwitch } from '@/components/layout/ThemeSwitch';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Field, Input } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import styles from './LoginPage.module.css';

function describeLoginError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'That email and password combination is not right.';
    if (error.status === 429) return 'Too many attempts. Wait a minute, then try again.';
    if (error.status === 400) return 'Enter a valid email address and your password.';
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}

export function LoginPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/applications';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={from} replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      navigate(from, { replace: true });
    } catch (caught) {
      setError(describeLoginError(caught));
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.top}>
        <Wordmark />
        <div className={styles.theme}>
          <ThemeSwitch />
        </div>
      </div>

      <div className={styles.center}>
        <div className={styles.card}>
          <div className={styles.heading}>
            <h1 className={styles.title}>Sign in</h1>
            <p className={styles.lede}>Merchant onboarding and risk review for the payments team.</p>
          </div>

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            {error && <Callout tone="danger">{error}</Callout>}
            <Field label="Work email">
              <Input
                type="email"
                autoComplete="username"
                autoFocus
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
            <Button type="submit" variant="primary" block loading={submitting} disabled={!email || !password} className={styles.submit}>
              Sign in
            </Button>
          </form>
        </div>
      </div>

      <footer className={styles.foot}>
        <span>Accounts are created by an administrator.</span>
        <a href="/api/docs" target="_blank" rel="noreferrer">
          API reference <Icon name="arrowUpRight" size={14} />
        </a>
      </footer>
    </div>
  );
}
