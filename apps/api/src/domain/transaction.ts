import type { AmountBreakdown, CardBrand, TransactionStatus } from '@norte/contracts';
import { err, ok, type Result } from '../shared/result';
import type { DomainError } from './errors';

export type TransactionCard = {
  brand: CardBrand;
  last4: string;
};

export type Transaction = {
  reference: string;
  productId: string;
  productName: string;
  quantity: number;
  customerId: string;
  amounts: AmountBreakdown;
  currency: 'COP';
  status: TransactionStatus;
  statusMessage?: string;
  pspTransactionId?: string;
  card?: TransactionCard;
  attempts: number;
  paidAt?: string;
  finalizedAt?: string;
  createdAt: string;
  updatedAt: string;
};

const TERMINAL: ReadonlySet<TransactionStatus> = new Set([
  'APPROVED',
  'DECLINED',
  'VOIDED',
  'ERROR',
]);

export function isTerminal(status: TransactionStatus): boolean {
  return TERMINAL.has(status);
}

export function attachPspId(
  tx: Transaction,
  pspTransactionId: string,
  card: TransactionCard,
): Result<Transaction, DomainError> {
  if (tx.status !== 'PENDING') {
    return err({
      code: 'INVALID_TRANSACTION_STATE',
      reference: tx.reference,
      current: tx.status,
      attempted: 'attachPspId',
    });
  }
  return ok({
    ...tx,
    pspTransactionId,
    card,
    attempts: tx.attempts + 1,
    paidAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export function finalize(
  tx: Transaction,
  status: Exclude<TransactionStatus, 'PENDING'>,
  statusMessage?: string,
): Result<Transaction, DomainError> {
  if (tx.status !== 'PENDING') {
    return err({
      code: 'INVALID_TRANSACTION_STATE',
      reference: tx.reference,
      current: tx.status,
      attempted: `finalize:${status}`,
    });
  }
  return ok({
    ...tx,
    status,
    statusMessage,
    finalizedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export function quoteAmounts(
  unitPriceCents: number,
  hours: number,
  baseFeeCents: number,
  deliveryFeeCents: number,
): AmountBreakdown {
  const itemCents = unitPriceCents * hours;
  return {
    itemCents,
    baseFeeCents,
    deliveryFeeCents,
    totalCents: itemCents + baseFeeCents + deliveryFeeCents,
  };
}
