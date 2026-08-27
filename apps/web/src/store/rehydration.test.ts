import { rehydrationPath } from './rehydration';
import type { CheckoutTransaction } from './slices/checkoutSlice';

const breakdown = {
  itemCents: 5_000_000,
  baseFeeCents: 150_000,
  deliveryFeeCents: 800_000,
  totalCents: 5_950_000,
};

const pendingTx: CheckoutTransaction = {
  id: 'NOR-1',
  reference: 'NOR-1',
  status: 'PENDING',
  breakdown,
};

describe('rehydrationPath', () => {
  it('routes unpaid PENDING to summary', () => {
    expect(rehydrationPath('summary', pendingTx)).toBe('/checkout/summary');
  });

  it('routes pay-submitted PENDING to result', () => {
    expect(rehydrationPath('result', pendingTx)).toBe('/checkout/result');
  });

  it('routes terminal statuses to result', () => {
    expect(
      rehydrationPath('summary', { ...pendingTx, status: 'APPROVED' }),
    ).toBe('/checkout/result');
    expect(
      rehydrationPath('summary', { ...pendingTx, status: 'VOIDED' }),
    ).toBe('/checkout/result');
  });

  it('restores forms without a transaction', () => {
    expect(rehydrationPath('details', null)).toBe('/checkout');
    expect(rehydrationPath('summary', null)).toBe('/checkout/summary');
  });

  it('does not navigate from product step', () => {
    expect(rehydrationPath('product', null)).toBeNull();
    expect(rehydrationPath('product', pendingTx)).toBeNull();
  });
});
