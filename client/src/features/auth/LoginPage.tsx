import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '@/api/http';
import { useAuth } from '@/auth/AuthProvider';
import { Wordmark } from '@/components/layout/Wordmark';
import { ThemeSwitch } from '@/components/layout/ThemeSwitch';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Field, Input, PasswordInput } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import { BrandPreview } from './BrandPreview';
import styles from './LoginPage.module.css';

type LoginProblem =
  | { kind: 'locked'; message: string }
  | { kind: 'lastAttempts'; remaining: number }
  | { kind: 'error'; message: string };

function describeLoginError(error: unknown): LoginProblem {
  if (!(error instanceof ApiError)) return { kind: 'error', message: 'Something went wrong. Please try again.' };
  if (error.code === 'ACCOUNT_LOCKED') return { kind: 'locked', message: error.message };
  const remaining = error.meta.remainingAttempts;
  if (error.status === 401 && typeof remaining === 'number') return { kind: 'lastAttempts', remaining };
  if (error.status === 401) return { kind: 'error', message: 'That email and password combination is not right.' };
  if (error.status === 429) return { kind: 'error', message: 'Too many attempts from this device. Wait a minute, then try again.' };
  if (error.status === 400) return { kind: 'error', message: 'Enter a valid email address and your password.' };
  return { kind: 'error', message: error.message };
}

function LoginNotice({ problem }: { problem: LoginProblem }) {
  switch (problem.kind) {
    case 'locked':
      return (
        <Callout tone="danger" icon="lock" title="Account locked">
          {problem.message}
        </Callout>
      );
    case 'lastAttempts':
      return (
        <Callout
          tone="warning"
          title={`Wrong password · ${problem.remaining} ${problem.remaining === 1 ? 'attempt' : 'attempts'} left`}
        >
          {problem.remaining === 1
            ? 'One more wrong password will lock this account until an administrator unlocks it.'
            : `${problem.remaining} more wrong passwords will lock this account until an administrator unlocks it.`}
        </Callout>
      );
    case 'error':
      return <Callout tone="danger">{problem.message}</Callout>;
  }
}

const HIGHLIGHTS: Array<{ icon: IconName; title: string; text: string }> = [
  { icon: 'shield', title: 'Automated risk checks', text: 'Every submission is scored before a reviewer sees it.' },
  { icon: 'users', title: 'Clear ownership', text: 'Sales capture, reviewers decide, admins oversee.' },
  { icon: 'log', title: 'Full audit trail', text: 'Each action is recorded with who did it and when.' },
];

export function LoginPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/applications';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [problem, setProblem] = useState<LoginProblem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={from} replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setProblem(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      navigate(from, { replace: true });
    } catch (caught) {
      setProblem(describeLoginError(caught));
      setPassword('');
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <aside className={styles.brand}>
        <Wordmark />

        <div className={styles.pitch}>
          <p className={styles.eyebrow}>Merchant onboarding</p>
          <h2 className={styles.headline}>Approve good merchants faster. Catch risky ones early.</h2>
          <BrandPreview />
        </div>

        <ul className={styles.highlights}>
          {HIGHLIGHTS.map((item) => (
            <li key={item.title}>
              <span className={styles.highlightIcon}>
                <Icon name={item.icon} />
              </span>
              <span>
                <strong>{item.title}</strong>
                {item.text}
              </span>
            </li>
          ))}
        </ul>
      </aside>

      <main className={styles.formSide}>
        <div className={styles.top}>
          <span className={styles.mobileMark}>
            <Wordmark />
          </span>
          <div className={styles.theme}>
            <ThemeSwitch />
          </div>
        </div>

        <div className={styles.center}>
          <div className={styles.card}>
            <div className={styles.heading}>
              <h1 className={styles.title}>Welcome back</h1>
              <p className={styles.lede}>Sign in to your Merchant Desk workspace.</p>
            </div>

            <form className={styles.form} onSubmit={handleSubmit} noValidate>
              {problem && <LoginNotice problem={problem} />}
              <Field label="Work email">
                <Input
                  type="email"
                  autoComplete="username"
                  autoFocus
                  required
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (problem?.kind === 'locked') setProblem(null);
                  }}
                  placeholder="you@company.com"
                />
              </Field>
              <Field label="Password">
                <PasswordInput
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </Field>
              <Button
                type="submit"
                variant="primary"
                block
                loading={submitting}
                disabled={!email || !password}
                className={styles.submit}
              >
                Sign in
              </Button>
            </form>

            <p className={styles.note}>
              <Icon name="info" size={14} />
              For your security, repeated wrong passwords lock the account until an administrator unlocks it.
            </p>
          </div>
        </div>

        <footer className={styles.foot}>
          <span>No account yet? Ask an administrator to add you.</span>
          <a href="/api/docs" target="_blank" rel="noreferrer">
            API reference <Icon name="arrowUpRight" size={14} />
          </a>
        </footer>
      </main>
    </div>
  );
}
