import { createHash } from 'crypto';
import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import type {
  Customer,
  Delivery,
  Product,
  ProductRepository,
  StartCheckoutWrite,
  Transaction,
  TransactionRepository,
  CustomerRepository,
  DeliveryRepository,
} from '../../../domain';
import { err, ok, type Result } from '../../../shared/result';
import type { DomainError } from '../../../domain/errors';
import { DYNAMO_CLIENT } from './dynamo.client';

const SCHEMA_VERSION = 1;

function emailHash(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

@Injectable()
export class DynamoProductRepository implements ProductRepository {
  constructor(
    @Inject(DYNAMO_CLIENT) private readonly db: DynamoDBDocumentClient,
    private readonly config: ConfigService,
  ) {}

  private table(): string {
    return this.config.getOrThrow<string>('TABLE_NAME');
  }

  async findById(productId: string): Promise<Result<Product, DomainError>> {
    const result = await this.db.send(
      new GetCommand({
        TableName: this.table(),
        Key: { PK: `PRODUCT#${productId}`, SK: `PRODUCT#${productId}` },
      }),
    );
    if (!result.Item || result.Item.active === false) {
      return err({ code: 'PRODUCT_NOT_FOUND', productId });
    }
    return ok(itemToProduct(result.Item));
  }

  async list(): Promise<Result<Product[], DomainError>> {
    const result = await this.db.send(
      new QueryCommand({
        TableName: this.table(),
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: { ':pk': 'PRODUCT' },
      }),
    );
    const items = (result.Items ?? [])
      .filter((i) => i.active !== false)
      .map(itemToProduct);
    return ok(items);
  }

  async sweepExpiredReservations(productId: string): Promise<Result<number, DomainError>> {
    const now = Math.floor(Date.now() / 1000);
    const result = await this.db.send(
      new QueryCommand({
        TableName: this.table(),
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `PRODUCT#${productId}`,
          ':sk': 'RESERVATION#',
        },
        Limit: 25,
      }),
    );
    let released = 0;
    for (const item of result.Items ?? []) {
      if ((item.expiresAt as number) >= now) continue;
      try {
        await this.db.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Update: {
                  TableName: this.table(),
                  Key: { PK: `PRODUCT#${productId}`, SK: `PRODUCT#${productId}` },
                  UpdateExpression: 'SET reserved = reserved - :q, updatedAt = :now',
                  ConditionExpression: 'reserved >= :q',
                  ExpressionAttributeValues: {
                    ':q': item.quantity,
                    ':now': new Date().toISOString(),
                  },
                },
              },
              {
                Delete: {
                  TableName: this.table(),
                  Key: {
                    PK: `PRODUCT#${productId}`,
                    SK: `RESERVATION#${item.reference}`,
                  },
                },
              },
            ],
          }),
        );
        released += 1;
      } catch {
        // Concurrent sweep — ignore
      }
    }
    return ok(released);
  }
}

@Injectable()
export class DynamoTransactionRepository implements TransactionRepository {
  constructor(
    @Inject(DYNAMO_CLIENT) private readonly db: DynamoDBDocumentClient,
    private readonly config: ConfigService,
  ) {}

  private table(): string {
    return this.config.getOrThrow<string>('TABLE_NAME');
  }

  async findByReference(reference: string): Promise<Result<Transaction, DomainError>> {
    const result = await this.db.send(
      new GetCommand({
        TableName: this.table(),
        Key: { PK: `TX#${reference}`, SK: `TX#${reference}` },
      }),
    );
    if (!result.Item) return err({ code: 'TRANSACTION_NOT_FOUND', reference });
    return ok(itemToTransaction(result.Item));
  }

