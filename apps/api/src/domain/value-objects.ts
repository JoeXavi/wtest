import { err, ok, type Result } from '../shared/result';
import type { CardBrand, LegalIdType } from './errors';

export type Email = { readonly value: string };
export type Reference = { readonly value: string };
export type Phone = { readonly value: string };
export type LegalId = { readonly type: LegalIdType; readonly value: string };

export function createEmail(raw: string): Result<Email, string> {
  const value = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return err('Enter a valid email');
  }
  return ok({ value });
}

export function createReference(value: string): Result<Reference, string> {
  if (!value || value.length > 255) {
    return err('Reference must be 1–255 characters');
  }
  return ok({ value });
}

export function createPhone(raw: string): Result<Phone, string> {
  const value = raw.trim();
  if (!/^\+?\d{7,15}$/.test(value)) {
    return err('Enter a valid phone number');
  }
  return ok({ value });
}

export function createLegalId(type: LegalIdType, raw: string): Result<LegalId, string> {
  const value = raw.trim();
  if (value.length < 4 || value.length > 20) {
    return err('Enter a valid legal id');
  }
  return ok({ type, value });
}

export function detectCardBrand(digits: string): CardBrand {
  const cleaned = digits.replace(/\D/g, '');
  if (/^4\d{0,18}$/.test(cleaned) && cleaned.length >= 1) return 'visa';
  const bin2 = Number(cleaned.slice(0, 2));
  const bin4 = Number(cleaned.slice(0, 4));
  if ((bin2 >= 51 && bin2 <= 55) || (bin4 >= 2221 && bin4 <= 2720)) return 'mastercard';
  return 'unknown';
}

export function luhnValid(digits: string): boolean {
  const cleaned = digits.replace(/\D/g, '');
  if (cleaned.length < 13 || cleaned.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = cleaned.length - 1; i >= 0; i -= 1) {
    let n = Number(cleaned[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}
