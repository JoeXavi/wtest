import { createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { domainErrorToHttp, matchResult } from './result.mapper';
import { PspHttpAdapter } from '../psp/psp-http.adapter';

describe('domainErrorToHttp', () => {
  it('maps declines to 200', () => {
    const mapped = domainErrorToHttp({
      code: 'PAYMENT_DECLINED',
      reference: 'NOR-1',
      statusMessage: 'Insufficient funds',
    });
    expect(mapped.status).toBe(200);
  });

  it('maps insufficient stock to 409', () => {
    const mapped = domainErrorToHttp({
      code: 'INSUFFICIENT_STOCK',
      productId: 'p',
      available: 1,
      requested: 2,
    });
    expect(mapped.status).toBe(409);
  });

  it('maps invalid event signature to 401', () => {
    expect(domainErrorToHttp({ code: 'INVALID_EVENT_SIGNATURE' }).status).toBe(401);
  });

  it('maps remaining codes', () => {
    expect(domainErrorToHttp({ code: 'VALIDATION_ERROR', message: 'bad' }).status).toBe(400);
    expect(domainErrorToHttp({ code: 'PRODUCT_NOT_FOUND', productId: 'x' }).status).toBe(404);
    expect(domainErrorToHttp({ code: 'TRANSACTION_NOT_FOUND', reference: 'x' }).status).toBe(404);
    expect(domainErrorToHttp({ code: 'CUSTOMER_NOT_FOUND', customerId: 'x' }).status).toBe(404);
    expect(domainErrorToHttp({ code: 'DELIVERY_NOT_FOUND', reference: 'x' }).status).toBe(404);
    expect(domainErrorToHttp({ code: 'DUPLICATE_REFERENCE', reference: 'x' }).status).toBe(409);
    expect(
      domainErrorToHttp({
        code: 'INVALID_TRANSACTION_STATE',
        reference: 'x',
        current: 'APPROVED',
        attempted: 'pay',
      }).status,
    ).toBe(409);
    expect(
      domainErrorToHttp({
        code: 'DELIVERY_NOT_EDITABLE',
        reference: 'x',
        status: 'ASSIGNED',
      }).status,
    ).toBe(409);
    expect(domainErrorToHttp({ code: 'PSP_UNAVAILABLE', message: 'down' }).status).toBe(502);
  });
});

describe('matchResult', () => {
  it('writes success and error responses', () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    matchResult({ ok: true, value: { a: 1 } }, res as never, 201);
    expect(res.status).toHaveBeenCalledWith(201);
    matchResult(
      { ok: false, error: { code: 'PRODUCT_NOT_FOUND', productId: 'p' } },
      res as never,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('PspHttpAdapter.verifyEvent', () => {
  it('accepts matching checksum', () => {
    const config = {
      getOrThrow: (key: string) => {
        const map: Record<string, string> = {
          PSP_PUBLIC_KEY: 'pub',
          PSP_PRIVATE_KEY: 'prv',
          PSP_INTEGRITY_SECRET: 'int',
          PSP_EVENTS_SECRET: 'secret',
          PSP_BASE_URL: 'https://example.com/v1',
        };
        return map[key];
      },
    } as unknown as ConfigService;
    const adapter = new PspHttpAdapter(config);
    const checksum = createHash('sha256')
      .update('tx-1APPROVED10001234secret')
      .digest('hex')
      .toUpperCase();
    const payload = {
      eventType: 'transaction.updated',
      environment: 'test',
      data: {
        transaction: {
          id: 'tx-1',
          status: 'APPROVED' as const,
          reference: 'NOR-1',
          amountInCents: 1000,
        },
      },
      signature: {
        properties: ['transaction.id', 'transaction.status', 'transaction.amountInCents'],
        checksum,
      },
      timestamp: 1234,
    };
    const result = adapter.verifyEvent(payload);
    expect(result.ok).toBe(true);
  });

  it('rejects bad checksum', () => {
    const config = {
      getOrThrow: (key: string) => {
        const map: Record<string, string> = {
          PSP_PUBLIC_KEY: 'pub',
          PSP_PRIVATE_KEY: 'prv',
          PSP_INTEGRITY_SECRET: 'int',
          PSP_EVENTS_SECRET: 'secret',
          PSP_BASE_URL: 'https://example.com/v1',
        };
        return map[key];
      },
    } as unknown as ConfigService;
    const adapter = new PspHttpAdapter(config);
    const result = adapter.verifyEvent({
      eventType: 'transaction.updated',
      environment: 'test',
      data: {
        transaction: {
          id: 'tx-1',
          status: 'APPROVED',
          reference: 'NOR-1',
          amountInCents: 1000,
        },
      },
      signature: { properties: ['transaction.id'], checksum: 'deadbeef' },
      timestamp: 1,
    });
    expect(result.ok).toBe(false);
  });
});
