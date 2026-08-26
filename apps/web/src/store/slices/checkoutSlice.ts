import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit';
import type {
  AmountBreakdown,
  CardBrand,
  CustomerInput,
  DeliveryInput,
  LegalIdType,
  StartCheckoutResponse,
  TransactionStatus,
} from '@norte/contracts';
import * as api from '@/services/api';
import { HttpError } from '@/services/httpClient';
import { tokenizeCardFromForm } from '@/services/pspTokenization';
import { copy } from '@/copy';

export type CheckoutStep = 'product' | 'details' | 'summary' | 'result';

export interface CheckoutCustomer {
  email: string;
  fullName: string;
  phone: string;
  legalId: string;
  legalIdType: LegalIdType;
}

export interface CheckoutDelivery {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  region: string;
  postalCode?: string;
  country: string;
}

export interface CheckoutCard {
  brand: CardBrand;
  last4: string;
  token: string;
  tokenExpiresAt?: number;
}

export interface CheckoutTransaction {
  id: string;
  reference: string;
  status: TransactionStatus;
  statusMessage?: string;
  breakdown: AmountBreakdown;
}

/** Short-lived PSP acceptance tokens — never persisted. */
export interface PspSession {
  publicKey: string;
  acceptanceToken: string;
  acceptPersonalAuthToken: string;
  policyLinks: {
    endUserPolicy: string;
    personalDataAuth: string;
  };
}

export interface CheckoutState {
  step: CheckoutStep;
  hours: number;
  productId: string | null;
  customer: CheckoutCustomer | null;
  delivery: CheckoutDelivery | null;
  card: CheckoutCard | null;
  acceptance: { termsAccepted: boolean; dataAccepted: boolean };
  transaction: CheckoutTransaction | null;
  pspSession: PspSession | null;
  ui: {
    tokenizing: boolean;
    submitting: boolean;
    polling: boolean;
    error: string | null;
  };
}

export const TOKEN_TTL_MS = 30 * 60 * 1000;

export const initialCheckoutState: CheckoutState = {
  step: 'product',
  hours: 1,
  productId: null,
  customer: null,
  delivery: null,
  card: null,
  acceptance: { termsAccepted: false, dataAccepted: false },
  transaction: null,
  pspSession: null,
  ui: {
    tokenizing: false,
    submitting: false,
    polling: false,
    error: null,
  },
};

export const tokenizeAndContinue = createAsyncThunk(
  'checkout/tokenizeAndContinue',
  async (
    input: {
      number: string;
      cvc: string;
      expiry: string;
      cardHolder: string;
      customer: CheckoutCustomer;
      delivery: CheckoutDelivery;
    },
    { rejectWithValue },
  ) => {
    try {
      const result = await tokenizeCardFromForm({
        number: input.number,
        cvc: input.cvc,
        expiry: input.expiry,
        cardHolder: input.cardHolder,
      });
      return {
        card: {
          brand: result.brand,
          last4: result.last4,
          token: result.token,
          tokenExpiresAt: Date.now() + TOKEN_TTL_MS,
        } satisfies CheckoutCard,
        customer: input.customer,
        delivery: input.delivery,
      };
    } catch {
      return rejectWithValue(copy.tokenizationError);
    }
  },
);

export const createCheckoutTransaction = createAsyncThunk(
  'checkout/createTransaction',
  async (_, { getState, rejectWithValue }) => {
    const state = getState() as { checkout: CheckoutState };
    const { productId, hours, customer, delivery } = state.checkout;
    if (!productId || !customer || !delivery) {
      return rejectWithValue('Missing checkout details');
    }

    const customerInput: CustomerInput = { ...customer };
    const deliveryInput: DeliveryInput = {
      ...delivery,
      phone: customer.phone,
      recipientName: customer.fullName,
    };

    try {
      const response = await api.startCheckout({
        productId,
        hours,
        customer: customerInput,
        delivery: deliveryInput,
      });
      return response;
    } catch (err) {
      if (err instanceof HttpError) {
        return rejectWithValue({
          message: err.message,
          status: err.status,
          body: err.body,
        });
      }
      return rejectWithValue({ message: copy.networkError });
    }
  },
);

export const payCheckout = createAsyncThunk(
  'checkout/pay',
  async (idempotencyKey: string | undefined, { getState, rejectWithValue, dispatch }) => {
    // Guard: only one in-flight pay at a time is enforced via ui.submitting in the slice
    const state = getState() as { checkout: CheckoutState };
    const { transaction, card, pspSession, acceptance } = state.checkout;

    if (!transaction || !card || !pspSession) {
      return rejectWithValue('Missing payment session');
    }
    if (!acceptance.termsAccepted || !acceptance.dataAccepted) {
      return rejectWithValue(copy.acceptBoth);
    }

    try {
      const response = await api.payTransaction(
        transaction.reference,
        {
          cardToken: card.token,
          installments: 1,
          acceptanceToken: pspSession.acceptanceToken,
          acceptPersonalAuth: pspSession.acceptPersonalAuthToken,
          cardBrand: card.brand,
          cardLast4: card.last4,
        },
        idempotencyKey,
      );
      return response;
    } catch (err) {
      if (err instanceof HttpError && err.status === 409) {
        const body = err.body as { code?: string; reference?: string } | undefined;
        if (body?.code === 'TRANSACTION_ALREADY_PAID' || body?.reference) {
          const ref = body.reference ?? transaction.reference;
          try {
            const tx = await api.getTransaction(ref);
            return {
              transactionReference: tx.reference,
              status: tx.status,
              statusMessage: tx.statusMessage,
              amounts: tx.amounts,
            };
          } catch {
            /* fall through */
          }
        }
      }
      // Network failure: never silently retry — poll by reference
      if (err instanceof TypeError || (err instanceof HttpError && err.status >= 500)) {
        void dispatch(pollTransaction(transaction.reference));
        return {
          transactionReference: transaction.reference,
          status: 'PENDING' as const,
          amounts: transaction.breakdown,
        };
      }
      const message =
        err instanceof HttpError ? err.message : copy.networkError;
      return rejectWithValue(message);
    }
  },
  {
    condition: (_, { getState }) => {
      const { checkout } = getState() as { checkout: CheckoutState };
      return !checkout.ui.submitting;
    },
  },
);

