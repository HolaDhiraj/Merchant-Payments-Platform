import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import styles from './Switch.module.css';

interface SwitchProps {
  checked: boolean;
  onChange(checked: boolean): void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

// On/off setting with its label and an optional explanation, as one clickable row.
export function Switch({ checked, onChange, label, description, disabled }: SwitchProps) {
  return (
    <label className={cx(styles.row, disabled && styles.disabled)}>
      <span className={styles.text}>
        <span className={styles.label}>{label}</span>
        {description && <span className={styles.description}>{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className={styles.switch}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.thumb} />
      </button>
    </label>
  );
}
