import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { StartCheckoutRequest, StartCheckoutResponse } from '@norte/contracts';
import {
  CLOCK,
  CUSTOMER_REPOSITORY,
  ID_GENERATOR,
  PAYMENT_GATEWAY,
  PRODUCT_REPOSITORY,
  TRANSACTION_REPOSITORY,
  quoteAmounts,
  reserve,
  type Clock,
  type Customer,
  type CustomerRepository,
  type Delivery,
  type IdGenerator,
  type PaymentGateway,
  type ProductRepository,
  type Transaction,
  type TransactionRepository,
} from '../../domain';
import { createEmail, createPhone } from '../../domain/value-objects';
import { err, ok, type Result } from '../../shared/result';
import type { DomainError } from '../../domain/errors';

@Injectable()
export class StartCheckoutUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    @Inject(TRANSACTION_REPOSITORY) private readonly transactions: TransactionRepository,
    @Inject(CUSTOMER_REPOSITORY) private readonly customers: CustomerRepository,
    @Inject(PAYMENT_GATEWAY) private readonly payments: PaymentGateway,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly config: ConfigService,
  ) {}

  async execute(cmd: StartCheckoutRequest): Promise<Result<StartCheckoutResponse, DomainError>> {
    const emailResult = createEmail(cmd.customer.email);
    if (!emailResult.ok) {
      return err({ code: 'VALIDATION_ERROR', message: emailResult.error });
    }
    const phoneResult = createPhone(cmd.customer.phone);
    if (!phoneResult.ok) {
      return err({ code: 'VALIDATION_ERROR', message: phoneResult.error });
    }
    const deliveryPhone = createPhone(cmd.delivery.phone);
    if (!deliveryPhone.ok) {
      return err({ code: 'VALIDATION_ERROR', message: deliveryPhone.error });
    }

    await this.products.sweepExpiredReservations(cmd.productId);
    const productResult = await this.products.findById(cmd.productId);
    if (!productResult.ok) return productResult;

    const reservation = reserve(productResult.value, cmd.hours);
    if (!reservation.ok) return reservation;

    const existingCustomer = await this.customers.findByEmail(emailResult.value.value);
    if (!existingCustomer.ok) return existingCustomer;

    const now = this.clock.now().toISOString();
    const customer: Customer = existingCustomer.value
      ? {
          ...existingCustomer.value,
          fullName: cmd.customer.fullName,
          phone: phoneResult.value.value,
          legalId: cmd.customer.legalId,
          legalIdType: cmd.customer.legalIdType,
          updatedAt: now,
        }
      : {
          customerId: this.ids.ulid(),
          email: emailResult.value.value,
          fullName: cmd.customer.fullName,
          phone: phoneResult.value.value,
          legalId: cmd.customer.legalId,
          legalIdType: cmd.customer.legalIdType,
          createdAt: now,
          updatedAt: now,
        };

    const reference = this.ids.reference();
    const baseFee = Number(this.config.get('PRICING_BASE_FEE_CENTS') ?? 150000);
    const deliveryFee = Number(this.config.get('PRICING_DELIVERY_FEE_CENTS') ?? 800000);
    const amounts = quoteAmounts(
      productResult.value.unitPriceCents,
      cmd.hours,
      baseFee,
      deliveryFee,
    );

    const transaction: Transaction = {
      reference,
      productId: productResult.value.productId,
      productName: productResult.value.name,
      quantity: cmd.hours,
      customerId: customer.customerId,
      amounts,
      currency: 'COP',
      status: 'PENDING',
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    };

    const delivery: Delivery = {
      reference,
      recipientName: cmd.delivery.recipientName,
      phone: deliveryPhone.value.value,
      address: {
        addressLine1: cmd.delivery.addressLine1,
        addressLine2: cmd.delivery.addressLine2,
        city: cmd.delivery.city,
        region: cmd.delivery.region,
        postalCode: cmd.delivery.postalCode,
        country: cmd.delivery.country,
      },
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };

    const ttlSeconds = Number(this.config.get('RESERVATION_TTL_SECONDS') ?? 900);
    const writeResult = await this.transactions.startCheckout({
      productId: productResult.value.productId,
      quantity: cmd.hours,
      reservationExpiresAt: this.clock.nowEpochSeconds() + ttlSeconds,
      transaction,
      delivery,
      customer,
      isNewCustomer: !existingCustomer.value,
    });
    if (!writeResult.ok) return writeResult;

    const tokens = await this.payments.getAcceptanceTokens();
    if (!tokens.ok) return tokens;

    return ok({
      transactionReference: reference,
      status: 'PENDING',
      amounts,
      currency: 'COP',
      psp: {
        publicKey: this.payments.getPublicKey(),
        acceptanceToken: tokens.value.acceptanceToken,
        acceptPersonalAuthToken: tokens.value.acceptPersonalAuthToken,
        policyLinks: tokens.value.policyLinks,
      },
    });
  }
}
