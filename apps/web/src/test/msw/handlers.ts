import { rest } from 'msw';
import type {
  PayTransactionRequest,
  ProductDto,
  StartCheckoutRequest,
  TransactionDto,
} from '@norte/contracts';

export const PRODUCT: ProductDto = {
  productId: 'prod_joexavi',
  name: 'JoeXavi Dev Hours',
  description:
    'Senior full-stack pairing time. Ship features, untangle architecture, and leave with clearer next steps.',
  unit: 'HOUR',
  unitPriceCents: 5_000_000,
  currency: 'COP',
  usdUnitPrice: 20,
  available: 48,
  image: {
    key: 'hero.svg',
    width: 1120,
    height: 840,
    alt: 'Desk with laptop and code',
  },
};

let available = 48;
let currentStatus: TransactionDto['status'] = 'PENDING';
let payCalls = 0;

export function resetMswState(opts?: {
  available?: number;
  status?: TransactionDto['status'];
}) {
  available = opts?.available ?? 48;
  currentStatus = opts?.status ?? 'PENDING';
  payCalls = 0;
}

export function getPayCallCount() {
  return payCalls;
}

export function setTransactionStatus(status: TransactionDto['status']) {
  currentStatus = status;
}

const API = 'http://localhost/api';
const PSP = 'http://localhost/psp/v1';

export const handlers = [
  rest.get(`${API}/products`, (_req, res, ctx) => {
    return res(ctx.json([{ ...PRODUCT, available }]));
  }),

  rest.get(`${API}/products/:id`, (_req, res, ctx) => {
    return res(ctx.json({ ...PRODUCT, available }));
  }),

  rest.get(`${API}/stock/:id`, (_req, res, ctx) => {
    return res(
      ctx.json({
        productId: PRODUCT.productId,
        available,
        unit: 'HOUR',
      }),
    );
  }),

  rest.post(`${API}/checkout/transactions`, async (req, res, ctx) => {
    const body = (await req.json()) as StartCheckoutRequest;
    if (body.hours > available) {
      return res(
        ctx.status(409),
        ctx.json({
          code: 'INSUFFICIENT_STOCK',
          available,
          message: 'Out of stock',
        }),
      );
    }
    const itemCents = body.hours * 5_000_000;
    const baseFeeCents = 150_000;
    const deliveryFeeCents = 800_000;
    return res(
      ctx.status(201),
      ctx.json({
        transactionReference: 'NOR-TESTREF001',
        status: 'PENDING',
        amounts: {
          itemCents,
          baseFeeCents,
          deliveryFeeCents,
          totalCents: itemCents + baseFeeCents + deliveryFeeCents,
        },
        currency: 'COP',
        psp: {
          publicKey: 'pub_test_key',
          acceptanceToken: 'accept_terms_jwt',
          acceptPersonalAuthToken: 'accept_data_jwt',
          policyLinks: {
            endUserPolicy: 'https://example.com/policy',
            personalDataAuth: 'https://example.com/data',
          },
        },
      }),
    );
  }),

  rest.post(`${API}/checkout/transactions/:ref/pay`, async (req, res, ctx) => {
    payCalls += 1;
    const body = (await req.json()) as PayTransactionRequest;
    if (body.cardLast4 === '1111') {
      currentStatus = 'DECLINED';
      return res(
        ctx.json({
          transactionReference: 'NOR-TESTREF001',
          status: 'DECLINED',
          statusMessage: 'Insufficient funds',
          amounts: {
            itemCents: 15_000_000,
            baseFeeCents: 150_000,
            deliveryFeeCents: 800_000,
            totalCents: 15_950_000,
          },
        }),
      );
    }
    currentStatus = 'PENDING';
    return res(
      ctx.json({
        transactionReference: 'NOR-TESTREF001',
        status: 'PENDING',
        amounts: {
          itemCents: 15_000_000,
          baseFeeCents: 150_000,
          deliveryFeeCents: 800_000,
          totalCents: 15_950_000,
        },
      }),
    );
  }),

  rest.post(`${API}/checkout/transactions/:ref/cancel`, (_req, res, ctx) => {
    currentStatus = 'VOIDED';
    return res(
      ctx.json({
        transactionReference: 'NOR-TESTREF001',
        status: 'VOIDED',
        amounts: {
          itemCents: 15_000_000,
          baseFeeCents: 150_000,
          deliveryFeeCents: 800_000,
          totalCents: 15_950_000,
        },
      }),
    );
  }),

  rest.get(`${API}/transactions/:ref`, (_req, res, ctx) => {
    if (currentStatus === 'PENDING') {
      currentStatus = 'APPROVED';
      available = Math.max(0, available - 3);
    }
    return res(
      ctx.json({
        reference: 'NOR-TESTREF001',
        status: currentStatus,
        statusMessage:
          currentStatus === 'DECLINED' ? 'Insufficient funds' : undefined,
        amounts: {
          itemCents: 15_000_000,
          baseFeeCents: 150_000,
          deliveryFeeCents: 800_000,
          totalCents: 15_950_000,
        },
        card: { brand: 'visa', last4: '4242' },
        product: { name: PRODUCT.name, hours: 3 },
        finalizedAt: new Date().toISOString(),
      } satisfies TransactionDto),
    );
  }),

  rest.post(`${PSP}/tokens/cards`, async (req, res, ctx) => {
    const body = (await req.json()) as { number?: string };
    const number = (body.number ?? '').replace(/\D/g, '');
    if (number.startsWith('4111111111111111')) {
      return res(
        ctx.json({
          status: 'CREATED',
          data: {
            id: 'tok_declined_test',
            brand: 'VISA',
            last_four: '1111',
          },
        }),
      );
    }
    return res(
      ctx.json({
        status: 'CREATED',
        data: {
          id: 'tok_approved_test',
          brand: 'VISA',
          last_four: number.slice(-4) || '4242',
        },
      }),
    );
  }),
];
