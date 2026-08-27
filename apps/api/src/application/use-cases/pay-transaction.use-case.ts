import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PayTransactionRequest, PayTransactionResponse } from '@norte/contracts';
import {
  CUSTOMER_REPOSITORY,
  DELIVERY_REPOSITORY,
  isTerminal,
  PAYMENT_GATEWAY,
  TRANSACTION_REPOSITORY,
  type CustomerRepository,
  type DeliveryRepository,
  type PaymentGateway,
  type TransactionRepository,
} from '../../domain';
import { ok, type Result } from '../../shared/result';
import type { DomainError } from '../../domain/errors';

@Injectable()
export class PayTransactionUseCase {
  private readonly logger = new Logger(PayTransactionUseCase.name);

  constructor(
    @Inject(TRANSACTION_REPOSITORY) private readonly transactions: TransactionRepository,
    @Inject(CUSTOMER_REPOSITORY) private readonly customers: CustomerRepository,
    @Inject(DELIVERY_REPOSITORY) private readonly deliveries: DeliveryRepository,
    @Inject(PAYMENT_GATEWAY) private readonly payments: PaymentGateway,
  ) {}

  async execute(
    reference: string,
    cmd: PayTransactionRequest,
  ): Promise<Result<PayTransactionResponse, DomainError>> {
    const txResult = await this.transactions.findByReference(reference);
    if (!txResult.ok) return txResult;
    const tx = txResult.value;

    if (tx.status !== 'PENDING') {
      return ok({
        transactionReference: reference,
        status: tx.status,
        statusMessage: tx.statusMessage,
        amounts: tx.amounts,
      });
    }

    if (tx.pspTransactionId) {
      return ok({
        transactionReference: reference,
        status: tx.status,
        statusMessage: tx.statusMessage,
        amounts: tx.amounts,
      });
    }

    const customerResult = await this.customers.findById(tx.customerId);
    if (!customerResult.ok) return customerResult;
    const deliveryResult = await this.deliveries.findByReference(reference);
    if (!deliveryResult.ok) return deliveryResult;

    const customer = customerResult.value;
    const delivery = deliveryResult.value;

    const charge = await this.payments.createCharge({
      reference,
      amountInCents: tx.amounts.totalCents,
      currency: 'COP',
      customerEmail: customer.email,
      cardToken: cmd.cardToken,
      installments: cmd.installments,
      acceptanceToken: cmd.acceptanceToken,
      acceptPersonalAuth: cmd.acceptPersonalAuth,
      customerData: {
        fullName: customer.fullName,
        phoneNumber: customer.phone,
        legalId: customer.legalId,
        legalIdType: customer.legalIdType,
      },
      shippingAddress: {
        addressLine1: delivery.address.addressLine1,
        addressLine2: delivery.address.addressLine2,
        city: delivery.address.city,
        region: delivery.address.region,
        country: delivery.address.country,
        phoneNumber: delivery.phone,
        name: delivery.recipientName,
        postalCode: delivery.address.postalCode,
      },
    });
    if (!charge.ok) return charge;

    const attached = await this.transactions.attachPsp(reference, charge.value.pspTransactionId, {
      brand: cmd.cardBrand,
      last4: cmd.cardLast4,
    });
    if (!attached.ok) {
      if (attached.error.code === 'INVALID_TRANSACTION_STATE') {
        const again = await this.transactions.findByReference(reference);
        if (again.ok) {
          return ok({
            transactionReference: reference,
            status: again.value.status,
            statusMessage: again.value.statusMessage,
            amounts: again.value.amounts,
          });
        }
      }
      return attached;
    }

    let status = charge.value.status;
    let statusMessage = charge.value.statusMessage;

    if (isTerminal(status)) {
      const finalized =
        status === 'APPROVED'
          ? await this.transactions.finalizeApproved(reference, statusMessage)
          : await this.transactions.finalizeRejected(
              reference,
              status as 'DECLINED' | 'ERROR' | 'VOIDED',
              statusMessage,
            );
      if (!finalized.ok) {
        this.logger.warn(
          `pay finalize failed reference=${reference} status=${status} error=${JSON.stringify(finalized.error)}`,
        );
      } else {
        status = finalized.value.status;
        statusMessage = finalized.value.statusMessage;
      }
    }

    return ok({
      transactionReference: reference,
      status,
      statusMessage,
      amounts: tx.amounts,
    });
  }
}
