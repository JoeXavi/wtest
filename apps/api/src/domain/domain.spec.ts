import { available, commitSale, releaseReservation, reserve } from './product';
import { attachPspId, finalize, quoteAmounts } from './transaction';
import { detectCardBrand, luhnValid } from './value-objects';
import { money, multiplyMoney } from '../shared/money';
import { andThen, err, match, ok } from '../shared/result';
import { sha256Hex } from '../infrastructure/psp/psp-http.adapter';
import { seedProduct } from '../../test/fakes';

describe('Result', () => {
  it('composes with andThen and short-circuits on err', () => {
    const result = andThen(ok(2), (n: number) => (n > 0 ? ok(n * 3) : err('neg')));
    expect(result).toEqual(ok(6));
    expect(andThen(err('x'), () => ok(1))).toEqual(err('x'));
  });

  it('matches both rails', () => {
    expect(match(ok(1), { ok: (v: number) => v + 1, err: () => 0 })).toBe(2);
    expect(match(err('e'), { ok: () => 1, err: () => 0 })).toBe(0);
  });
});

describe('Money', () => {
  it('rejects floats and negatives', () => {
    expect(money(1.5).ok).toBe(false);
    expect(money(-1).ok).toBe(false);
    expect(money(100).ok).toBe(true);
  });

  it('multiplies for hours quote', () => {
    const unit = money(5_000_000);
    expect(unit.ok).toBe(true);
    if (!unit.ok) return;
    const total = multiplyMoney(unit.value, 3);
    expect(total).toEqual(ok({ cents: 15_000_000, currency: 'COP' }));
  });
});

describe('Product stock', () => {
  it('reserves when available', () => {
    const product = seedProduct({ stock: 10, reserved: 2 });
    expect(available(product)).toBe(8);
    const reserved = reserve(product, 3);
    expect(reserved.ok).toBe(true);
    if (!reserved.ok) return;
    expect(reserved.value.product.reserved).toBe(5);
  });

  it('rejects oversell', () => {
    const product = seedProduct({ stock: 2, reserved: 1 });
    const reserved = reserve(product, 2);
    expect(reserved.ok).toBe(false);
    if (reserved.ok) return;
    expect(reserved.error.code).toBe('INSUFFICIENT_STOCK');
  });

  it('commits and releases', () => {
    const reserved = seedProduct({ stock: 10, reserved: 3 });
    const committed = commitSale(reserved, 3);
    expect(committed.ok).toBe(true);
    if (!committed.ok) return;
    expect(committed.value.stock).toBe(7);
    expect(committed.value.reserved).toBe(0);

    const held = seedProduct({ stock: 10, reserved: 3 });
    const released = releaseReservation(held, 3);
    expect(released.ok).toBe(true);
    if (!released.ok) return;
    expect(released.value.stock).toBe(10);
    expect(released.value.reserved).toBe(0);
  });
});

describe('Transaction state machine', () => {
  const base = {
    reference: 'NOR-1',
    productId: 'p1',
    productName: 'Hours',
    quantity: 2,
    customerId: 'c1',
    amounts: quoteAmounts(5_000_000, 2, 150_000, 800_000),
    currency: 'COP' as const,
    status: 'PENDING' as const,
    attempts: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('quotes 3 hours as 159500 COP', () => {
    expect(quoteAmounts(5_000_000, 3, 150_000, 800_000)).toEqual({
      itemCents: 15_000_000,
      baseFeeCents: 150_000,
      deliveryFeeCents: 800_000,
      totalCents: 15_950_000,
    });
  });

  it('attaches psp id only while pending', () => {
    const attached = attachPspId(base, 'psp-9', { brand: 'visa', last4: '4242' });
    expect(attached.ok).toBe(true);
    const again = attachPspId(
      { ...base, status: 'APPROVED' },
      'psp-9',
      { brand: 'visa', last4: '4242' },
    );
    expect(again.ok).toBe(false);
  });

  it('finalizes once', () => {
    const approved = finalize(base, 'APPROVED');
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;
    expect(finalize(approved.value, 'DECLINED').ok).toBe(false);
  });
});

describe('Card helpers', () => {
  it('validates Luhn and detects brands', () => {
    expect(luhnValid('4242424242424242')).toBe(true);
    expect(luhnValid('4111111111111111')).toBe(true);
    expect(luhnValid('1234567890123456')).toBe(false);
    expect(detectCardBrand('4242')).toBe('visa');
    expect(detectCardBrand('5555555555554444')).toBe('mastercard');
    expect(detectCardBrand('6011')).toBe('unknown');
  });
});

describe('Integrity signature', () => {
  it('matches documented concatenation hashing', () => {
    const digest = sha256Hex(
      'sk8-438k4-xmxm392-sn2m' +
        '2490000' +
        'COP' +
        'prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6',
    );
    expect(digest).toBe('37c8407747e595535433ef8f6a811d853cd943046624a0ec04662b17bbf33bf5');
  });
});
