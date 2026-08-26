import { configureStore } from '@reduxjs/toolkit';
import productsReducer, {
  fetchProducts,
  fetchProduct,
  refreshStock,
  clearProductsError,
} from './productsSlice';
import { server } from '@/test/msw/server';
import { rest } from 'msw';
import { resetMswState } from '@/test/msw/handlers';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  resetMswState();
});
afterAll(() => server.close());

function makeStore() {
  return configureStore({ reducer: { products: productsReducer } });
}

describe('productsSlice', () => {
  it('loads catalogue', async () => {
    const store = makeStore();
    await store.dispatch(fetchProducts());
    expect(store.getState().products.status).toBe('succeeded');
    expect(store.getState().products.selected?.name).toMatch(/JoeXavi/);
  });

  it('handles list failure', async () => {
    server.use(
      rest.get('http://localhost/api/products', (_req, res, ctx) =>
        res(ctx.status(500), ctx.json({ message: 'boom' })),
      ),
    );
    const store = makeStore();
    await store.dispatch(fetchProducts());
    expect(store.getState().products.status).toBe('failed');
    expect(store.getState().products.error).toBeTruthy();
    store.dispatch(clearProductsError());
    expect(store.getState().products.error).toBeNull();
  });

  it('fetches one product and refreshes stock', async () => {
    const store = makeStore();
    await store.dispatch(fetchProduct('prod_joexavi'));
    expect(store.getState().products.selected?.productId).toBe('prod_joexavi');
    resetMswState({ available: 40 });
    await store.dispatch(refreshStock('prod_joexavi'));
    expect(store.getState().products.selected?.available).toBe(40);
  });
});
