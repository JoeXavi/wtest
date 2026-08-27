import type {
  CheckoutStep,
  CheckoutTransaction,
} from './slices/checkoutSlice';

const TERMINAL = new Set<CheckoutTransaction['status']>([
  'APPROVED',
  'DECLINED',
  'ERROR',
  'VOIDED',
]);

export function rehydrationPath(
  step: CheckoutStep,
  transaction: CheckoutTransaction | null,
): string | null {
  if (transaction) {
    if (TERMINAL.has(transaction.status)) {
      return '/checkout/result';
    }
    if (transaction.status === 'PENDING') {
      if (step === 'result') {
        return '/checkout/result';
      }
      if (step === 'summary') {
        return '/checkout/summary';
      }
    }
  }

  if (!transaction && (step === 'details' || step === 'summary')) {
    return step === 'details' ? '/checkout' : '/checkout/summary';
  }

  return null;
}
