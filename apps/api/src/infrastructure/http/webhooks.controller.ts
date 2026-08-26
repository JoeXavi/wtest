import { Body, Controller, Get, Headers, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { HandlePaymentEventUseCase } from '../../application/use-cases/sync-transaction.use-case';
import { matchResult } from './result.mapper';

@ApiTags('webhooks')
@Controller('api/webhooks')
export class WebhooksController {
  constructor(private readonly handleEvent: HandlePaymentEventUseCase) {}

  @Post('psp')
  async psp(
    @Body() body: unknown,
    @Headers('x-event-checksum') checksum: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    matchResult(await this.handleEvent.execute(body, checksum), res);
  }
}

@ApiTags('health')
@Controller()
export class HealthController {
  @Get('health')
  health() {
    return { status: 'ok', version: process.env.npm_package_version ?? '0.0.1' };
  }
}
