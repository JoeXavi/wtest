import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProductPage } from '@/pages/ProductPage';
import { CheckoutPage } from '@/pages/CheckoutPage';
import { SummaryPage } from '@/pages/SummaryPage';
import { ResultPage } from '@/pages/ResultPage';
import { createAppStore } from '@/store';
import { initialCheckoutState } from '@/store/slices/checkoutSlice';
import { server } from '@/test/msw/server';
import { getPayCallCount, resetMswState } from '@/test/msw/handlers';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  resetMswState();
  localStorage.clear();
});
afterAll(() => server.close());

function renderFlow(path = '/') {
  const store = createAppStore({
    checkout: {
      ...initialCheckoutState,
      hours: 3,
      productId: 'prod_joexavi',
    },
  });

  return {
    store,
    user: userEvent.setup(),
    ...render(
      <Provider store={store}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/" element={<ProductPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/checkout/summary" element={<SummaryPage />} />
            <Route path="/checkout/result" element={<ResultPage />} />
          </Routes>
        </MemoryRouter>
      </Provider>,
    ),
  };
}

async function fillCheckoutForm(
  user: ReturnType<typeof userEvent.setup>,
  pan: string,
) {
  const dialog = await screen.findByRole('dialog');
  const q = within(dialog);

  await user.type(q.getByLabelText(/card number/i), pan);
  await user.type(q.getByLabelText(/expiry/i), '0827');
  await user.type(q.getByLabelText(/^cvc$/i), '123');
  await user.type(q.getByLabelText(/name on card/i), 'Ada Lovelace');
  await user.type(q.getByLabelText(/^email$/i), 'ada@example.com');
  await user.type(q.getByLabelText(/full name/i), 'Ada Lovelace');
  await user.type(q.getByLabelText(/^phone$/i), '+573001112233');
  await user.type(q.getByLabelText(/id number/i), '1234567890');
  await user.type(q.getByLabelText(/address line 1/i), 'Calle 100 #10-20');
  await user.type(q.getByLabelText(/^city$/i), 'Bogota');
  await user.type(q.getByLabelText(/^region$/i), 'Cundinamarca');
}

describe('checkout flows', () => {
  it('happy path: approved transaction decrements displayed hours', async () => {
    resetMswState({ available: 48 });
    const { user, store } = renderFlow('/');

    expect(
      await screen.findByRole('heading', { name: /JoeXavi Dev Hours/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/48 hours available/i)).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: /pay with credit card/i }),
    );
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await fillCheckoutForm(user, '4242424242424242');
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: /continue to summary/i,
      }),
    );

    expect(await screen.findByTestId('summary-total')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('summary-total')).getByText(/159\.500/),
    ).toBeInTheDocument();

    await user.click(screen.getByLabelText(/end-user policy/i));
    await user.click(screen.getByLabelText(/personal data/i));
    await user.click(screen.getByRole('button', { name: /pay /i }));

    expect(await screen.findByTestId('result-status')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/payment approved/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /back to store/i }));

    await waitFor(() => {
      expect(store.getState().products.selected?.available).toBe(45);
    });
  }, 30_000);

  it('declined path preserves delivery and clears card', async () => {
    resetMswState();
    const { user, store } = renderFlow('/');

    await screen.findByRole('button', { name: /pay with credit card/i });
    await user.click(
      screen.getByRole('button', { name: /pay with credit card/i }),
    );

    await fillCheckoutForm(user, '4111111111111111');
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: /continue to summary/i,
      }),
    );
    await screen.findByTestId('summary-total');

    await user.click(screen.getByLabelText(/end-user policy/i));
    await user.click(screen.getByLabelText(/personal data/i));
    await user.click(screen.getByRole('button', { name: /pay /i }));

    await waitFor(() => {
      expect(screen.getByText(/payment declined/i)).toBeInTheDocument();
    });

    expect(store.getState().checkout.delivery?.city).toBe('Bogota');
    await user.click(screen.getByRole('button', { name: /try another card/i }));

    expect(store.getState().checkout.card).toBeNull();
    expect(store.getState().checkout.delivery?.addressLine1).toBe(
      'Calle 100 #10-20',
    );
    expect(store.getState().checkout.step).toBe('details');
  }, 30_000);

  it('double-tap on pay dispatches exactly one request', async () => {
    resetMswState();
    const { user } = renderFlow('/');

    await screen.findByRole('button', { name: /pay with credit card/i });
    await user.click(
      screen.getByRole('button', { name: /pay with credit card/i }),
    );

    await fillCheckoutForm(user, '4242424242424242');
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: /continue to summary/i,
      }),
    );
    await screen.findByTestId('summary-total');
    await user.click(screen.getByLabelText(/end-user policy/i));
    await user.click(screen.getByLabelText(/personal data/i));

    const payBtn = screen.getByRole('button', { name: /pay /i });
    await user.click(payBtn);
    await user.click(payBtn);

    await waitFor(() => {
      expect(getPayCallCount()).toBe(1);
    });
  }, 30_000);
});