  async startCheckout(write: StartCheckoutWrite): Promise<Result<Transaction, DomainError>> {
    const now = new Date().toISOString();
    const productKey = {
      PK: `PRODUCT#${write.productId}`,
      SK: `PRODUCT#${write.productId}`,
    };
    const txItem = transactionToItem(write.transaction);
    const deliveryItem = deliveryToItem(write.delivery);
    const customerItem = customerToItem(write.customer);

    const transactItems = [
      {
        Update: {
          TableName: this.table(),
          Key: productKey,
          UpdateExpression: 'SET reserved = reserved + :q, updatedAt = :now',
          ConditionExpression:
            'attribute_exists(PK) AND active = :true AND stock - reserved >= :q',
          ExpressionAttributeValues: {
            ':q': write.quantity,
            ':now': now,
            ':true': true,
          },
        },
      },
      {
        Put: {
          TableName: this.table(),
          Item: {
            PK: `PRODUCT#${write.productId}`,
            SK: `RESERVATION#${write.transaction.reference}`,
            entityType: 'RESERVATION',
            quantity: write.quantity,
            reference: write.transaction.reference,
            expiresAt: write.reservationExpiresAt,
            ttl: write.reservationExpiresAt + 3600,
            schemaVersion: SCHEMA_VERSION,
            createdAt: now,
          },
          ConditionExpression: 'attribute_not_exists(PK)',
        },
      },
      {
        Put: {
          TableName: this.table(),
          Item: txItem,
          ConditionExpression: 'attribute_not_exists(PK)',
        },
      },
      {
        Put: {
          TableName: this.table(),
          Item: deliveryItem,
        },
      },
      write.isNewCustomer
        ? {
            Put: {
              TableName: this.table(),
              Item: customerItem,
              ConditionExpression: 'attribute_not_exists(PK)',
            },
          }
        : {
            Put: {
              TableName: this.table(),
              Item: customerItem,
            },
          },
    ];

    try {
      await this.db.send(new TransactWriteCommand({ TransactItems: transactItems }));
      return ok(write.transaction);
    } catch (error: unknown) {
      return mapTransactError(error, write);
    }
  }

