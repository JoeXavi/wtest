import {
  forwardRef,
  useState,
  type InputHTMLAttributes,
} from 'react';
import { digitsOnly } from '@/validators/card';
import styles from './CvcInput.module.css';

export interface CvcInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type' | 'defaultValue'> {
  /** Notified of digits-only CVC; value is never stored in Redux. */
  onValueChange?: (value: string) => void;
  maxLength?: number;
}

/**
 * CVC lives in local component state only — never dispatched to Redux.
 */
export const CvcInput = forwardRef<HTMLInputElement, CvcInputProps>(
  function CvcInput({ onValueChange, className, maxLength = 4, ...rest }, ref) {
    const [value, setValue] = useState('');

    return (
      <input
        ref={ref}
        type="password"
        inputMode="numeric"
        autoComplete="cc-csc"
        maxLength={maxLength}
        className={[styles.input, className ?? ''].filter(Boolean).join(' ')}
        value={value}
        onChange={(e) => {
          const next = digitsOnly(e.target.value).slice(0, maxLength);
          setValue(next);
          onValueChange?.(next);
        }}
        {...rest}
      />
    );
  },
);
