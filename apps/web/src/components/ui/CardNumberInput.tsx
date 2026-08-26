import { forwardRef, type InputHTMLAttributes } from 'react';
import type { CardBrand } from '@norte/contracts';
import { detectBrand, formatCardNumber } from '@/validators/card';
import { BrandIcon } from './BrandIcon';
import styles from './CardNumberInput.module.css';

export interface CardNumberInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value: string;
  onChange: (value: string, brand: CardBrand) => void;
}

export const CardNumberInput = forwardRef<HTMLInputElement, CardNumberInputProps>(
  function CardNumberInput({ value, onChange, className, ...rest }, ref) {
    const brand = detectBrand(value);

    return (
      <div className={[styles.wrap, className ?? ''].filter(Boolean).join(' ')}>
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          autoComplete="cc-number"
          maxLength={23}
          className={styles.input}
          value={value}
          onChange={(e) => {
            const formatted = formatCardNumber(e.target.value);
            onChange(formatted, detectBrand(formatted));
          }}
          {...rest}
        />
        <span className={styles.icon} data-testid="card-brand-icon">
          <BrandIcon brand={brand} />
        </span>
      </div>
    );
  },
);
