import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import styles from './StatTile.module.css';

interface StatTileProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accent?: boolean;
}

// One headline number with its label and a short line of context.
export function StatTile({ label, value, hint, accent }: StatTileProps) {
  return (
    <div className={cx(styles.tile, accent && styles.accent)}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}
