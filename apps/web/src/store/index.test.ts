import {
  createAppStore,
} from './index';
import { STORAGE_KEY } from './persistence';
import { initialCheckoutState } from './slices/checkoutSlice';

describe('createAppStore rehydration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts fresh without persisted state', () => {
    const store = createAppStore();
    expect(store.getState().checkout.step).toBe('product');
  });

  it('rehydrates PENDING transaction to result step', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        checkout: {
          step: 'result',
          hours: 2,
          productId: 'prod_1',
          customer: null,
          delivery: null,
          card: {
            brand: 'visa',
            last4: '4242',
            token: 'tok',
            tokenExpiresAt: Date.now() + 60_000,
          },
          transaction: {
            id: 'NOR-1',
            reference: 'NOR-1',
            status: 'PENDING',
            breakdown: {
              itemCents: 10_000_000,
              baseFeeCents: 150_000,
              deliveryFeeCents: 800_000,
              totalCents: 10_950_000,
            },
          },
          acceptance: { termsAccepted: true, dataAccepted: true },
        },
      }),
    );
    const store = createAppStore();
    expect(store.getState().checkout.step).toBe('result');
    expect(store.getState().checkout.transaction?.status).toBe('PENDING');
    expect(store.getState().checkout.card?.token).toBe('tok');
  });

  it('accepts explicit preloaded checkout without reading storage', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        checkout: { ...initialCheckoutState, step: 'summary', hours: 9 },
      }),
    );
    const store = createAppStore({
      checkout: { ...initialCheckoutState, step: 'details', hours: 2 },
    });
    expect(store.getState().checkout.step).toBe('details');
    expect(store.getState().checkout.hours).toBe(2);
  });
});
