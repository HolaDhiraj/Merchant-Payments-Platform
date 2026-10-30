import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { Icon, type IconName } from './Icon';
import styles from './Callout.module.css';

type CalloutTone = 'info' | 'warning' | 'attention' | 'danger' | 'success';

const ICON: Record<CalloutTone, IconName> = {
  info: 'info',
  warning: 'alert',
  attention: 'alert',
  danger: 'alert',
  success: 'check',
};

interface CalloutProps {
  tone?: CalloutTone;
  title?: ReactNode;
  // Overrides the tone's default icon.
  icon?: IconName;
  children?: ReactNode;
  className?: string;
}

export function Callout({ tone = 'info', title, icon, children, className }: CalloutProps) {
  return (
    <div
      className={cx(styles.callout, tone !== 'info' && styles[tone], className)}
      role={tone === 'danger' ? 'alert' : undefined}
    >
      <Icon name={icon ?? ICON[tone]} className={styles.icon} />
      <div className={styles.body}>
        {title && <div className={styles.title}>{title}</div>}
        {children}
      </div>
    </div>
  );
}
