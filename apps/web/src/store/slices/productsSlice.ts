import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { ProductDto } from '@norte/contracts';
import * as api from '@/services/api';
import { HttpError } from '@/services/httpClient';

export interface ProductsState {
  items: ProductDto[];
  selected: ProductDto | null;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: ProductsState = {
  items: [],
  selected: null,
  status: 'idle',
  error: null,
};

export const fetchProducts = createAsyncThunk(
  'products/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      return await api.listProducts();
    } catch (err) {
      const message =
        err instanceof HttpError ? err.message : 'Failed to load products';
      return rejectWithValue(message);
    }
  },
);

export const fetchProduct = createAsyncThunk(
  'products/fetchOne',
  async (productId: string, { rejectWithValue }) => {
    try {
      return await api.getProduct(productId);
    } catch (err) {
      const message =
        err instanceof HttpError ? err.message : 'Failed to load product';
      return rejectWithValue(message);
    }
  },
);

export const refreshStock = createAsyncThunk(
  'products/refreshStock',
  async (productId: string, { rejectWithValue }) => {
    try {
      return await api.getStock(productId);
    } catch (err) {
      const message =
        err instanceof HttpError ? err.message : 'Failed to refresh stock';
      return rejectWithValue(message);
    }
  },
);

const productsSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {
    clearProductsError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
        state.selected = action.payload[0] ?? null;
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.status = 'failed';
        state.error = (action.payload as string) ?? 'Failed to load products';
      })
      .addCase(fetchProduct.fulfilled, (state, action) => {
        state.selected = action.payload;
        const idx = state.items.findIndex(
          (p) => p.productId === action.payload.productId,
        );
        if (idx >= 0) state.items[idx] = action.payload;
        else state.items.push(action.payload);
      })
      .addCase(refreshStock.fulfilled, (state, action) => {
        const { productId, available } = action.payload;
        if (state.selected?.productId === productId) {
          state.selected = { ...state.selected, available };
        }
        const item = state.items.find((p) => p.productId === productId);
        if (item) item.available = available;
      });
  },
});

export const { clearProductsError } = productsSlice.actions;
export default productsSlice.reducer;
