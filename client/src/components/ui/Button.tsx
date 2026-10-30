import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cx } from '@/lib/cx';
import { Icon, type IconName } from './Icon';
import { Spinner } from './Spinner';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface StyleProps {
  variant?: Variant;
  size?: 'md' | 'sm';
  icon?: IconName;
  block?: boolean;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, StyleProps {
  loading?: boolean;
}

function classes({ variant = 'secondary', size = 'md', block }: StyleProps, iconOnly: boolean) {
  return cx(
    styles.button,
    variant !== 'secondary' && styles[variant],
    size === 'sm' && styles.sm,
    iconOnly && styles.iconOnly,
    block && styles.block,
  );
}

function Content({ icon, children }: { icon?: IconName; children?: ReactNode }) {
  return (
    <span className={styles.content}>
      {icon && <Icon name={icon} />}
      {children}
    </span>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, icon, block, loading = false, disabled, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(classes({ variant, size, block }, !children), loading && styles.loading, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <Content icon={icon}>{children}</Content>
      {loading && <Spinner size="sm" className={styles.spinner} label="Working" />}
    </button>
  );
});

interface ButtonLinkProps extends LinkProps, StyleProps {}

export function ButtonLink({ variant, size, icon, block, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={cx(classes({ variant, size, block }, !children), className)} {...rest}>
      <Content icon={icon}>{children}</Content>
    </Link>
  );
}