  async attachPsp(
    reference: string,
    pspTransactionId: string,
    card: { brand: string; last4: string },
  ): Promise<Result<Transaction, DomainError>> {
    try {
      const result = await this.db.send(
        new UpdateCommand({
          TableName: this.table(),
          Key: { PK: `TX#${reference}`, SK: `TX#${reference}` },
          UpdateExpression:
            'SET pspTransactionId = :psp, card = :card, attempts = attempts + :one, paidAt = :now, updatedAt = :now',
          ConditionExpression: '#status = :pending AND attribute_not_exists(pspTransactionId)',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':psp': pspTransactionId,
            ':card': card,
            ':one': 1,
            ':now': new Date().toISOString(),
            ':pending': 'PENDING',
          },
          ReturnValues: 'ALL_NEW',
        }),
      );
      return ok(itemToTransaction(result.Attributes!));
    } catch (error: unknown) {
      if (isConditionalFailed(error)) {
        const current = await this.findByReference(reference);
        if (!current.ok) return current;
        return err({
          code: 'INVALID_TRANSACTION_STATE',
          reference,
          current: current.value.status,
          attempted: 'attachPsp',
        });
      }
      throw error;
    }
  }

  async finalizeApproved(
    reference: string,
    statusMessage?: string,
  ): Promise<Result<Transaction, DomainError>> {
    const txResult = await this.findByReference(reference);
    if (!txResult.ok) return txResult;
    const tx = txResult.value;
    if (tx.status !== 'PENDING') {
      return err({
        code: 'INVALID_TRANSACTION_STATE',
        reference,
        current: tx.status,
        attempted: 'finalizeApproved',
      });
    }

    const now = new Date().toISOString();
    try {
      await this.db.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: this.table(),
                Key: {
                  PK: `PRODUCT#${tx.productId}`,
                  SK: `PRODUCT#${tx.productId}`,
                },
                UpdateExpression:
                  'SET stock = stock - :q, reserved = reserved - :q, updatedAt = :now',
                ConditionExpression: 'reserved >= :q AND stock >= :q',
                ExpressionAttributeValues: { ':q': tx.quantity, ':now': now },
              },
            },
            {
              Update: {
                TableName: this.table(),
                Key: { PK: `TX#${reference}`, SK: `TX#${reference}` },
                UpdateExpression:
                  'SET #status = :approved, finalizedAt = :now, updatedAt = :now, statusMessage = :msg REMOVE GSI1PK, GSI1SK',
                ConditionExpression: '#status = :pending',
                ExpressionAttributeNames: { '#status': 'status' },
                ExpressionAttributeValues: {
                  ':approved': 'APPROVED',
                  ':pending': 'PENDING',
                  ':now': now,
                  ':msg': statusMessage ?? null,
                },
              },
            },
            {
              Delete: {
                TableName: this.table(),
                Key: {
                  PK: `PRODUCT#${tx.productId}`,
                  SK: `RESERVATION#${reference}`,
                },
              },
            },
            {
              Update: {
                TableName: this.table(),
                Key: { PK: `TX#${reference}`, SK: `DELIVERY#${reference}` },
                UpdateExpression:
                  'SET #status = :assigned, assignedProductId = :pid, assignedQuantity = :q, assignedAt = :now, updatedAt = :now',
                ExpressionAttributeNames: { '#status': 'status' },
                ExpressionAttributeValues: {
                  ':assigned': 'ASSIGNED',
                  ':pid': tx.productId,
                  ':q': tx.quantity,
                  ':now': now,
                },
              },
            },
          ],
        }),
      );
      return this.findByReference(reference);
    } catch (error: unknown) {
      if (isConditionalFailed(error) || isTransactionCanceled(error)) {
        const again = await this.findByReference(reference);
        if (again.ok && again.value.status === 'APPROVED') return again;
        return err({
          code: 'INVALID_TRANSACTION_STATE',
          reference,
          current: again.ok ? again.value.status : 'PENDING',
          attempted: 'finalizeApproved',
        });
      }
      throw error;
    }
  }

  async finalizeRejected(
    reference: string,
    status: 'DECLINED' | 'ERROR' | 'VOIDED',
    statusMessage?: string,
  ): Promise<Result<Transaction, DomainError>> {
    const txResult = await this.findByReference(reference);
    if (!txResult.ok) return txResult;
    const tx = txResult.value;
    if (tx.status !== 'PENDING') {
      return err({
        code: 'INVALID_TRANSACTION_STATE',
        reference,
        current: tx.status,
        attempted: `finalizeRejected:${status}`,
      });
    }

    const now = new Date().toISOString();
    try {
      await this.db.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: this.table(),
                Key: {
                  PK: `PRODUCT#${tx.productId}`,
                  SK: `PRODUCT#${tx.productId}`,
                },
                UpdateExpression: 'SET reserved = reserved - :q, updatedAt = :now',
                ConditionExpression: 'reserved >= :q',
                ExpressionAttributeValues: { ':q': tx.quantity, ':now': now },
              },
            },
            {
              Update: {
                TableName: this.table(),
                Key: { PK: `TX#${reference}`, SK: `TX#${reference}` },
                UpdateExpression:
                  'SET #status = :status, finalizedAt = :now, updatedAt = :now, statusMessage = :msg REMOVE GSI1PK, GSI1SK',
                ConditionExpression: '#status = :pending',
                ExpressionAttributeNames: { '#status': 'status' },
                ExpressionAttributeValues: {
                  ':status': status,
                  ':pending': 'PENDING',
                  ':now': now,
                  ':msg': statusMessage ?? null,
                },
              },
            },
            {
              Delete: {
                TableName: this.table(),
                Key: {
                  PK: `PRODUCT#${tx.productId}`,
                  SK: `RESERVATION#${reference}`,
                },
              },
            },
            {
              Update: {
                TableName: this.table(),
                Key: { PK: `TX#${reference}`, SK: `DELIVERY#${reference}` },
                UpdateExpression: 'SET #status = :cancelled, updatedAt = :now',
                ExpressionAttributeNames: { '#status': 'status' },
                ExpressionAttributeValues: {
                  ':cancelled': 'CANCELLED',
                  ':now': now,
                },
              },
            },
          ],
        }),
      );
      return this.findByReference(reference);
    } catch (error: unknown) {
      if (isConditionalFailed(error) || isTransactionCanceled(error)) {
        const again = await this.findByReference(reference);
        if (again.ok && again.value.status === status) return again;
        return err({
          code: 'INVALID_TRANSACTION_STATE',
          reference,
          current: again.ok ? again.value.status : 'PENDING',
          attempted: `finalizeRejected:${status}`,
        });
      }
      throw error;
    }
  }
}

