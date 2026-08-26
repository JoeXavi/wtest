import { http, HttpResponse } from 'msw';
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
  http.get(`${API}/products`, () => {
    return HttpResponse.json([{ ...PRODUCT, available }]);
  }),

  http.get(`${API}/products/:id`, () => {
    return HttpResponse.json({ ...PRODUCT, available });
  }),

  http.get(`${API}/stock/:id`, () => {
    return HttpResponse.json({
      productId: PRODUCT.productId,
      available,
      unit: 'HOUR',
    });
  }),

  http.post(`${API}/checkout/transactions`, async ({ request }) => {
    const body = (await request.json()) as StartCheckoutRequest;
    if (body.hours > available) {
      return HttpResponse.json(
        { code: 'INSUFFICIENT_STOCK', available, message: 'Out of stock' },
        { status: 409 },
      );
    }
    const itemCents = body.hours * 5_000_000;
    const baseFeeCents = 150_000;
    const deliveryFeeCents = 800_000;
    return HttpResponse.json(
      {
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
      },
      { status: 201 },
    );
  }),

  http.post(
    `${API}/checkout/transactions/:ref/pay`,
    async ({ request }) => {
      payCalls += 1;
      const body = (await request.json()) as PayTransactionRequest;
      // Simulate decline for specific last4
      if (body.cardLast4 === '1111') {
        currentStatus = 'DECLINED';
        return HttpResponse.json({
          transactionReference: 'NOR-TESTREF001',
          status: 'DECLINED',
          statusMessage: 'Insufficient funds',
          amounts: {
            itemCents: 15_000_000,
            baseFeeCents: 150_000,
            deliveryFeeCents: 800_000,
            totalCents: 15_950_000,
          },
        });
      }
      currentStatus = 'PENDING';
      // After pay, next poll will approve (tests can also set status)
      return HttpResponse.json({
        transactionReference: 'NOR-TESTREF001',
        status: 'PENDING',
        amounts: {
          itemCents: 15_000_000,
          baseFeeCents: 150_000,
          deliveryFeeCents: 800_000,
          totalCents: 15_950_000,
        },
      });
    },
  ),

  http.get(`${API}/transactions/:ref`, () => {
    let status = currentStatus;
    if (status === 'PENDING') {
      // Auto-approve on second poll for happy path convenience
      currentStatus = 'APPROVED';
      status = 'APPROVED';
      available = Math.max(0, available - 3);
    }
    return HttpResponse.json({
      reference: 'NOR-TESTREF001',
      status,
      statusMessage: status === 'DECLINED' ? 'Insufficient funds' : undefined,
      amounts: {
        itemCents: 15_000_000,
        baseFeeCents: 150_000,
        deliveryFeeCents: 800_000,
        totalCents: 15_950_000,
      },
      card: { brand: 'visa', last4: '4242' },
      product: { name: PRODUCT.name, hours: 3 },
      finalizedAt:
        status === 'APPROVED' ||
        status === 'DECLINED' ||
        status === 'ERROR' ||
        status === 'VOIDED'
          ? new Date().toISOString()
          : undefined,
    } satisfies TransactionDto);
  }),

  http.post(`${PSP}/tokens/cards`, async ({ request }) => {
    const body = (await request.json()) as { number?: string };
    const number = (body.number ?? '').replace(/\D/g, '');
    if (number.startsWith('4111111111111111')) {
      return HttpResponse.json({
        status: 'CREATED',
        data: {
          id: 'tok_declined_test',
          brand: 'VISA',
          last_four: '1111',
        },
      });
    }
    return HttpResponse.json({
      status: 'CREATED',
      data: {
        id: 'tok_approved_test',
        brand: 'VISA',
        last_four: number.slice(-4) || '4242',
      },
    });
  }),
];
