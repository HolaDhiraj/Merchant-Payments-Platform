import { cx } from '@/lib/cx';
import styles from './Spinner.module.css';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

// Inherits currentColor, so it matches whatever button or text it sits in.
export function Spinner({ size = 'md', label = 'Loading', className }: SpinnerProps) {
  return (
    <span role="status" className={cx(styles.spinner, styles[size], className)}>
      <span className="visually-hidden">{label}</span>
    </span>
  );
}

export function PageLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className={styles.page}>
      <div className={styles.pageInner}>
        <Spinner size="lg" label={label} />
        <span className={styles.pageLabel}>{label}…</span>
      </div>
    </div>
  );
}
