import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ApiTokenGuard } from './api-token.guard';
import { IS_PUBLIC_KEY } from './public.decorator';

const EXPECTED_TOKEN = 'local-dev-api-token';

function createGuard(isPublic: boolean | undefined): {
  guard: ApiTokenGuard;
  setAuthorization: (value: string | undefined) => void;
  context: ExecutionContext;
} {
  const request: { headers: { authorization?: string } } = {
    headers: {},
  };

  const reflector = {
    getAllAndOverride: (key: unknown) =>
      key === IS_PUBLIC_KEY ? isPublic : undefined,
  } as unknown as Reflector;

  const config = {
    getOrThrow: (key: string) => {
      if (key === 'API_TOKEN') return EXPECTED_TOKEN;
      throw new Error(`unexpected key ${key}`);
    },
  } as unknown as ConfigService;

  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;

  return {
    guard: new ApiTokenGuard(reflector, config),
    setAuthorization: (value) => {
      request.headers.authorization = value;
    },
    context,
  };
}

describe('ApiTokenGuard', () => {
  it('allows @Public() routes without a token', () => {
    const { guard, context } = createGuard(true);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects missing Authorization header', () => {
    const { guard, context } = createGuard(undefined);
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    try {
      guard.canActivate(context);
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect((err as UnauthorizedException).getResponse()).toMatchObject({
        code: 'UNAUTHORIZED',
        message: 'Invalid or missing API token',
      });
    }
  });

  it('rejects wrong token', () => {
    const { guard, setAuthorization, context } = createGuard(undefined);
    setAuthorization('Bearer wrong-token-value');
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects non-Bearer schemes', () => {
    const { guard, setAuthorization, context } = createGuard(undefined);
    setAuthorization(`Basic ${EXPECTED_TOKEN}`);
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('accepts matching Bearer token', () => {
    const { guard, setAuthorization, context } = createGuard(undefined);
    setAuthorization(`Bearer ${EXPECTED_TOKEN}`);
    expect(guard.canActivate(context)).toBe(true);
  });
});
