import { err, ok, type Result } from '../shared/result';
import type { DomainError } from './errors';

export type ProductImage = {
  key: string;
  width: number;
  height: number;
  alt: string;
};

export type Product = {
  productId: string;
  name: string;
  description: string;
  unit: 'HOUR';
  unitPriceCents: number;
  currency: 'COP';
  usdUnitPrice: number;
  usdRateCop: number;
  stock: number;
  reserved: number;
  image: ProductImage;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export function available(product: Product): number {
  return Math.max(0, product.stock - product.reserved);
}

export function reserve(
  product: Product,
  quantity: number,
): Result<{ product: Product; quantity: number }, DomainError> {
  if (!product.active) {
    return err({ code: 'PRODUCT_NOT_FOUND', productId: product.productId });
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    return err({
      code: 'VALIDATION_ERROR',
      message: 'Hours must be a positive integer',
    });
  }
  const avail = available(product);
  if (avail < quantity) {
    return err({
      code: 'INSUFFICIENT_STOCK',
      productId: product.productId,
      available: avail,
      requested: quantity,
    });
  }
  return ok({
    product: {
      ...product,
      reserved: product.reserved + quantity,
      updatedAt: new Date().toISOString(),
    },
    quantity,
  });
}

export function commitSale(
  product: Product,
  quantity: number,
): Result<Product, DomainError> {
  if (product.reserved < quantity || product.stock < quantity) {
    return err({
      code: 'INSUFFICIENT_STOCK',
      productId: product.productId,
      available: available(product),
      requested: quantity,
    });
  }
  return ok({
    ...product,
    stock: product.stock - quantity,
    reserved: product.reserved - quantity,
    updatedAt: new Date().toISOString(),
  });
}

export function releaseReservation(
  product: Product,
  quantity: number,
): Result<Product, DomainError> {
  if (product.reserved < quantity) {
    return err({
      code: 'INSUFFICIENT_STOCK',
      productId: product.productId,
      available: available(product),
      requested: quantity,
    });
  }
  return ok({
    ...product,
    reserved: product.reserved - quantity,
    updatedAt: new Date().toISOString(),
  });
}