export const pollTransaction = createAsyncThunk(
  'checkout/poll',
  async (reference: string, { rejectWithValue }) => {
    try {
      return await api.getTransaction(reference);
    } catch (err) {
      const message =
        err instanceof HttpError ? err.message : copy.networkError;
      return rejectWithValue(message);
    }
  },
);

const checkoutSlice = createSlice({
  name: 'checkout',
  initialState: initialCheckoutState,
  reducers: {
    selectHours(state, action: PayloadAction<number>) {
      state.hours = action.payload;
    },
    setProductId(state, action: PayloadAction<string>) {
      state.productId = action.payload;
    },
    openDetails(state) {
      state.step = 'details';
      state.ui.error = null;
    },
    closeSheet(state) {
      state.step = 'product';
      state.ui.error = null;
      state.ui.tokenizing = false;
    },
    setAcceptance(
      state,
      action: PayloadAction<Partial<CheckoutState['acceptance']>>,
    ) {
      state.acceptance = { ...state.acceptance, ...action.payload };
    },
    clearCheckoutError(state) {
      state.ui.error = null;
    },
    retryWithNewCard(state) {
      state.card = null;
      state.transaction = null;
      state.pspSession = null;
      state.acceptance = { termsAccepted: false, dataAccepted: false };
      state.step = 'details';
      state.ui.error = null;
      state.ui.submitting = false;
      // delivery + customer preserved
    },
    backToStore() {
      return { ...initialCheckoutState };
    },
    hydrateCheckout(_state, action: PayloadAction<CheckoutState>) {
      return action.payload;
    },
    clearCardToken(state) {
      if (state.card) {
        state.card = {
          brand: state.card.brand,
          last4: state.card.last4,
          token: '',
        };
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(tokenizeAndContinue.pending, (state) => {
        state.ui.tokenizing = true;
        state.ui.error = null;
      })
      .addCase(tokenizeAndContinue.fulfilled, (state, action) => {
        state.ui.tokenizing = false;
        state.card = action.payload.card;
        state.customer = action.payload.customer;
        state.delivery = action.payload.delivery;
        state.step = 'summary';
      })
      .addCase(tokenizeAndContinue.rejected, (state, action) => {
        state.ui.tokenizing = false;
        state.ui.error = (action.payload as string) ?? copy.tokenizationError;
      })
      .addCase(createCheckoutTransaction.pending, (state) => {
        state.ui.submitting = true;
        state.ui.error = null;
      })
      .addCase(createCheckoutTransaction.fulfilled, (state, action) => {
        state.ui.submitting = false;
        const res = action.payload as StartCheckoutResponse;
        state.transaction = {
          id: res.transactionReference,
          reference: res.transactionReference,
          status: res.status,
          breakdown: res.amounts,
        };
        state.pspSession = {
          publicKey: res.psp.publicKey,
          acceptanceToken: res.psp.acceptanceToken,
          acceptPersonalAuthToken: res.psp.acceptPersonalAuthToken,
          policyLinks: res.psp.policyLinks,
        };
      })
      .addCase(createCheckoutTransaction.rejected, (state, action) => {
        state.ui.submitting = false;
        const payload = action.payload as
          | { message?: string; status?: number; body?: { available?: number; code?: string } }
          | undefined;
        state.ui.error = payload?.message ?? copy.networkError;
      })
      .addCase(payCheckout.pending, (state) => {
        state.ui.submitting = true;
        state.ui.error = null;
      })
      .addCase(payCheckout.fulfilled, (state, action) => {
        state.ui.submitting = false;
        if (state.transaction) {
          state.transaction = {
            ...state.transaction,
            status: action.payload.status,
            statusMessage: action.payload.statusMessage,
            breakdown: action.payload.amounts,
          };
        }
        state.step = 'result';
        // Clear token on terminal status
        if (action.payload.status !== 'PENDING' && state.card) {
          state.card = {
            brand: state.card.brand,
            last4: state.card.last4,
            token: '',
          };
          state.pspSession = null;
        }
      })
      .addCase(payCheckout.rejected, (state, action) => {
        state.ui.submitting = false;
        state.ui.error = (action.payload as string) ?? copy.networkError;
      })
      .addCase(pollTransaction.pending, (state) => {
        state.ui.polling = true;
      })
      .addCase(pollTransaction.fulfilled, (state, action) => {
        state.ui.polling = false;
        state.transaction = {
          id: action.payload.reference,
          reference: action.payload.reference,
          status: action.payload.status,
          statusMessage: action.payload.statusMessage,
          breakdown: action.payload.amounts,
        };
        if (action.payload.status !== 'PENDING' && state.card) {
          state.card = {
            brand: state.card.brand,
            last4: state.card.last4,
            token: '',
          };
          state.pspSession = null;
        }
      })
      .addCase(pollTransaction.rejected, (state, action) => {
        state.ui.polling = false;
        state.ui.error = (action.payload as string) ?? copy.networkError;
      });
  },
});

export const {
  selectHours,
  setProductId,
  openDetails,
  closeSheet,
  setAcceptance,
  clearCheckoutError,
  retryWithNewCard,
  backToStore,
  hydrateCheckout,
  clearCardToken,
} = checkoutSlice.actions;

export default checkoutSlice.reducer;
