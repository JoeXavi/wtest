import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ListProductsUseCase } from '../../application/use-cases/list-products.use-case';
import { GetProductUseCase, GetStockUseCase } from '../../application/use-cases/get-product.use-case';
import { matchResult } from './result.mapper';

@ApiTags('products')
@Controller('api')
export class ProductsController {
  constructor(
    private readonly listProducts: ListProductsUseCase,
    private readonly getProduct: GetProductUseCase,
    private readonly getStock: GetStockUseCase,
  ) {}

  @Get('products')
  async list(@Res() res: Response): Promise<void> {
    matchResult(await this.listProducts.execute(), res);
  }

  @Get('products/:productId')
  async one(@Param('productId') productId: string, @Res() res: Response): Promise<void> {
    matchResult(await this.getProduct.execute(productId), res);
  }

  @Get('stock/:productId')
  async stock(@Param('productId') productId: string, @Res() res: Response): Promise<void> {
    matchResult(await this.getStock.execute(productId), res);
  }
}
