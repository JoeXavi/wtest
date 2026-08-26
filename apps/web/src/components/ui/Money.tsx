import styles from './Money.module.css';

const formatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

export function formatMoneyFromCents(cents: number): string {
  return formatter.format(cents / 100);
}

export interface MoneyProps {
  cents: number;
  className?: string;
  as?: 'span' | 'p' | 'div';
}

/** Formats cents → COP. Division happens only here. */
export function Money({ cents, className, as: Tag = 'span' }: MoneyProps) {
  return (
    <Tag className={[styles.money, className ?? ''].filter(Boolean).join(' ')}>
      {formatMoneyFromCents(cents)}
    </Tag>
  );
}