@Injectable()
export class DynamoCustomerRepository implements CustomerRepository {
  constructor(
    @Inject(DYNAMO_CLIENT) private readonly db: DynamoDBDocumentClient,
    private readonly config: ConfigService,
  ) {}

  private table(): string {
    return this.config.getOrThrow<string>('TABLE_NAME');
  }

  async findById(customerId: string): Promise<Result<Customer, DomainError>> {
    const result = await this.db.send(
      new GetCommand({
        TableName: this.table(),
        Key: { PK: `CUSTOMER#${customerId}`, SK: `CUSTOMER#${customerId}` },
      }),
    );
    if (!result.Item) return err({ code: 'CUSTOMER_NOT_FOUND', customerId });
    return ok(itemToCustomer(result.Item));
  }

  async findByEmail(email: string): Promise<Result<Customer | null, DomainError>> {
    const result = await this.db.send(
      new QueryCommand({
        TableName: this.table(),
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK = :sk',
        ExpressionAttributeValues: {
          ':pk': `EMAIL#${emailHash(email)}`,
          ':sk': 'CUSTOMER',
        },
        Limit: 1,
      }),
    );
    const item = result.Items?.[0];
    return ok(item ? itemToCustomer(item) : null);
  }
}

@Injectable()
export class DynamoDeliveryRepository implements DeliveryRepository {
  constructor(
    @Inject(DYNAMO_CLIENT) private readonly db: DynamoDBDocumentClient,
    private readonly config: ConfigService,
  ) {}

  private table(): string {
    return this.config.getOrThrow<string>('TABLE_NAME');
  }

  async findByReference(reference: string): Promise<Result<Delivery, DomainError>> {
    const result = await this.db.send(
      new GetCommand({
        TableName: this.table(),
        Key: { PK: `TX#${reference}`, SK: `DELIVERY#${reference}` },
      }),
    );
    if (!result.Item) return err({ code: 'DELIVERY_NOT_FOUND', reference });
    return ok(itemToDelivery(result.Item));
  }

  async update(
    reference: string,
    patch: Partial<Pick<Delivery, 'recipientName' | 'phone' | 'address'>>,
  ): Promise<Result<Delivery, DomainError>> {
    const current = await this.findByReference(reference);
    if (!current.ok) return current;
    if (current.value.status !== 'PENDING') {
      return err({
        code: 'DELIVERY_NOT_EDITABLE',
        reference,
        status: current.value.status,
      });
    }

    const next: Delivery = {
      ...current.value,
      recipientName: patch.recipientName ?? current.value.recipientName,
      phone: patch.phone ?? current.value.phone,
      address: patch.address
        ? {
            addressLine1: patch.address.addressLine1 || current.value.address.addressLine1,
            addressLine2: patch.address.addressLine2 ?? current.value.address.addressLine2,
            city: patch.address.city || current.value.address.city,
            region: patch.address.region || current.value.address.region,
            postalCode: patch.address.postalCode ?? current.value.address.postalCode,
            country: patch.address.country || current.value.address.country,
          }
        : current.value.address,
      updatedAt: new Date().toISOString(),
    };

    await this.db.send(
      new PutCommand({
        TableName: this.table(),
        Item: deliveryToItem(next),
        ConditionExpression: '#status = :pending',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':pending': 'PENDING' },
      }),
    );
    return ok(next);
  }
}

function itemToProduct(item: Record<string, unknown>): Product {
  return {
    productId: item.productId as string,
    name: item.name as string,
    description: item.description as string,
    unit: 'HOUR',
    unitPriceCents: item.unitPriceCents as number,
    currency: 'COP',
    usdUnitPrice: item.usdUnitPrice as number,
    usdRateCop: item.usdRateCop as number,
    stock: item.stock as number,
    reserved: item.reserved as number,
    image: item.image as Product['image'],
    active: item.active as boolean,
    createdAt: item.createdAt as string,
    updatedAt: item.updatedAt as string,
  };
}

