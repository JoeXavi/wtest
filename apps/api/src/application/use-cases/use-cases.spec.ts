import { ConfigService } from '@nestjs/config';
import { StartCheckoutUseCase } from './start-checkout.use-case';
import { PayTransactionUseCase } from './pay-transaction.use-case';
import { CancelCheckoutUseCase } from './cancel-checkout.use-case';
import { HandlePaymentEventUseCase, SyncTransactionStatusUseCase } from './sync-transaction.use-case';
import { ListProductsUseCase } from './list-products.use-case';
import { err } from '../../shared/result';
import {
  FakePaymentGateway,
  FixedClock,
  InMemoryCustomerRepository,
  InMemoryDeliveryRepository,
  InMemoryProductRepository,
  InMemoryTransactionRepository,
  SeqIdGenerator,
  seedProduct,
} from '../../../test/fakes';

function build() {
  const products = new InMemoryProductRepository(new Map([['prod-1', seedProduct()]]));
  const transactions = new InMemoryTransactionRepository(products);
  const customers = new InMemoryCustomerRepository(transactions.customers);
  const deliveries = new InMemoryDeliveryRepository(transactions.deliveries);
  const payments = new FakePaymentGateway();
  const config = {
    get: (key: string) => {
      const map: Record<string, number> = {
        PRICING_BASE_FEE_CENTS: 150000,
        PRICING_DELIVERY_FEE_CENTS: 800000,
        RESERVATION_TTL_SECONDS: 900,
      };
      return map[key];
    },
  } as unknown as ConfigService;

  const start = new StartCheckoutUseCase(
    products,
    transactions,
    customers,
    payments,
    new FixedClock(),
    new SeqIdGenerator(),
    config,
  );
  const pay = new PayTransactionUseCase(transactions, customers, deliveries, payments);
  const cancel = new CancelCheckoutUseCase(transactions);
  const sync = new SyncTransactionStatusUseCase(transactions, payments);
  const handle = new HandlePaymentEventUseCase(transactions, payments);
  const list = new ListProductsUseCase(products);
  return { products, transactions, payments, start, pay, cancel, sync, handle, list };
}

const checkoutCmd = {
  productId: 'prod-1',
  hours: 3,
  customer: {
    email: 'ana@example.com',
    fullName: 'Ana Rivera',
    phone: '3001234567',
    legalId: '1234567890',
    legalIdType: 'CC' as const,
  },
  delivery: {
    addressLine1: 'Cra 7 #32-16',
    city: 'Bogotá',
    region: 'Cundinamarca',
    country: 'CO',
    phone: '3001234567',
    recipientName: 'Ana Rivera',
  },
};

describe('Checkout use cases', () => {
  it('lists products with available stock', async () => {
    const { list } = build();
    const result = await list.execute();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]?.available).toBe(96);
  });

  it('propagates product list failures', async () => {
    const { list, products } = build();
    products.list = async () => err({ code: 'PRODUCT_NOT_FOUND', productId: 'x' });
    const result = await list.execute();
    expect(result.ok).toBe(false);
  });

  it('starts checkout and reserves stock', async () => {
    const { start, products } = build();
    const result = await start.execute(checkoutCmd);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.amounts.totalCents).toBe(15_950_000);
    expect(products.products.get('prod-1')?.reserved).toBe(3);
  });

  it('rejects insufficient stock', async () => {
    const { start, products } = build();
    products.products.set('prod-1', seedProduct({ stock: 1, reserved: 0 }));
    const result = await start.execute({ ...checkoutCmd, hours: 2 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INSUFFICIENT_STOCK');
  });

  it('cancels unpaid checkout and releases stock', async () => {
    const { start, cancel, products } = build();
    const started = await start.execute(checkoutCmd);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const cancelled = await cancel.execute(started.value.transactionReference);
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok) return;
    expect(cancelled.value.status).toBe('VOIDED');
    expect(products.products.get('prod-1')?.reserved).toBe(0);
    expect(products.products.get('prod-1')?.stock).toBe(96);
  });

  it('pays and finalizes approved via sync', async () => {
    const { start, pay, sync, payments, products } = build();
    const started = await start.execute(checkoutCmd);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    payments.nextCharge = { pspTransactionId: 'psp-ok', status: 'PENDING' };
    const paid = await pay.execute(started.value.transactionReference, {
      cardToken: 'tok_test',
      installments: 1,
      acceptanceToken: 'a',
      acceptPersonalAuth: 'b',
      cardBrand: 'visa',
      cardLast4: '4242',
    });
    expect(paid.ok).toBe(true);

    payments.statuses.set('psp-ok', {
      pspTransactionId: 'psp-ok',
      status: 'APPROVED',
      reference: started.value.transactionReference,
    });

    const synced = await sync.execute(started.value.transactionReference);
    expect(synced.ok).toBe(true);
    if (!synced.ok) return;
    expect(synced.value.status).toBe('APPROVED');
    expect(products.products.get('prod-1')?.stock).toBe(93);
    expect(products.products.get('prod-1')?.reserved).toBe(0);
  });

  it('releases stock on decline via webhook', async () => {
    const { start, pay, handle, payments, products } = build();
    const started = await start.execute(checkoutCmd);
    if (!started.ok) throw new Error('start failed');

    payments.nextCharge = { pspTransactionId: 'psp-bad', status: 'PENDING' };
    await pay.execute(started.value.transactionReference, {
      cardToken: 'tok_test',
      installments: 1,
      acceptanceToken: 'a',
      acceptPersonalAuth: 'b',
      cardBrand: 'visa',
      cardLast4: '1111',
    });

    const event = await handle.execute({
      eventType: 'transaction.updated',
      environment: 'test',
      data: {
        transaction: {
          id: 'psp-bad',
          status: 'DECLINED',
          statusMessage: 'Insufficient funds',
          reference: started.value.transactionReference,
          amountInCents: 15_950_000,
        },
      },
      signature: { properties: ['transaction.id'], checksum: 'abc' },
      timestamp: 1,
    });
    expect(event.ok).toBe(true);
    expect(products.products.get('prod-1')?.stock).toBe(96);
    expect(products.products.get('prod-1')?.reserved).toBe(0);
  });

  it('is idempotent when webhook races sync', async () => {
    const { start, pay, sync, handle, payments } = build();
    const started = await start.execute(checkoutCmd);
    if (!started.ok) throw new Error('start failed');
    payments.nextCharge = { pspTransactionId: 'psp-race', status: 'PENDING' };
    await pay.execute(started.value.transactionReference, {
      cardToken: 'tok',
      installments: 1,
      acceptanceToken: 'a',
      acceptPersonalAuth: 'b',
      cardBrand: 'visa',
      cardLast4: '4242',
    });
    payments.statuses.set('psp-race', {
      pspTransactionId: 'psp-race',
      status: 'APPROVED',
      reference: started.value.transactionReference,
    });

    const a = await sync.execute(started.value.transactionReference);
    const b = await handle.execute({
      eventType: 'transaction.updated',
      environment: 'test',
      data: {
        transaction: {
          id: 'psp-race',
          status: 'APPROVED',
          reference: started.value.transactionReference,
          amountInCents: 15_950_000,
        },
      },
      signature: { properties: ['transaction.id'], checksum: 'abc' },
      timestamp: 1,
    });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
  });
});
