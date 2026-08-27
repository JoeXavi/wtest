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

  it('rehydrates pay-submitted PENDING to result step', () => {
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

  it('rehydrates unpaid PENDING on summary with psp session', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        checkout: {
          step: 'summary',
          hours: 1,
          productId: 'prod_1',
          customer: {
            email: 'a@b.co',
            fullName: 'Ada',
            phone: '+573001112233',
            legalId: '123',
            legalIdType: 'CC',
          },
          delivery: {
            addressLine1: 'Calle 1 #2-3',
            city: 'Bogota',
            region: 'Cund',
            country: 'CO',
          },
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
              itemCents: 5_000_000,
              baseFeeCents: 150_000,
              deliveryFeeCents: 800_000,
              totalCents: 5_950_000,
            },
          },
          acceptance: { termsAccepted: false, dataAccepted: false },
          pspSession: {
            publicKey: 'pub',
            acceptanceToken: 't1',
            acceptPersonalAuthToken: 't2',
            policyLinks: {
              endUserPolicy: 'https://example.com/p',
              personalDataAuth: 'https://example.com/d',
            },
          },
        },
      }),
    );
    const store = createAppStore();
    expect(store.getState().checkout.step).toBe('summary');
    expect(store.getState().checkout.transaction?.status).toBe('PENDING');
    expect(store.getState().checkout.pspSession?.acceptanceToken).toBe('t1');
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
