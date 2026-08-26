import type { Result } from './result';

export type Money = {
  readonly cents: number;
  readonly currency: 'COP';
};

export function money(cents: number, currency: 'COP' = 'COP'): Result<Money, string> {
  if (!Number.isInteger(cents)) {
    return { ok: false, error: 'Money must be an integer number of cents' };
  }
  if (cents < 0) {
    return { ok: false, error: 'Money cannot be negative' };
  }
  if (currency !== 'COP') {
    return { ok: false, error: 'Only COP is supported' };
  }
  return { ok: true, value: Object.freeze({ cents, currency }) };
}

export function addMoney(a: Money, b: Money): Result<Money, string> {
  if (a.currency !== b.currency) {
    return { ok: false, error: 'Currency mismatch' };
  }
  return money(a.cents + b.cents, a.currency);
}

export function multiplyMoney(m: Money, factor: number): Result<Money, string> {
  if (!Number.isInteger(factor) || factor < 0) {
    return { ok: false, error: 'Factor must be a non-negative integer' };
  }
  return money(m.cents * factor, m.currency);
}

export function formatCop(cents: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
