import { Body, Controller, Get, Param, Patch, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { StartCheckoutUseCase } from '../../application/use-cases/start-checkout.use-case';
import { PayTransactionUseCase } from '../../application/use-cases/pay-transaction.use-case';
import { CancelCheckoutUseCase } from '../../application/use-cases/cancel-checkout.use-case';
import { SyncTransactionStatusUseCase } from '../../application/use-cases/sync-transaction.use-case';
import {
  GetCustomerUseCase,
  GetDeliveryUseCase,
  UpdateDeliveryUseCase,
} from '../../application/use-cases/customer-delivery.use-case';
import { PayTransactionDto, StartCheckoutDto, UpdateDeliveryDto } from './dto';
import { matchResult } from './result.mapper';

@ApiTags('checkout')
@Controller('api')
export class CheckoutController {
  constructor(
    private readonly startCheckout: StartCheckoutUseCase,
    private readonly payTransaction: PayTransactionUseCase,
    private readonly cancelCheckout: CancelCheckoutUseCase,
    private readonly syncTransaction: SyncTransactionStatusUseCase,
  ) {}

  @Post('checkout/transactions')
  async start(@Body() body: StartCheckoutDto, @Res() res: Response): Promise<void> {
    matchResult(await this.startCheckout.execute(body), res, 201);
  }

  @Post('checkout/transactions/:reference/pay')
  async pay(
    @Param('reference') reference: string,
    @Body() body: PayTransactionDto,
    @Res() res: Response,
  ): Promise<void> {
    matchResult(await this.payTransaction.execute(reference, body), res);
  }

  @Post('checkout/transactions/:reference/cancel')
  async cancel(
    @Param('reference') reference: string,
    @Res() res: Response,
  ): Promise<void> {
    matchResult(await this.cancelCheckout.execute(reference), res);
  }

  @Get('transactions/:reference')
  async get(@Param('reference') reference: string, @Res() res: Response): Promise<void> {
    matchResult(await this.syncTransaction.execute(reference), res);
  }
}

@ApiTags('customers')
@Controller('api/customers')
export class CustomersController {
  constructor(private readonly getCustomer: GetCustomerUseCase) {}

  @Get(':customerId')
  async get(@Param('customerId') customerId: string, @Res() res: Response): Promise<void> {
    matchResult(await this.getCustomer.execute(customerId), res);
  }
}

@ApiTags('deliveries')
@Controller('api/deliveries')
export class DeliveriesController {
  constructor(
    private readonly getDelivery: GetDeliveryUseCase,
    private readonly updateDelivery: UpdateDeliveryUseCase,
  ) {}

  @Get(':reference')
  async get(@Param('reference') reference: string, @Res() res: Response): Promise<void> {
    matchResult(await this.getDelivery.execute(reference), res);
  }

  @Patch(':reference')
  async patch(
    @Param('reference') reference: string,
    @Body() body: UpdateDeliveryDto,
    @Res() res: Response,
  ): Promise<void> {
    matchResult(await this.updateDelivery.execute(reference, body), res);
  }
}
