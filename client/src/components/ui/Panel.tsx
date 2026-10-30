import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import styles from './Panel.module.css';

interface PanelProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  flush?: boolean;
  /** The body scrolls inside the panel instead of growing the page; cap the height via className. */
  scrollable?: boolean;
  className?: string;
  children: ReactNode;
}

export function Panel({ title, description, actions, flush, scrollable, className, children }: PanelProps) {
  return (
    <section className={cx(styles.panel, scrollable && styles.scrollable, className)}>
      {(title || actions) && (
        <header className={styles.header}>
          <div>
            {title && <h2 className={styles.title}>{title}</h2>}
            {description && <p className={styles.description}>{description}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={cx(styles.body, flush && styles.flush, scrollable && styles.scrollBody)}>{children}</div>
    </section>
  );
}

export function DetailList({ items }: { items: Array<[label: string, value: ReactNode]> }) {
  return (
    <dl className={styles.details}>
      {items.map(([label, value]) => (
        <div key={label} className={styles.row}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
