import type { CardBrand } from '@norte/contracts';
import { digitsOnly, parseExpiry } from '@/validators/card';
import { config } from '@/config';

export interface TokenizeCardInput {
  number: string;
  cvc: string;
  expMonth: string;
  expYear: string;
  cardHolder: string;
}

export interface TokenizeCardResult {
  token: string;
  brand: CardBrand;
  last4: string;
}

export class PspTokenizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PspTokenizationError';
  }
}

function tokenizationUrl(): string {
  return `${config.pspTokenizationUrl.replace(/\/$/, '')}/tokens/cards`;
}

/**
 * Tokenizes a card directly against the PSP using the public key.
 * PAN never touches our API.
 */
export async function tokenizeCard(
  input: TokenizeCardInput,
): Promise<TokenizeCardResult> {
  const number = digitsOnly(input.number);
  const expiry =
    parseExpiry(`${input.expMonth}/${input.expYear}`) ??
    parseExpiry(
      input.expMonth.includes('/')
        ? input.expMonth
        : `${input.expMonth}/${input.expYear}`,
    );

  const expMonth = expiry
    ? String(expiry.month).padStart(2, '0')
    : input.expMonth.padStart(2, '0');
  const expYear = expiry
    ? String(expiry.year).slice(-2)
    : input.expYear.slice(-2);

  const response = await fetch(tokenizationUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.pspPublicKey}`,
    },
    body: JSON.stringify({
      number,
      cvc: digitsOnly(input.cvc),
      exp_month: expMonth,
      exp_year: expYear,
      card_holder: input.cardHolder.trim(),
    }),
  });

  const data = (await response.json()) as {
    status?: string;
    data?: { id?: string; brand?: string; last_four?: string };
    error?: { message?: string };
  };

  if (!response.ok || !data.data?.id) {
    throw new PspTokenizationError(
      data.error?.message ?? 'Tokenization failed',
    );
  }

  const brandRaw = (data.data.brand ?? '').toLowerCase();
  const brand: CardBrand =
    brandRaw === 'visa'
      ? 'visa'
      : brandRaw === 'mastercard' || brandRaw === 'master'
        ? 'mastercard'
        : 'unknown';

  return {
    token: data.data.id,
    brand,
    last4: data.data.last_four ?? number.slice(-4),
  };
}

/** Helper: tokenize from MM/YY expiry string. */
export async function tokenizeCardFromForm(input: {
  number: string;
  cvc: string;
  expiry: string;
  cardHolder: string;
}): Promise<TokenizeCardResult> {
  const parsed = parseExpiry(input.expiry);
  if (!parsed) {
    throw new PspTokenizationError('Invalid expiry');
  }
  return tokenizeCard({
    number: input.number,
    cvc: input.cvc,
    expMonth: String(parsed.month).padStart(2, '0'),
    expYear: String(parsed.year).slice(-2),
    cardHolder: input.cardHolder,
  });
}
