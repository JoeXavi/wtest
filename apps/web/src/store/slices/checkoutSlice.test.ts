import checkoutReducer, {
  backToStore,
  closeSheet,
  hydrateCheckout,
  initialCheckoutState,
  openDetails,
  retryWithNewCard,
  selectHours,
  setProductId,
  tokenizeAndContinue,
  createCheckoutTransaction,
  payCheckout,
  type CheckoutState,
} from './checkoutSlice';
import { configureStore } from '@reduxjs/toolkit';

function reduce(
  state: CheckoutState | undefined,
  action: Parameters<typeof checkoutReducer>[1],
) {
  return checkoutReducer(state, action);
}

function makeStore(checkout: CheckoutState) {
  return configureStore({
    reducer: { checkout: checkoutReducer },
    preloadedState: { checkout },
  });
}

describe('checkout reducer transitions', () => {
  it('product → details via openDetails', () => {
    let state = reduce(undefined, { type: '@@init' });
    state = reduce(state, setProductId('prod_1'));
    state = reduce(state, selectHours(3));
    state = reduce(state, openDetails());
    expect(state.step).toBe('details');
    expect(state.hours).toBe(3);
  });

  it('details → product via closeSheet', () => {
    let state = reduce(
      { ...initialCheckoutState, step: 'details' },
      closeSheet(),
    );
    expect(state.step).toBe('product');
  });

  it('details → summary via tokenizeAndContinue.fulfilled', () => {
    const state = reduce(
      { ...initialCheckoutState, step: 'details', ui: { ...initialCheckoutState.ui, tokenizing: true } },
      {
        type: tokenizeAndContinue.fulfilled.type,
        payload: {
          card: {
            brand: 'visa',
            last4: '4242',
            token: 'tok_x',
            tokenExpiresAt: Date.now() + 1000,
          },
          customer: {
            email: 'a@b.co',
            fullName: 'Ada Lovelace',
            phone: '+573001112233',
            legalId: '123456',
            legalIdType: 'CC',
          },
          delivery: {
            addressLine1: 'Calle 1 #2-3',
            city: 'Bogotá',
            region: 'Cundinamarca',
            country: 'CO',
          },
        },
      },
    );
    expect(state.step).toBe('summary');
    expect(state.card?.last4).toBe('4242');
    expect(state.customer?.email).toBe('a@b.co');
  });

  it('summary → result via payCheckout.fulfilled', () => {
    const state = reduce(
      {
        ...initialCheckoutState,
        step: 'summary',
        card: { brand: 'visa', last4: '4242', token: 'tok' },
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
      },
      {
        type: payCheckout.fulfilled.type,
        payload: {
          transactionReference: 'NOR-1',
          status: 'PENDING',
          amounts: {
            itemCents: 15_000_000,
            baseFeeCents: 150_000,
            deliveryFeeCents: 800_000,
            totalCents: 15_950_000,
          },
        },
      },
    );
    expect(state.step).toBe('result');
  });

  it('result → details via retryWithNewCard preserves delivery', () => {
    const delivery = {
      addressLine1: 'Calle 1 #2-3',
      city: 'Bogotá',
      region: 'Cundinamarca',
      country: 'CO',
    };
    const customer = {
      email: 'a@b.co',
      fullName: 'Ada Lovelace',
      phone: '+573001112233',
      legalId: '123456',
      legalIdType: 'CC' as const,
    };
    const state = reduce(
      {
        ...initialCheckoutState,
        step: 'result',
        delivery,
        customer,
        card: { brand: 'visa', last4: '1111', token: '' },
        transaction: {
          id: 'NOR-1',
          reference: 'NOR-1',
          status: 'DECLINED',
          breakdown: {
            itemCents: 5_000_000,
            baseFeeCents: 150_000,
            deliveryFeeCents: 800_000,
            totalCents: 5_950_000,
          },
        },
      },
      retryWithNewCard(),
    );
    expect(state.step).toBe('details');
    expect(state.card).toBeNull();
    expect(state.delivery).toEqual(delivery);
    expect(state.customer).toEqual(customer);
  });

  it('result → product via backToStore', () => {
    const state = reduce(
      { ...initialCheckoutState, step: 'result', hours: 5 },
      backToStore(),
    );
    expect(state).toEqual(initialCheckoutState);
  });

  it('hydrateCheckout replaces state', () => {
    const hydrated: CheckoutState = {
      ...initialCheckoutState,
      step: 'summary',
      hours: 2,
    };
    const state = reduce(initialCheckoutState, hydrateCheckout(hydrated));
    expect(state.step).toBe('summary');
    expect(state.hours).toBe(2);
  });

  it('createCheckoutTransaction.fulfilled stores amounts from server', () => {
    const state = reduce(initialCheckoutState, {
      type: createCheckoutTransaction.fulfilled.type,
      payload: {
        transactionReference: 'NOR-ABC',
        status: 'PENDING',
        amounts: {
          itemCents: 15_000_000,
          baseFeeCents: 150_000,
          deliveryFeeCents: 800_000,
          totalCents: 15_950_000,
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
      },
    });
    expect(state.transaction?.breakdown.totalCents).toBe(15_950_000);
    expect(state.pspSession?.acceptanceToken).toBe('t1');
  });
});

describe('payCheckout double-tap guard', () => {
  it('condition blocks when already submitting', async () => {
    const store = makeStore({
      ...initialCheckoutState,
      step: 'summary',
      pspSession: {
        publicKey: 'pub',
        acceptanceToken: 't1',
        acceptPersonalAuthToken: 't2',
        policyLinks: {
          endUserPolicy: 'https://example.com/p',
          personalDataAuth: 'https://example.com/d',
        },
      },
      acceptance: { termsAccepted: true, dataAccepted: true },
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
      ui: { ...initialCheckoutState.ui, submitting: true },
    });

    const result = await store.dispatch(payCheckout('key-1'));
    expect(payCheckout.rejected.match(result)).toBe(true);
    expect((result as { meta: { condition?: boolean } }).meta.condition).toBe(
      true,
    );
  });
});

describe('createCheckoutTransaction double-dispatch guard', () => {
  it('condition blocks when already submitting', async () => {
    const store = makeStore({
      ...initialCheckoutState,
      productId: 'prod_1',
      hours: 1,
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
      ui: { ...initialCheckoutState.ui, submitting: true },
    });

    const result = await store.dispatch(createCheckoutTransaction());
    expect(createCheckoutTransaction.rejected.match(result)).toBe(true);
    expect((result as { meta: { condition?: boolean } }).meta.condition).toBe(
      true,
    );
    expect(store.getState().checkout.ui.submitting).toBe(true);
    expect(store.getState().checkout.ui.error).toBeNull();
  });

  it('condition blocks when a transaction already exists', async () => {
    const store = makeStore({
      ...initialCheckoutState,
      productId: 'prod_1',
      hours: 1,
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

    const result = await store.dispatch(createCheckoutTransaction());
    expect(createCheckoutTransaction.rejected.match(result)).toBe(true);
    expect((result as { meta: { condition?: boolean } }).meta.condition).toBe(
      true,
    );
    expect(store.getState().checkout.transaction?.reference).toBe('NOR-1');
  });
});
