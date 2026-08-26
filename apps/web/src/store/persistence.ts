import type { Middleware } from '@reduxjs/toolkit';
import type { CheckoutState } from './slices/checkoutSlice';
import { TOKEN_TTL_MS } from './slices/checkoutSlice';

export const STORAGE_KEY = 'norte.checkout.v1';
export const STORAGE_VERSION = 1;

export interface PersistedCheckout {
  version: number;
  savedAt: number;
  checkout: {
    step: CheckoutState['step'];
    hours: number;
    productId: string | null;
    customer: CheckoutState['customer'];
    delivery: CheckoutState['delivery'];
    card: {
      brand: CheckoutState['card'] extends null ? never : NonNullable<CheckoutState['card']>['brand'];
      last4: string;
      token?: string;
      tokenExpiresAt?: number;
    } | null;
    transaction: CheckoutState['transaction'];
    acceptance: CheckoutState['acceptance'];
  };
}

function whitelist(checkout: CheckoutState): PersistedCheckout['checkout'] {
  let card: PersistedCheckout['checkout']['card'] = null;
  if (checkout.card) {
    const pending = checkout.transaction?.status === 'PENDING';
    const tokenFresh =
      pending &&
      checkout.card.token &&
      checkout.card.tokenExpiresAt &&
      checkout.card.tokenExpiresAt > Date.now();

    card = {
      brand: checkout.card.brand,
      last4: checkout.card.last4,
      ...(tokenFresh
        ? {
            token: checkout.card.token,
            tokenExpiresAt: checkout.card.tokenExpiresAt,
          }
        : {}),
    };
  }

  return {
    step: checkout.step,
    hours: checkout.hours,
    productId: checkout.productId,
    customer: checkout.customer,
    delivery: checkout.delivery,
    card,
    transaction: checkout.transaction,
    acceptance: checkout.acceptance,
  };
}

export function serializeCheckout(checkout: CheckoutState): string {
  const payload: PersistedCheckout = {
    version: STORAGE_VERSION,
    savedAt: Date.now(),
    checkout: whitelist(checkout),
  };
  return JSON.stringify(payload);
}

export function loadPersistedCheckout(): PersistedCheckout | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedCheckout;
    if (parsed.version !== STORAGE_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    // Stale token TTL
    if (parsed.checkout.card?.tokenExpiresAt) {
      if (parsed.checkout.card.tokenExpiresAt < Date.now()) {
        delete parsed.checkout.card.token;
        delete parsed.checkout.card.tokenExpiresAt;
      }
    } else if (parsed.checkout.card?.token) {
      // Legacy without TTL — treat as expired if older than TTL from savedAt
      if (Date.now() - parsed.savedAt > TOKEN_TTL_MS) {
        delete parsed.checkout.card.token;
      }
    }
    // Drop token unless PENDING
    if (
      parsed.checkout.card?.token &&
      parsed.checkout.transaction?.status !== 'PENDING'
    ) {
      delete parsed.checkout.card.token;
      delete parsed.checkout.card.tokenExpiresAt;
    }
    return parsed;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function clearPersistedCheckout(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export const persistenceMiddleware: Middleware = (store) => (next) => (action) => {
  const result = next(action);
  const state = store.getState() as { checkout: CheckoutState };
  try {
    localStorage.setItem(STORAGE_KEY, serializeCheckout(state.checkout));
  } catch {
    // quota / private mode — ignore
  }
  return result;
};

/** Assert helper for tests: ensure sensitive fields never appear. */
export function assertNoSensitiveCardData(serialized: string): void {
  const parsed = JSON.parse(serialized) as PersistedCheckout;
  const card = parsed.checkout.card as Record<string, unknown> | null;
  if (card) {
    for (const key of ['pan', 'cvc', 'expiry', 'expMonth', 'expYear', 'number', 'cardNumber']) {
      if (key in card) {
        throw new Error(`Sensitive field leaked into persistence: ${key}`);
      }
    }
  }
  const forbidden = [/"pan"/i, /"cvc"/i, /"expiry"/i, /"expMonth"/i, /"expYear"/i, /"cardNumber"/i];
  for (const re of forbidden) {
    if (re.test(serialized)) {
      throw new Error(`Sensitive field leaked into persistence: ${re}`);
    }
  }
}
