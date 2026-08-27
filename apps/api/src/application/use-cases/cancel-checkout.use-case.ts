import { Inject, Injectable } from '@nestjs/common';
import type { CancelCheckoutResponse } from '@norte/contracts';
import {
  TRANSACTION_REPOSITORY,
  type TransactionRepository,
} from '../../domain';
import { err, ok, type Result } from '../../shared/result';
import type { DomainError } from '../../domain/errors';

@Injectable()
export class CancelCheckoutUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactions: TransactionRepository,
  ) {}

  async execute(
    reference: string,
  ): Promise<Result<CancelCheckoutResponse, DomainError>> {
    const txResult = await this.transactions.findByReference(reference);
    if (!txResult.ok) return txResult;

    const tx = txResult.value;
    if (tx.status === 'VOIDED') {
      return ok({
        transactionReference: reference,
        status: 'VOIDED',
        amounts: tx.amounts,
      });
    }

    if (tx.status !== 'PENDING' || tx.pspTransactionId) {
      return err({
        code: 'INVALID_TRANSACTION_STATE',
        reference,
        current: tx.status,
        attempted: 'cancelCheckout',
      });
    }

    const voided = await this.transactions.finalizeRejected(
      reference,
      'VOIDED',
      'Cancelled by customer',
    );
    if (!voided.ok) return voided;

    return ok({
      transactionReference: reference,
      status: 'VOIDED',
      amounts: voided.value.amounts,
    });
  }
}
