import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useId,
} from 'react';
import styles from './Field.module.css';

export interface FieldProps {
  id?: string;
  label: string;
  helper?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}

export function Field({
  id,
  label,
  helper,
  error,
  className,
  children,
}: FieldProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const helperId = `${controlId}-helper`;
  const errorId = `${controlId}-error`;
  const describedBy = error ? errorId : helper ? helperId : undefined;

  const child = Children.only(children);
  const control = isValidElement(child)
    ? cloneElement(child as ReactElement<Record<string, unknown>>, {
        id: controlId,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
      })
    : children;

  return (
    <div className={[styles.field, className ?? ''].filter(Boolean).join(' ')}>
      <label className={styles.label} htmlFor={controlId}>
        {label}
      </label>
      <div className={styles.control}>{control}</div>
      {error ? (
        <p className={styles.error} id={errorId} role="alert">
          {error}
        </p>
      ) : helper ? (
        <p className={styles.helper} id={helperId}>
          {helper}
        </p>
      ) : null}
    </div>
  );
}
