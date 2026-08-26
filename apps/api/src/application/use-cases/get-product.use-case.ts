import { Inject, Injectable } from '@nestjs/common';
import type { ProductDto, StockDto } from '@norte/contracts';
import {
  available,
  PRODUCT_REPOSITORY,
  type ProductRepository,
} from '../../domain';
import { andThenAsync, map, ok, type Result } from '../../shared/result';
import type { DomainError } from '../../domain/errors';

@Injectable()
export class GetProductUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
  ) {}

  async execute(productId: string): Promise<Result<ProductDto, DomainError>> {
    await this.products.sweepExpiredReservations(productId);
    const result = await this.products.findById(productId);
    return map(result, (p) => ({
      productId: p.productId,
      name: p.name,
      description: p.description,
      unit: p.unit,
      unitPriceCents: p.unitPriceCents,
      currency: p.currency,
      usdUnitPrice: p.usdUnitPrice,
      available: available(p),
      image: p.image,
    }));
  }
}

@Injectable()
export class GetStockUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
  ) {}

  async execute(productId: string): Promise<Result<StockDto, DomainError>> {
    await this.products.sweepExpiredReservations(productId);
    return andThenAsync(await this.products.findById(productId), async (p) =>
      ok({
        productId: p.productId,
        available: available(p),
        unit: p.unit,
      }),
    );
  }
}
