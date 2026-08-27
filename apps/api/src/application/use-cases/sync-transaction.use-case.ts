import { Inject, Injectable, Logger } from '@nestjs/common';
import type { TransactionDto } from '@norte/contracts';
import {
  isTerminal,
  PAYMENT_GATEWAY,
  TRANSACTION_REPOSITORY,
  type PaymentGateway,
  type Transaction,
  type TransactionRepository,
} from '../../domain';
import { ok, type Result } from '../../shared/result';
import type { DomainError } from '../../domain/errors';

@Injectable()
export class SyncTransactionStatusUseCase {
  private readonly logger = new Logger(SyncTransactionStatusUseCase.name);

  constructor(
    @Inject(TRANSACTION_REPOSITORY) private readonly transactions: TransactionRepository,
    @Inject(PAYMENT_GATEWAY) private readonly payments: PaymentGateway,
  ) {}

  async execute(reference: string): Promise<Result<TransactionDto, DomainError>> {
    const txResult = await this.transactions.findByReference(reference);
    if (!txResult.ok) return txResult;
    let tx = txResult.value;

    if (!isTerminal(tx.status) && tx.pspTransactionId) {
      const status = await this.payments.getChargeStatus(tx.pspTransactionId);
      if (!status.ok) {
        this.logger.warn(
          `sync getChargeStatus failed reference=${reference} pspId=${tx.pspTransactionId} error=${JSON.stringify(status.error)}`,
        );
      } else if (isTerminal(status.value.status)) {
        const finalized = await this.finalize(
          tx,
          status.value.status,
          status.value.statusMessage,
        );
        if (!finalized.ok) {
          this.logger.warn(
            `sync finalize failed reference=${reference} pspStatus=${status.value.status} error=${JSON.stringify(finalized.error)}`,
          );
        } else {
          this.logger.log(
            `sync finalized reference=${reference} status=${finalized.value.status}`,
          );
          tx = finalized.value;
        }
      } else {
        this.logger.log(
          `sync still pending reference=${reference} pspStatus=${status.value.status}`,
        );
      }
    }

    return ok(toDto(tx));
  }

  private async finalize(
    tx: Transaction,
    status: Transaction['status'],
    statusMessage?: string,
  ): Promise<Result<Transaction, DomainError>> {
    if (status === 'APPROVED') {
      return this.transactions.finalizeApproved(tx.reference, statusMessage);
    }
    if (status === 'DECLINED' || status === 'ERROR' || status === 'VOIDED') {
      return this.transactions.finalizeRejected(tx.reference, status, statusMessage);
    }
    return ok(tx);
  }
}

@Injectable()
export class HandlePaymentEventUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY) private readonly transactions: TransactionRepository,
    @Inject(PAYMENT_GATEWAY) private readonly payments: PaymentGateway,
  ) {}

  async execute(
    payload: unknown,
    headerChecksum?: string,
  ): Promise<Result<{ handled: boolean }, DomainError>> {
    const verified = this.payments.verifyEvent(payload as never, headerChecksum);
    if (!verified.ok) return verified;

    const event = verified.value;
    if (event.eventType !== 'transaction.updated') {
      return ok({ handled: false });
    }

    const reference = event.data.transaction.reference;
    const txResult = await this.transactions.findByReference(reference);
    if (!txResult.ok) {
      if (txResult.error.code === 'TRANSACTION_NOT_FOUND') {
        return ok({ handled: false });
      }
      return txResult;
    }

    if (isTerminal(txResult.value.status)) {
      return ok({ handled: true });
    }

    const status = event.data.transaction.status;
    if (status === 'APPROVED') {
      const result = await this.transactions.finalizeApproved(
        reference,
        event.data.transaction.statusMessage,
      );
      if (!result.ok && result.error.code !== 'INVALID_TRANSACTION_STATE') return result;
      return ok({ handled: true });
    }

    if (status === 'DECLINED' || status === 'ERROR' || status === 'VOIDED') {
      const result = await this.transactions.finalizeRejected(
        reference,
        status,
        event.data.transaction.statusMessage,
      );
      if (!result.ok && result.error.code !== 'INVALID_TRANSACTION_STATE') return result;
      return ok({ handled: true });
    }

    return ok({ handled: true });
  }
}

function toDto(tx: Transaction): TransactionDto {
  return {
    reference: tx.reference,
    status: tx.status,
    statusMessage: tx.statusMessage,
    amounts: tx.amounts,
    card: tx.card,
    product: { name: tx.productName, hours: tx.quantity },
    finalizedAt: tx.finalizedAt,
  };
}
