import { Inject, Injectable } from '@nestjs/common';
import type { ProductDto } from '@norte/contracts';
import { available, PRODUCT_REPOSITORY, type ProductRepository } from '../../domain';
import { ok, type Result } from '../../shared/result';
import type { DomainError } from '../../domain/errors';

@Injectable()
export class ListProductsUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
  ) {}

  async execute(): Promise<Result<ProductDto[], DomainError>> {
    const result = await this.products.list();
    if (!result.ok) return result;
    return ok(
      result.value.map((p) => ({
        productId: p.productId,
        name: p.name,
        description: p.description,
        unit: p.unit,
        unitPriceCents: p.unitPriceCents,
        currency: p.currency,
        usdUnitPrice: p.usdUnitPrice,
        available: available(p),
        image: p.image,
      })),
    );
  }
}