function itemToTransaction(item: Record<string, unknown>): Transaction {
  return {
    reference: item.reference as string,
    productId: item.productId as string,
    productName: item.productName as string,
    quantity: item.quantity as number,
    customerId: item.customerId as string,
    amounts: item.amounts as Transaction['amounts'],
    currency: 'COP',
    status: item.status as Transaction['status'],
    statusMessage: (item.statusMessage as string | undefined) ?? undefined,
    pspTransactionId: (item.pspTransactionId as string | undefined) ?? undefined,
    card: (item.card as Transaction['card'] | undefined) ?? undefined,
    attempts: (item.attempts as number) ?? 0,
    paidAt: (item.paidAt as string | undefined) ?? undefined,
    finalizedAt: (item.finalizedAt as string | undefined) ?? undefined,
    createdAt: item.createdAt as string,
    updatedAt: item.updatedAt as string,
  };
}

function transactionToItem(tx: Transaction): Record<string, unknown> {
  return {
    PK: `TX#${tx.reference}`,
    SK: `TX#${tx.reference}`,
    GSI1PK: tx.status === 'PENDING' ? 'TXSTATUS#PENDING' : undefined,
    GSI1SK: tx.status === 'PENDING' ? tx.createdAt : undefined,
    entityType: 'TRANSACTION',
    schemaVersion: SCHEMA_VERSION,
    ...tx,
  };
}

function deliveryToItem(d: Delivery): Record<string, unknown> {
  return {
    PK: `TX#${d.reference}`,
    SK: `DELIVERY#${d.reference}`,
    entityType: 'DELIVERY',
    schemaVersion: SCHEMA_VERSION,
    ...d,
  };
}

function customerToItem(c: Customer): Record<string, unknown> {
  return {
    PK: `CUSTOMER#${c.customerId}`,
    SK: `CUSTOMER#${c.customerId}`,
    GSI1PK: `EMAIL#${emailHash(c.email)}`,
    GSI1SK: 'CUSTOMER',
    entityType: 'CUSTOMER',
    schemaVersion: SCHEMA_VERSION,
    ...c,
  };
}

function itemToCustomer(item: Record<string, unknown>): Customer {
  return {
    customerId: item.customerId as string,
    email: item.email as string,
    fullName: item.fullName as string,
    phone: item.phone as string,
    legalId: item.legalId as string,
    legalIdType: item.legalIdType as Customer['legalIdType'],
    createdAt: item.createdAt as string,
    updatedAt: item.updatedAt as string,
  };
}

function itemToDelivery(item: Record<string, unknown>): Delivery {
  return {
    reference: item.reference as string,
    recipientName: item.recipientName as string,
    phone: item.phone as string,
    address: item.address as Delivery['address'],
    status: item.status as Delivery['status'],
    assignedProductId: (item.assignedProductId as string | undefined) ?? undefined,
    assignedQuantity: (item.assignedQuantity as number | undefined) ?? undefined,
    assignedAt: (item.assignedAt as string | undefined) ?? undefined,
    createdAt: item.createdAt as string,
    updatedAt: item.updatedAt as string,
  };
}

function isConditionalFailed(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name: string }).name === 'ConditionalCheckFailedException'
  );
}

function isTransactionCanceled(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name: string }).name === 'TransactionCanceledException'
  );
}

function mapTransactError(
  error: unknown,
  write: StartCheckoutWrite,
): Result<Transaction, DomainError> {
  if (!isTransactionCanceled(error)) throw error;
  const reasons =
    (error as { CancellationReasons?: Array<{ Code?: string }> }).CancellationReasons ?? [];
  if (reasons[0]?.Code === 'ConditionalCheckFailed') {
    return err({
      code: 'INSUFFICIENT_STOCK',
      productId: write.productId,
      available: 0,
      requested: write.quantity,
    });
  }
  if (reasons[2]?.Code === 'ConditionalCheckFailed') {
    return err({ code: 'DUPLICATE_REFERENCE', reference: write.transaction.reference });
  }
  throw error;
}
