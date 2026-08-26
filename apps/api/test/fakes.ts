import type {
  Customer,
  CustomerRepository,
  Delivery,
  DeliveryRepository,
  PaymentEvent,
  PaymentGateway,
  Product,
  ProductRepository,
  StartCheckoutWrite,
  Transaction,
  TransactionRepository,
  AcceptanceTokens,
  CreateChargeInput,
  CreateChargeResult,
  ChargeStatusResult,
  Clock,
  IdGenerator,
} from '../src/domain';
import { err, ok, type Result } from '../src/shared/result';
import type { DomainError } from '../src/domain/errors';
import { available } from '../src/domain/product';

export class InMemoryProductRepository implements ProductRepository {
  constructor(public products = new Map<string, Product>()) {}

  async findById(productId: string): Promise<Result<Product, DomainError>> {
    const p = this.products.get(productId);
    if (!p || !p.active) return err({ code: 'PRODUCT_NOT_FOUND', productId });
    return ok({ ...p });
  }

  async list(): Promise<Result<Product[], DomainError>> {
    return ok([...this.products.values()].filter((p) => p.active).map((p) => ({ ...p })));
  }

  async sweepExpiredReservations(): Promise<Result<number, DomainError>> {
    return ok(0);
  }
}

export class InMemoryTransactionRepository implements TransactionRepository {
  transactions = new Map<string, Transaction>();
  deliveries = new Map<string, Delivery>();
  customers = new Map<string, Customer>();
  reservations = new Map<string, { productId: string; quantity: number }>();

  constructor(private readonly products: InMemoryProductRepository) {}

  async findByReference(reference: string): Promise<Result<Transaction, DomainError>> {
    const tx = this.transactions.get(reference);
    if (!tx) return err({ code: 'TRANSACTION_NOT_FOUND', reference });
    return ok({ ...tx });
  }

  async startCheckout(write: StartCheckoutWrite): Promise<Result<Transaction, DomainError>> {
    const product = this.products.products.get(write.productId);
    if (!product || !product.active) {
      return err({ code: 'PRODUCT_NOT_FOUND', productId: write.productId });
    }
    if (available(product) < write.quantity) {
      return err({
        code: 'INSUFFICIENT_STOCK',
        productId: write.productId,
        available: available(product),
        requested: write.quantity,
      });
    }
    if (this.transactions.has(write.transaction.reference)) {
      return err({ code: 'DUPLICATE_REFERENCE', reference: write.transaction.reference });
    }
    product.reserved += write.quantity;
    this.products.products.set(product.productId, product);
    this.transactions.set(write.transaction.reference, { ...write.transaction });
    this.deliveries.set(write.delivery.reference, { ...write.delivery });
    this.customers.set(write.customer.customerId, { ...write.customer });
    this.reservations.set(write.transaction.reference, {
      productId: write.productId,
      quantity: write.quantity,
    });
    return ok({ ...write.transaction });
  }

