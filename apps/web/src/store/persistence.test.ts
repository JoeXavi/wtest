import {
  assertNoSensitiveCardData,
  loadPersistedCheckout,
  serializeCheckout,
  STORAGE_KEY,
} from './persistence';
import {
  initialCheckoutState,
  openDetails,
  selectHours,
  setProductId,
  type CheckoutState,
} from './slices/checkoutSlice';
import { createAppStore } from './index';

describe('persistence middleware', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('writes whitelisted fields and never PAN/CVC/expiry', () => {
    const state: CheckoutState = {
      ...initialCheckoutState,
      step: 'summary',
      hours: 3,
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
        city: 'Bogotá',
        region: 'Cund',
        country: 'CO',
      },
      card: {
        brand: 'visa',
        last4: '4242',
        token: 'tok_live',
        tokenExpiresAt: Date.now() + 60_000,
      },
      transaction: {
        id: 'NOR-1',
        reference: 'NOR-1',
        status: 'PENDING',
        breakdown: {
          itemCents: 15_000_000,
          baseFeeCents: 150_000,
          deliveryFeeCents: 800_000,
          totalCents: 15_950_000,
        },
      },
    };

    const serialized = serializeCheckout(state);
    expect(JSON.parse(serialized).checkout.card.last4).toBe('4242');
    expect(JSON.parse(serialized).checkout.card.token).toBe('tok_live');
    assertNoSensitiveCardData(serialized);
    expect(serialized).not.toMatch(/cvc/i);
    expect(serialized).not.toMatch(/expiry/i);
    expect(serialized).not.toMatch(/4242424242424242/);
  });

  it('omits card token when not PENDING', () => {
    const state: CheckoutState = {
      ...initialCheckoutState,
      card: {
        brand: 'visa',
        last4: '4242',
        token: 'tok_should_drop',
        tokenExpiresAt: Date.now() + 60_000,
      },
      transaction: {
        id: 'NOR-1',
        reference: 'NOR-1',
        status: 'APPROVED',
        breakdown: {
          itemCents: 5_000_000,
          baseFeeCents: 150_000,
          deliveryFeeCents: 800_000,
          totalCents: 5_950_000,
        },
      },
    };
    const parsed = JSON.parse(serializeCheckout(state));
    expect(parsed.checkout.card.token).toBeUndefined();
  });

  it('middleware persists on dispatch', () => {
    const store = createAppStore({ checkout: initialCheckoutState });
    store.dispatch(setProductId('prod_1'));
    store.dispatch(selectHours(2));
    store.dispatch(openDetails());
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    const loaded = loadPersistedCheckout();
    expect(loaded?.checkout.step).toBe('details');
    expect(loaded?.checkout.hours).toBe(2);
  });
});

describe('rehydration cases', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('PENDING transaction restores with token if fresh', () => {
    const expires = Date.now() + 10 * 60_000;
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
            tokenExpiresAt: expires,
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
    const loaded = loadPersistedCheckout();
    expect(loaded?.checkout.transaction?.status).toBe('PENDING');
    expect(loaded?.checkout.card?.token).toBe('tok');
  });

  it('terminal status keeps result once', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        checkout: {
          step: 'result',
          hours: 1,
          productId: 'prod_1',
          customer: null,
          delivery: null,
          card: { brand: 'visa', last4: '4242' },
          transaction: {
            id: 'NOR-1',
            reference: 'NOR-1',
            status: 'APPROVED',
            breakdown: {
              itemCents: 5_000_000,
              baseFeeCents: 150_000,
              deliveryFeeCents: 800_000,
              totalCents: 5_950_000,
            },
          },
          acceptance: { termsAccepted: true, dataAccepted: true },
        },
      }),
    );
    const loaded = loadPersistedCheckout();
    expect(loaded?.checkout.transaction?.status).toBe('APPROVED');
    expect(loaded?.checkout.card?.token).toBeUndefined();
  });

  it('details/summary without transaction restores step', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        checkout: {
          step: 'details',
          hours: 2,
          productId: 'prod_1',
          customer: {
            email: 'a@b.co',
            fullName: 'Ada',
            phone: '+573001112233',
            legalId: '1',
            legalIdType: 'CC',
          },
          delivery: {
            addressLine1: 'Calle 1 #2-3',
            city: 'Bogotá',
            region: 'Cund',
            country: 'CO',
          },
          card: null,
          transaction: null,
          acceptance: { termsAccepted: false, dataAccepted: false },
        },
      }),
    );
    expect(loadPersistedCheckout()?.checkout.step).toBe('details');
  });

  it('schema mismatch discards state', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 999, savedAt: Date.now(), checkout: {} }),
    );
    expect(loadPersistedCheckout()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
