import { cloneElement, forwardRef, isValidElement, useId, useState } from 'react';
import type {
  CSSProperties,
  InputHTMLAttributes,
  ReactElement,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { cx } from '@/lib/cx';
import { Icon } from './Icon';
import styles from './Field.module.css';

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
  // A single control; Field wires up its id and accessibility attributes.
  children: ReactElement<{ id?: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }>;
}

export function Field({ label, hint, error, optional, className, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(' ') || undefined;

  const control = isValidElement(children)
    ? cloneElement(children, { id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })
    : children;

  return (
    <div className={cx(styles.field, className)}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {optional && <span className={styles.optional}>optional</span>}
      </label>
      {control}
      {error ? (
        <span id={errorId} className={styles.error}>
          <Icon name="alert" size={13} />
          {error}
        </span>
      ) : (
        hint && (
          <span id={hintId} className={styles.hint}>
            {hint}
          </span>
        )
      )}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  prefix?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, prefix, ...rest },
  ref,
) {
  const input = <input ref={ref} className={cx(styles.control, className)} {...rest} />;
  if (!prefix) return input;
  return (
    <div className={styles.affixed} style={{ '--prefix-width': `${prefix.length}ch` } as CSSProperties}>
      <span className={styles.prefix}>{prefix}</span>
      {input}
    </div>
  );
});

// Password field with a show/hide toggle. Field's id and aria attributes land on the input.
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>>(
  function PasswordInput({ className, disabled, ...rest }, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <div className={styles.password}>
        <input
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={cx(styles.control, className)}
          disabled={disabled}
          spellCheck={false}
          autoCapitalize="off"
          {...rest}
        />
        <button
          type="button"
          className={styles.reveal}
          onClick={() => setVisible((current) => !current)}
          disabled={disabled}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          title={visible ? 'Hide password' : 'Show password'}
        >
          <Icon name={visible ? 'eyeOff' : 'eye'} />
        </button>
      </div>
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...rest }, ref) {
    return <select ref={ref} className={cx(styles.control, className)} {...rest} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cx(styles.control, className)} {...rest} />;
  },
);
