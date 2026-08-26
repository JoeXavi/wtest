import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import type { DomainError } from '../../domain/errors';
import type { Result } from '../../shared/result';

export function domainErrorToHttp(error: DomainError): { status: number; body: Record<string, unknown> } {
  switch (error.code) {
    case 'VALIDATION_ERROR':
      return {
        status: HttpStatus.BAD_REQUEST,
        body: { code: error.code, message: error.message, details: error.details },
      };
    case 'PRODUCT_NOT_FOUND':
    case 'TRANSACTION_NOT_FOUND':
    case 'CUSTOMER_NOT_FOUND':
    case 'DELIVERY_NOT_FOUND':
      return {
        status: HttpStatus.NOT_FOUND,
        body: { code: error.code, message: 'Resource not found' },
      };
    case 'INSUFFICIENT_STOCK':
      return {
        status: HttpStatus.CONFLICT,
        body: {
          code: error.code,
          message: 'Insufficient stock',
          available: error.available,
          requested: error.requested,
        },
      };
    case 'DUPLICATE_REFERENCE':
    case 'INVALID_TRANSACTION_STATE':
    case 'DELIVERY_NOT_EDITABLE':
      return {
        status: HttpStatus.CONFLICT,
        body: { code: error.code, message: 'Conflict' },
      };
    case 'PAYMENT_DECLINED':
      return {
        status: HttpStatus.OK,
        body: {
          code: error.code,
          status: 'DECLINED',
          statusMessage: error.statusMessage,
          transactionReference: error.reference,
        },
      };
    case 'PSP_UNAVAILABLE':
      return {
        status: HttpStatus.BAD_GATEWAY,
        body: { code: error.code, message: error.message },
      };
    case 'INVALID_EVENT_SIGNATURE':
      return {
        status: HttpStatus.UNAUTHORIZED,
        body: { code: error.code, message: 'Invalid event signature' },
      };
    default:
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        body: { code: 'INTERNAL_ERROR', message: 'Unexpected error' },
      };
  }
}

export function matchResult<T>(
  result: Result<T, DomainError>,
  res: Response,
  successStatus: number = HttpStatus.OK,
): void {
  if (result.ok) {
    res.status(successStatus).json(result.value);
    return;
  }
  const mapped = domainErrorToHttp(result.error);
  res.status(mapped.status).json(mapped.body);
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ headers?: Record<string, string> }>();
    const correlationId =
      request.headers?.['x-request-id'] ?? request.headers?.['x-correlation-id'] ?? 'unknown';

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      response.status(status).json(
        typeof body === 'string'
          ? { message: body, correlationId }
          : { ...(body as object), correlationId },
      );
      return;
    }

    this.logger.error(`Unhandled error [${correlationId}]: ${String(exception)}`);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: 'INTERNAL_ERROR',
      message: 'Unexpected error',
      correlationId,
    });
  }
}