  async attachPsp(
    reference: string,
    pspTransactionId: string,
    card: { brand: string; last4: string },
  ): Promise<Result<Transaction, DomainError>> {
    const tx = this.transactions.get(reference);
    if (!tx) return err({ code: 'TRANSACTION_NOT_FOUND', reference });
    if (tx.status !== 'PENDING' || tx.pspTransactionId) {
      return err({
        code: 'INVALID_TRANSACTION_STATE',
        reference,
        current: tx.status,
        attempted: 'attachPsp',
      });
    }
    const next = {
      ...tx,
      pspTransactionId,
      card: card as Transaction['card'],
      attempts: tx.attempts + 1,
      paidAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.transactions.set(reference, next);
    return ok({ ...next });
  }

  async finalizeApproved(
    reference: string,
    statusMessage?: string,
  ): Promise<Result<Transaction, DomainError>> {
    const tx = this.transactions.get(reference);
    if (!tx) return err({ code: 'TRANSACTION_NOT_FOUND', reference });
    if (tx.status !== 'PENDING') {
      return err({
        code: 'INVALID_TRANSACTION_STATE',
        reference,
        current: tx.status,
        attempted: 'finalizeApproved',
      });
    }
    const product = this.products.products.get(tx.productId)!;
    product.stock -= tx.quantity;
    product.reserved -= tx.quantity;
    this.products.products.set(product.productId, product);
    this.reservations.delete(reference);
    const delivery = this.deliveries.get(reference)!;
    this.deliveries.set(reference, {
      ...delivery,
      status: 'ASSIGNED',
      assignedProductId: tx.productId,
      assignedQuantity: tx.quantity,
      assignedAt: new Date().toISOString(),
    });
    const next = {
      ...tx,
      status: 'APPROVED' as const,
      statusMessage,
      finalizedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.transactions.set(reference, next);
    return ok({ ...next });
  }

  async finalizeRejected(
    reference: string,
    status: 'DECLINED' | 'ERROR' | 'VOIDED',
    statusMessage?: string,
  ): Promise<Result<Transaction, DomainError>> {
    const tx = this.transactions.get(reference);
    if (!tx) return err({ code: 'TRANSACTION_NOT_FOUND', reference });
    if (tx.status !== 'PENDING') {
      return err({
        code: 'INVALID_TRANSACTION_STATE',
        reference,
        current: tx.status,
        attempted: `finalizeRejected:${status}`,
      });
    }
    const product = this.products.products.get(tx.productId)!;
    product.reserved -= tx.quantity;
    this.products.products.set(product.productId, product);
    this.reservations.delete(reference);
    const delivery = this.deliveries.get(reference)!;
    this.deliveries.set(reference, { ...delivery, status: 'CANCELLED' });
    const next = {
      ...tx,
      status,
      statusMessage,
      finalizedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.transactions.set(reference, next);
    return ok({ ...next });
  }
}

export class InMemoryCustomerRepository implements CustomerRepository {
  constructor(private readonly store: Map<string, Customer>) {}

  async findById(customerId: string): Promise<Result<Customer, DomainError>> {
    const c = this.store.get(customerId);
    if (!c) return err({ code: 'CUSTOMER_NOT_FOUND', customerId });
    return ok({ ...c });
  }

  async findByEmail(email: string): Promise<Result<Customer | null, DomainError>> {
    const found = [...this.store.values()].find((c) => c.email === email.toLowerCase());
    return ok(found ? { ...found } : null);
  }
}

export class InMemoryDeliveryRepository implements DeliveryRepository {
  constructor(private readonly store: Map<string, Delivery>) {}

  async findByReference(reference: string): Promise<Result<Delivery, DomainError>> {
    const d = this.store.get(reference);
    if (!d) return err({ code: 'DELIVERY_NOT_FOUND', reference });
    return ok({ ...d });
  }

  async update(
    reference: string,
    patch: Partial<Pick<Delivery, 'recipientName' | 'phone' | 'address'>>,
  ): Promise<Result<Delivery, DomainError>> {
    const d = this.store.get(reference);
    if (!d) return err({ code: 'DELIVERY_NOT_FOUND', reference });
    if (d.status !== 'PENDING') {
      return err({ code: 'DELIVERY_NOT_EDITABLE', reference, status: d.status });
    }
    const next = {
      ...d,
      recipientName: patch.recipientName ?? d.recipientName,
      phone: patch.phone ?? d.phone,
      address: patch.address ? { ...d.address, ...patch.address } : d.address,
      updatedAt: new Date().toISOString(),
    };
    this.store.set(reference, next);
    return ok({ ...next });
  }
}

export class FakePaymentGateway implements PaymentGateway {
  publicKey = 'pub_test_fake';
  tokens: AcceptanceTokens = {
    acceptanceToken: 'acc_token',
    acceptPersonalAuthToken: 'auth_token',
    policyLinks: {
      endUserPolicy: 'https://example.com/policy',
      personalDataAuth: 'https://example.com/data',
    },
  };
  nextCharge: CreateChargeResult = {
    pspTransactionId: 'psp-1',
    status: 'PENDING',
  };
  statuses = new Map<string, ChargeStatusResult>();
  failCharge = false;

  getPublicKey(): string {
    return this.publicKey;
  }

  async getAcceptanceTokens(): Promise<Result<AcceptanceTokens, DomainError>> {
    return ok(this.tokens);
  }

  async createCharge(input: CreateChargeInput): Promise<Result<CreateChargeResult, DomainError>> {
    if (this.failCharge) {
      return err({ code: 'PSP_UNAVAILABLE', message: 'down' });
    }
    const result = { ...this.nextCharge };
    this.statuses.set(result.pspTransactionId, {
      pspTransactionId: result.pspTransactionId,
      status: result.status,
      statusMessage: result.statusMessage,
      reference: input.reference,
    });
    return ok(result);
  }

  async getChargeStatus(
    pspTransactionId: string,
  ): Promise<Result<ChargeStatusResult, DomainError>> {
    const status = this.statuses.get(pspTransactionId);
    if (!status) return err({ code: 'PSP_UNAVAILABLE', message: 'missing' });
    return ok(status);
  }

  verifyEvent(
    payload: PaymentEvent,
    _headerChecksum?: string,
  ): Result<PaymentEvent, DomainError> {
    if (!payload.signature?.checksum) return err({ code: 'INVALID_EVENT_SIGNATURE' });
    return ok(payload);
  }
}

export class FixedClock implements Clock {
  constructor(private date = new Date('2026-01-15T12:00:00.000Z')) {}
  now(): Date {
    return this.date;
  }
  nowEpochSeconds(): number {
    return Math.floor(this.date.getTime() / 1000);
  }
}

export class SeqIdGenerator implements IdGenerator {
  private n = 0;
  ulid(): string {
    this.n += 1;
    return `ULID${this.n}`;
  }
  reference(): string {
    this.n += 1;
    return `NOR-TEST-${this.n}`;
  }
}

export function seedProduct(overrides: Partial<Product> = {}): Product {
  return {
    productId: 'prod-1',
    name: 'JoeXavi Dev Hours',
    description: 'Pairing hours',
    unit: 'HOUR',
    unitPriceCents: 5_000_000,
    currency: 'COP',
    usdUnitPrice: 20,
    usdRateCop: 2500,
    stock: 48,
    reserved: 0,
    image: { key: '/img.svg', width: 1200, height: 750, alt: 'desk' },
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}
