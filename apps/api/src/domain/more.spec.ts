import { assignProduct, cancelDelivery, updatePendingDelivery } from './delivery';
import { createEmail, createPhone, createLegalId, createReference } from './value-objects';
import { validateEnv } from '../infrastructure/config/env';
import { all, fromPromise, map, mapErr } from '../shared/result';
import { addMoney, formatCop, money } from '../shared/money';
import { SystemClock, UlidGenerator } from '../infrastructure/system/system.adapters';
import { GetCustomerUseCase, GetDeliveryUseCase, UpdateDeliveryUseCase } from '../application/use-cases/customer-delivery.use-case';
import { GetProductUseCase, GetStockUseCase } from '../application/use-cases/get-product.use-case';
import {
  InMemoryCustomerRepository,
  InMemoryDeliveryRepository,
  InMemoryProductRepository,
  seedProduct,
} from '../../test/fakes';

describe('Delivery domain', () => {
  const base = {
    reference: 'NOR-1',
    recipientName: 'Ana',
    phone: '3001234567',
    address: {
      addressLine1: 'Cra 7',
      city: 'Bogotá',
      region: 'Cundinamarca',
      country: 'CO',
    },
    status: 'PENDING' as const,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('assigns product and updates address while pending', () => {
    const assigned = assignProduct(base, 'prod-1', 2);
    expect(assigned.ok).toBe(true);
    if (!assigned.ok) return;
    expect(assigned.value.status).toBe('ASSIGNED');
    expect(assignProduct(assigned.value, 'prod-1', 1).ok).toBe(false);

    const updated = updatePendingDelivery(base, { recipientName: 'Jose' });
    expect(updated.ok).toBe(true);
    expect(updatePendingDelivery(assigned.value, { recipientName: 'X' }).ok).toBe(false);
  });

  it('cancels pending delivery', () => {
    expect(cancelDelivery(base).ok).toBe(true);
    const assigned = assignProduct(base, 'p', 1);
    if (!assigned.ok) return;
    expect(cancelDelivery(assigned.value).ok).toBe(false);
  });
});

describe('Value objects', () => {
  it('validates email phone legal id reference', () => {
    expect(createEmail('ana@example.com').ok).toBe(true);
    expect(createEmail('bad').ok).toBe(false);
    expect(createPhone('+573001234567').ok).toBe(true);
    expect(createPhone('12').ok).toBe(false);
    expect(createLegalId('CC', '12345678').ok).toBe(true);
    expect(createLegalId('CC', '12').ok).toBe(false);
    expect(createReference('NOR-1').ok).toBe(true);
    expect(createReference('').ok).toBe(false);
  });
});

describe('Env validation', () => {
  it('accepts valid config and rejects missing keys', () => {
    const valid = validateEnv({
      TABLE_NAME: 'norte-main',
      PSP_BASE_URL: 'https://example.com/v1',
      PSP_PUBLIC_KEY: 'pub',
      PSP_PRIVATE_KEY: 'prv',
      PSP_INTEGRITY_SECRET: 'int',
      PSP_EVENTS_SECRET: 'ev',
    });
    expect(valid.TABLE_NAME).toBe('norte-main');
    expect(() => validateEnv({})).toThrow(/Invalid environment/);
  });
});

describe('Result and money helpers', () => {
  it('maps and collects results', () => {
    expect(map({ ok: true, value: 2 }, (n) => n * 2)).toEqual({ ok: true, value: 4 });
    expect(map({ ok: false, error: 'x' }, (n: number) => n * 2)).toEqual({ ok: false, error: 'x' });
    expect(mapErr({ ok: false, error: 'x' }, (e) => e + e)).toEqual({ ok: false, error: 'xx' });
    expect(mapErr({ ok: true, value: 1 }, (e: string) => e)).toEqual({ ok: true, value: 1 });
    expect(all([{ ok: true, value: 1 }, { ok: true, value: 2 }])).toEqual({
      ok: true,
      value: [1, 2],
    });
    expect(all([{ ok: true, value: 1 }, { ok: false, error: 'e' }]).ok).toBe(false);
  });

  it('fromPromise maps rejections', async () => {
    const okResult = await fromPromise(Promise.resolve(1), () => 'err');
    expect(okResult).toEqual({ ok: true, value: 1 });
    const errResult = await fromPromise(Promise.reject(new Error('x')), () => 'err');
    expect(errResult).toEqual({ ok: false, error: 'err' });
  });

  it('adds money and formats COP', () => {
    const a = money(100);
    const b = money(50);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(addMoney(a.value, b.value)).toEqual({ ok: true, value: { cents: 150, currency: 'COP' } });
    expect(
      addMoney(a.value, { cents: 50, currency: 'USD' as 'COP' }).ok,
    ).toBe(false);
    expect(formatCop(15_950_000)).toContain('159.500');
  });
});

describe('System adapters', () => {
  it('provides clock and ids', () => {
    const clock = new SystemClock();
    expect(clock.now()).toBeInstanceOf(Date);
    expect(clock.nowEpochSeconds()).toBeGreaterThan(0);
    const ids = new UlidGenerator();
    expect(ids.ulid().length).toBeGreaterThan(10);
    expect(ids.reference().startsWith('NOR-')).toBe(true);
  });
});

describe('Customer delivery and product use cases', () => {
  it('gets and updates delivery', async () => {
    const deliveries = new InMemoryDeliveryRepository(
      new Map([
        [
          'NOR-1',
          {
            reference: 'NOR-1',
            recipientName: 'Ana',
            phone: '3001234567',
            address: {
              addressLine1: 'Cra 7',
              city: 'Bogotá',
              region: 'Cundinamarca',
              country: 'CO',
            },
            status: 'PENDING',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      ]),
    );
    const get = new GetDeliveryUseCase(deliveries);
    const update = new UpdateDeliveryUseCase(deliveries);
    const found = await get.execute('NOR-1');
    expect(found.ok).toBe(true);
    const patched = await update.execute('NOR-1', { city: 'Medellín', recipientName: 'Jose' });
    expect(patched.ok).toBe(true);
    if (!patched.ok) return;
    expect(patched.value.address.city).toBe('Medellín');
  });

  it('gets customer product and stock', async () => {
    const products = new InMemoryProductRepository(new Map([['prod-1', seedProduct()]]));
    const customers = new InMemoryCustomerRepository(
      new Map([
        [
          'c1',
          {
            customerId: 'c1',
            email: 'a@b.com',
            fullName: 'A',
            phone: '3001234567',
            legalId: '12345678',
            legalIdType: 'CC',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      ]),
    );
    expect((await new GetCustomerUseCase(customers).execute('c1')).ok).toBe(true);
    expect((await new GetProductUseCase(products).execute('prod-1')).ok).toBe(true);
    expect((await new GetStockUseCase(products).execute('prod-1')).ok).toBe(true);
    expect((await new GetProductUseCase(products).execute('missing')).ok).toBe(false);
  });
});
