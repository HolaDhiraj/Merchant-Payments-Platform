import { useEffect, useRef } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { Button } from './Button';
import styles from './Dialog.module.css';

interface DialogProps {
  open: boolean;
  onClose(): void;
  title: string;
  description?: ReactNode;
  // Rendered as a form, so Enter submits and the primary button can be type="submit".
  onSubmit?(event: FormEvent<HTMLFormElement>): void;
  footer?: ReactNode;
  wide?: boolean;
  // Blocks closing (Escape, close button) while a request is in flight.
  busy?: boolean;
  children: ReactNode;
}

// Built on the native <dialog> element: focus trapping, Escape and the top layer come for free.
export function Dialog({ open, onClose, title, description, onSubmit, footer, wide, busy, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={cx(styles.dialog, wide && styles.wide)}
      aria-labelledby="dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === ref.current && !busy) onClose();
      }}
    >
      {open && (
        <form
          className={styles.form}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit?.(event);
          }}
        >
          <header className={styles.header}>
            <div>
              <h2 id="dialog-title" className={styles.title}>
                {title}
              </h2>
              {description && <p className={styles.description}>{description}</p>}
            </div>
            <Button variant="ghost" size="sm" icon="close" aria-label="Close" onClick={onClose} disabled={busy} />
          </header>
          <div className={styles.body}>{children}</div>
          {footer && <footer className={styles.footer}>{footer}</footer>}
        </form>
      )}
    </dialog>
  );
}
