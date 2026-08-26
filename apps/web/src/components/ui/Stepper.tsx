import { forwardRef } from 'react';
import styles from './Stepper.module.css';

export interface StepperProps {
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
  className?: string;
  'aria-label'?: string;
}

export const Stepper = forwardRef<HTMLDivElement, StepperProps>(
  function Stepper(
    {
      value,
      min = 1,
      max,
      onChange,
      className,
      'aria-label': ariaLabel = 'Hours',
    },
    ref,
  ) {
    const clampedMax = Math.max(min, max);
    const atMin = value <= min;
    const atMax = value >= clampedMax;

    return (
      <div
        ref={ref}
        className={[styles.stepper, className ?? ''].filter(Boolean).join(' ')}
        role="group"
        aria-label={ariaLabel}
        data-testid="hours-stepper"
      >
        <button
          type="button"
          className={styles.btn}
          aria-label="Decrease hours"
          disabled={atMin}
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          −
        </button>
        <span className={styles.value} aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          className={styles.btn}
          aria-label="Increase hours"
          disabled={atMax}
          onClick={() => onChange(Math.min(clampedMax, value + 1))}
        >
          +
        </button>
      </div>
    );
  },
);
