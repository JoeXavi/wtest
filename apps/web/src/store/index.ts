import { configureStore } from '@reduxjs/toolkit';
import productsReducer from './slices/productsSlice';
import checkoutReducer, {
  hydrateCheckout,
  initialCheckoutState,
  type CheckoutState,
} from './slices/checkoutSlice';
import {
  loadPersistedCheckout,
  persistenceMiddleware,
} from './persistence';

function rehydrateCheckout(): CheckoutState {
  const persisted = loadPersistedCheckout();
  if (!persisted) return initialCheckoutState;

  const base: CheckoutState = {
    ...initialCheckoutState,
    step: persisted.checkout.step,
    hours: persisted.checkout.hours,
    productId: persisted.checkout.productId,
    customer: persisted.checkout.customer,
    delivery: persisted.checkout.delivery,
    card: persisted.checkout.card
      ? {
          brand: persisted.checkout.card.brand,
          last4: persisted.checkout.card.last4,
          token: persisted.checkout.card.token ?? '',
          tokenExpiresAt: persisted.checkout.card.tokenExpiresAt,
        }
      : null,
    transaction: persisted.checkout.transaction,
    acceptance: persisted.checkout.acceptance,
    pspSession: persisted.checkout.pspSession ?? null,
  };

  return base;
}

export function createAppStore(preloaded?: {
  checkout?: CheckoutState;
}) {
  const store = configureStore({
    reducer: {
      products: productsReducer,
      checkout: checkoutReducer,
    },
    middleware: (getDefault) =>
      getDefault({
        serializableCheck: false,
      }).concat(persistenceMiddleware),
    preloadedState: preloaded
      ? { checkout: preloaded.checkout ?? initialCheckoutState }
      : undefined,
  });

  if (!preloaded) {
    const hydrated = rehydrateCheckout();
    if (hydrated !== initialCheckoutState) {
      store.dispatch(hydrateCheckout(hydrated));
    }
  }

  return store;
}

export type AppStore = ReturnType<typeof createAppStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];

export const store = createAppStore();
