import { forwardRef, type InputHTMLAttributes } from 'react';
import { formatExpiryInput } from '@/validators/card';
import styles from './ExpiryInput.module.css';

export interface ExpiryInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value: string;
  onChange: (value: string) => void;
}

export const ExpiryInput = forwardRef<HTMLInputElement, ExpiryInputProps>(
  function ExpiryInput({ value, onChange, className, placeholder = 'MM/YY', ...rest }, ref) {
    return (
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="cc-exp"
        maxLength={5}
        placeholder={placeholder}
        className={[styles.input, className ?? ''].filter(Boolean).join(' ')}
        value={value}
        onChange={(e) => onChange(formatExpiryInput(e.target.value))}
        {...rest}
      />
    );
  },
);
