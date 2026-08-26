import type {
  PayTransactionRequest,
  PayTransactionResponse,
  ProductDto,
  StartCheckoutRequest,
  StartCheckoutResponse,
  StockDto,
  TransactionDto,
} from '@norte/contracts';
import { httpClient } from './httpClient';

export function listProducts(): Promise<ProductDto[]> {
  return httpClient<ProductDto[]>('/products');
}

export function getProduct(productId: string): Promise<ProductDto> {
  return httpClient<ProductDto>(`/products/${encodeURIComponent(productId)}`);
}

export function getStock(productId: string): Promise<StockDto> {
  return httpClient<StockDto>(`/stock/${encodeURIComponent(productId)}`);
}

export function startCheckout(
  body: StartCheckoutRequest,
): Promise<StartCheckoutResponse> {
  return httpClient<StartCheckoutResponse>('/checkout/transactions', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function payTransaction(
  reference: string,
  body: PayTransactionRequest,
  idempotencyKey?: string,
): Promise<PayTransactionResponse> {
  const headers: HeadersInit = {};
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }
  return httpClient<PayTransactionResponse>(
    `/checkout/transactions/${encodeURIComponent(reference)}/pay`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    },
  );
}

export function getTransaction(reference: string): Promise<TransactionDto> {
  return httpClient<TransactionDto>(
    `/transactions/${encodeURIComponent(reference)}`,
  );
}
