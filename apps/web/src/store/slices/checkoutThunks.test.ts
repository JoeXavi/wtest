import { configureStore } from '@reduxjs/toolkit';
import checkoutReducer, {
  tokenizeAndContinue,
  createCheckoutTransaction,
  payCheckout,
  pollTransaction,
  initialCheckoutState,
  type CheckoutState,
} from './checkoutSlice';
import * as api from '@/services/api';
import * as psp from '@/services/pspTokenization';

jest.mock('@/services/api');
jest.mock('@/services/pspTokenization');

const mockedApi = api as jest.Mocked<typeof api>;
const mockedPsp = psp as jest.Mocked<typeof psp>;

function makeStore(checkout: CheckoutState = initialCheckoutState) {
  return configureStore({
    reducer: { checkout: checkoutReducer },
    preloadedState: { checkout },
  });
}

const customer = {
  email: 'a@b.co',
  fullName: 'Ada',
  phone: '+573001112233',
  legalId: '123',
  legalIdType: 'CC' as const,
};

const delivery = {
  addressLine1: 'Calle 1 #2-3',
  city: 'Bogota',
  region: 'Cund',
  country: 'CO',
};

describe('checkout thunks', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('tokenizeAndContinue rejects on PSP failure', async () => {
    mockedPsp.tokenizeCardFromForm.mockRejectedValue(new Error('fail'));
    const store = makeStore({ ...initialCheckoutState, step: 'details' });
    const result = await store.dispatch(
      tokenizeAndContinue({
        number: '4242',
        cvc: '123',
        expiry: '08/27',
        cardHolder: 'Ada',
        customer,
        delivery,
      }),
    );
    expect(tokenizeAndContinue.rejected.match(result)).toBe(true);
    expect(store.getState().checkout.ui.tokenizing).toBe(false);
    expect(store.getState().checkout.ui.error).toBeTruthy();
  });

  it('createCheckoutTransaction stores server amounts', async () => {
    mockedApi.startCheckout.mockResolvedValue({
      transactionReference: 'NOR-1',
      status: 'PENDING',
      amounts: {
        itemCents: 5_000_000,
        baseFeeCents: 150_000,
        deliveryFeeCents: 800_000,
        totalCents: 5_950_000,
      },
      currency: 'COP',
      psp: {
        publicKey: 'pub',
        acceptanceToken: 't1',
        acceptPersonalAuthToken: 't2',
        policyLinks: {
          endUserPolicy: 'https://example.com/p',
          personalDataAuth: 'https://example.com/d',
        },
      },
    });
    const store = makeStore({
      ...initialCheckoutState,
      productId: 'prod_1',
      hours: 1,
      customer,
      delivery,
    });
    await store.dispatch(createCheckoutTransaction());
    expect(store.getState().checkout.transaction?.breakdown.totalCents).toBe(
      5_950_000,
    );
    expect(store.getState().checkout.pspSession?.acceptanceToken).toBe('t1');
  });

  it('createCheckoutTransaction rejects when details missing', async () => {
    const store = makeStore();
    const result = await store.dispatch(createCheckoutTransaction());
    expect(createCheckoutTransaction.rejected.match(result)).toBe(true);
  });

  it('payCheckout happy path and clears token on terminal status', async () => {
    mockedApi.payTransaction.mockResolvedValue({
      transactionReference: 'NOR-1',
      status: 'APPROVED',
      amounts: {
        itemCents: 5_000_000,
        baseFeeCents: 150_000,
        deliveryFeeCents: 800_000,
        totalCents: 5_950_000,
      },
    });
    const store = makeStore({
      ...initialCheckoutState,
      step: 'summary',
      card: { brand: 'visa', last4: '4242', token: 'tok' },
      acceptance: { termsAccepted: true, dataAccepted: true },
      pspSession: {
        publicKey: 'pub',
        acceptanceToken: 't1',
        acceptPersonalAuthToken: 't2',
        policyLinks: {
          endUserPolicy: 'https://example.com/p',
          personalDataAuth: 'https://example.com/d',
        },
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
    });
    await store.dispatch(payCheckout('key'));
    expect(store.getState().checkout.step).toBe('result');
    expect(store.getState().checkout.card?.token).toBe('');
  });

  it('payCheckout rejects when policies not accepted', async () => {
    const store = makeStore({
      ...initialCheckoutState,
      card: { brand: 'visa', last4: '4242', token: 'tok' },
      pspSession: {
        publicKey: 'pub',
        acceptanceToken: 't1',
        acceptPersonalAuthToken: 't2',
        policyLinks: {
          endUserPolicy: 'https://example.com/p',
          personalDataAuth: 'https://example.com/d',
        },
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
    });
    const result = await store.dispatch(payCheckout('key'));
    expect(payCheckout.rejected.match(result)).toBe(true);
  });

  it('pollTransaction updates status', async () => {
    mockedApi.getTransaction.mockResolvedValue({
      reference: 'NOR-1',
      status: 'APPROVED',
      amounts: {
        itemCents: 5_000_000,
        baseFeeCents: 150_000,
        deliveryFeeCents: 800_000,
        totalCents: 5_950_000,
      },
      product: { name: 'JoeXavi Dev Hours', hours: 1 },
      card: { brand: 'visa', last4: '4242' },
    });
    const store = makeStore({
      ...initialCheckoutState,
      card: { brand: 'visa', last4: '4242', token: 'tok' },
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
    });
    await store.dispatch(pollTransaction('NOR-1'));
    expect(store.getState().checkout.transaction?.status).toBe('APPROVED');
    expect(store.getState().checkout.card?.token).toBe('');
  });

  it('pollTransaction rejects on failure', async () => {
    mockedApi.getTransaction.mockRejectedValue(new Error('network'));
    const store = makeStore();
    const result = await store.dispatch(pollTransaction('NOR-1'));
    expect(pollTransaction.rejected.match(result)).toBe(true);
  });
});

describe('checkout thunk error rails', () => {
  beforeEach(() => jest.resetAllMocks());

  const basePayState = {
    ...initialCheckoutState,
    step: 'summary' as const,
    card: { brand: 'visa' as const, last4: '4242', token: 'tok' },
    acceptance: { termsAccepted: true, dataAccepted: true },
    pspSession: {
      publicKey: 'pub',
      acceptanceToken: 't1',
      acceptPersonalAuthToken: 't2',
      policyLinks: {
        endUserPolicy: 'https://example.com/p',
        personalDataAuth: 'https://example.com/d',
      },
    },
    transaction: {
      id: 'NOR-1',
      reference: 'NOR-1',
      status: 'PENDING' as const,
      breakdown: {
        itemCents: 5_000_000,
        baseFeeCents: 150_000,
        deliveryFeeCents: 800_000,
        totalCents: 5_950_000,
      },
    },
  };

  it('payCheckout recovers already-paid via getTransaction', async () => {
    const { HttpError } = await import('@/services/httpClient');
    mockedApi.payTransaction.mockRejectedValue(
      new HttpError('paid', 409, {
        code: 'TRANSACTION_ALREADY_PAID',
        reference: 'NOR-1',
      }),
    );
    mockedApi.getTransaction.mockResolvedValue({
      reference: 'NOR-1',
      status: 'APPROVED',
      amounts: basePayState.transaction.breakdown,
      product: { name: 'X', hours: 1 },
    });
    const store = makeStore(basePayState);
    await store.dispatch(payCheckout('k'));
    expect(store.getState().checkout.transaction?.status).toBe('APPROVED');
  });

  it('payCheckout polls on 502 without rejecting', async () => {
    const { HttpError } = await import('@/services/httpClient');
    mockedApi.payTransaction.mockRejectedValue(new HttpError('bad gateway', 502));
    mockedApi.getTransaction.mockResolvedValue({
      reference: 'NOR-1',
      status: 'PENDING',
      amounts: basePayState.transaction.breakdown,
      product: { name: 'X', hours: 1 },
    });
    const store = makeStore(basePayState);
    const result = await store.dispatch(payCheckout('k'));
    expect(payCheckout.fulfilled.match(result)).toBe(true);
  });

  it('payCheckout rejects missing session', async () => {
    const store = makeStore(initialCheckoutState);
    const result = await store.dispatch(payCheckout('k'));
    expect(payCheckout.rejected.match(result)).toBe(true);
  });

  it('createCheckoutTransaction maps HttpError', async () => {
    const { HttpError } = await import('@/services/httpClient');
    mockedApi.startCheckout.mockRejectedValue(new HttpError('no stock', 409, { available: 1 }));
    const store = makeStore({
      ...initialCheckoutState,
      productId: 'prod_1',
      hours: 1,
      customer,
      delivery,
    });
    const result = await store.dispatch(createCheckoutTransaction());
    expect(createCheckoutTransaction.rejected.match(result)).toBe(true);
  });
});
