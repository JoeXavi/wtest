import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import {
  CLOCK,
  CUSTOMER_REPOSITORY,
  DELIVERY_REPOSITORY,
  ID_GENERATOR,
  PAYMENT_GATEWAY,
  PRODUCT_REPOSITORY,
  TRANSACTION_REPOSITORY,
} from './domain';
import { ListProductsUseCase } from './application/use-cases/list-products.use-case';
import { GetProductUseCase, GetStockUseCase } from './application/use-cases/get-product.use-case';
import { StartCheckoutUseCase } from './application/use-cases/start-checkout.use-case';
import { PayTransactionUseCase } from './application/use-cases/pay-transaction.use-case';
import {
  HandlePaymentEventUseCase,
  SyncTransactionStatusUseCase,
} from './application/use-cases/sync-transaction.use-case';
import {
  GetCustomerUseCase,
  GetDeliveryUseCase,
  UpdateDeliveryUseCase,
} from './application/use-cases/customer-delivery.use-case';
import { validateEnv } from './infrastructure/config/env';
import { createDynamoClient, DYNAMO_CLIENT } from './infrastructure/persistence/dynamodb/dynamo.client';
import {
  DynamoCustomerRepository,
  DynamoDeliveryRepository,
  DynamoProductRepository,
  DynamoTransactionRepository,
} from './infrastructure/persistence/dynamodb/repositories';
import { PspHttpAdapter } from './infrastructure/psp/psp-http.adapter';
import { SystemClock, UlidGenerator } from './infrastructure/system/system.adapters';
import { ProductsController } from './infrastructure/http/products.controller';
import {
  CheckoutController,
  CustomersController,
  DeliveriesController,
} from './infrastructure/http/checkout.controller';
import { HealthController, WebhooksController } from './infrastructure/http/webhooks.controller';
import { GlobalExceptionFilter } from './infrastructure/http/result.mapper';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        redact: {
          paths: [
            'req.headers.authorization',
            'req.body.cardToken',
            'req.body.customer.legalId',
            'req.body.customer.email',
            'req.body.customer.phone',
          ],
          censor: '[REDACTED]',
        },
        genReqId: (req) =>
          (req.headers['x-request-id'] as string | undefined) ??
          `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
  ],
  controllers: [
    ProductsController,
    CheckoutController,
    CustomersController,
    DeliveriesController,
    WebhooksController,
    HealthController,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    {
      provide: DYNAMO_CLIENT,
      inject: [ConfigService],
      useFactory: createDynamoClient,
    },
    { provide: PRODUCT_REPOSITORY, useClass: DynamoProductRepository },
    { provide: TRANSACTION_REPOSITORY, useClass: DynamoTransactionRepository },
    { provide: CUSTOMER_REPOSITORY, useClass: DynamoCustomerRepository },
    { provide: DELIVERY_REPOSITORY, useClass: DynamoDeliveryRepository },
    { provide: PAYMENT_GATEWAY, useClass: PspHttpAdapter },
    { provide: CLOCK, useClass: SystemClock },
    { provide: ID_GENERATOR, useClass: UlidGenerator },
    ListProductsUseCase,
    GetProductUseCase,
    GetStockUseCase,
    StartCheckoutUseCase,
    PayTransactionUseCase,
    SyncTransactionStatusUseCase,
    HandlePaymentEventUseCase,
    GetCustomerUseCase,
    GetDeliveryUseCase,
    UpdateDeliveryUseCase,
  ],
})
export class AppModule {}
