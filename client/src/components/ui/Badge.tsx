import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import styles from './Badge.module.css';

export type Tone = 'neutral' | 'info' | 'warning' | 'attention' | 'success' | 'danger' | 'accent' | 'outline';

interface BadgeProps {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
  title?: string;
}

export function Badge({ tone = 'neutral', dot = false, children, title }: BadgeProps) {
  return (
    <span className={cx(styles.badge, tone !== 'neutral' && styles[tone], dot && styles.dot)} title={title}>
      {children}
    </span>
  );
}
