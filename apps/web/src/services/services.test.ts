import { httpClient, HttpError } from './httpClient';
import { tokenizeCardFromForm, PspTokenizationError } from './pspTokenization';
import { server } from '@/test/msw/server';
import { rest } from 'msw';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('httpClient', () => {
  it('returns parsed JSON on success', async () => {
    server.use(
      rest.get('http://localhost/api/ping', (_req, res, ctx) =>
        res(ctx.json({ ok: true })),
      ),
    );
    await expect(httpClient<{ ok: boolean }>('/ping')).resolves.toEqual({
      ok: true,
    });
  });

  it('sends Authorization Bearer from config', async () => {
    let auth: string | null = null;
    server.use(
      rest.get('http://localhost/api/ping', (req, res, ctx) => {
        auth = req.headers.get('Authorization');
        return res(ctx.json({ ok: true }));
      }),
    );
    await httpClient('/ping');
    expect(auth).toBe('Bearer local-dev-api-token');
  });

  it('does not override an existing Authorization header', async () => {
    let auth: string | null = null;
    server.use(
      rest.get('http://localhost/api/ping', (req, res, ctx) => {
        auth = req.headers.get('Authorization');
        return res(ctx.json({ ok: true }));
      }),
    );
    await httpClient('/ping', {
      headers: { Authorization: 'Bearer custom-token' },
    });
    expect(auth).toBe('Bearer custom-token');
  });

  it('throws HttpError with message from body', async () => {
    server.use(
      rest.get('http://localhost/api/fail', (_req, res, ctx) =>
        res(ctx.status(400), ctx.json({ message: 'bad request' })),
      ),
    );
    await expect(httpClient('/fail')).rejects.toMatchObject({
      name: 'HttpError',
      status: 400,
      message: 'bad request',
    });
  });

  it('throws HttpError with status fallback message', async () => {
    server.use(
      rest.get('http://localhost/api/fail2', (_req, res, ctx) =>
        res(ctx.status(502), ctx.json({})),
      ),
    );
    await expect(httpClient('/fail2')).rejects.toBeInstanceOf(HttpError);
  });
});

describe('pspTokenization', () => {
  it('tokenizes a valid card', async () => {
    const result = await tokenizeCardFromForm({
      number: '4242424242424242',
      cvc: '123',
      expiry: '08/27',
      cardHolder: 'Ada',
    });
    expect(result.token).toBeTruthy();
    expect(result.last4).toBe('4242');
    expect(result.brand).toBe('visa');
  });

  it('rejects invalid expiry', async () => {
    await expect(
      tokenizeCardFromForm({
        number: '4242424242424242',
        cvc: '123',
        expiry: 'bad',
        cardHolder: 'Ada',
      }),
    ).rejects.toBeInstanceOf(PspTokenizationError);
  });

  it('rejects PSP error responses', async () => {
    server.use(
      rest.post('http://localhost/psp/v1/tokens/cards', (_req, res, ctx) =>
        res(ctx.status(422), ctx.json({ error: { message: 'Invalid' } })),
      ),
    );
    await expect(
      tokenizeCardFromForm({
        number: '4242424242424242',
        cvc: '123',
        expiry: '08/27',
        cardHolder: 'Ada',
      }),
    ).rejects.toBeInstanceOf(PspTokenizationError);
  });
});

describe('psp brand mapping', () => {
  it('maps mastercard and unknown brands', async () => {
    server.use(
      rest.post('http://localhost/psp/v1/tokens/cards', (_req, res, ctx) =>
        res(
          ctx.json({
            status: 'CREATED',
            data: { id: 'tok_mc', brand: 'master', last_four: '4444' },
          }),
        ),
      ),
    );
    await expect(
      tokenizeCardFromForm({
        number: '5555555555554444',
        cvc: '123',
        expiry: '08/27',
        cardHolder: 'Ada',
      }),
    ).resolves.toMatchObject({ brand: 'mastercard' });

    server.use(
      rest.post('http://localhost/psp/v1/tokens/cards', (_req, res, ctx) =>
        res(
          ctx.json({
            status: 'CREATED',
            data: { id: 'tok_x', brand: 'AMEX', last_four: '0005' },
          }),
        ),
      ),
    );
    await expect(
      tokenizeCardFromForm({
        number: '378282246310005',
        cvc: '1234',
        expiry: '08/27',
        cardHolder: 'Ada',
      }),
    ).resolves.toMatchObject({ brand: 'unknown' });
  });
});
