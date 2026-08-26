import type { CardBrand } from '@norte/contracts';

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function luhnValid(pan: string): boolean {
  const digits = digitsOnly(pan);
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = Number(digits[i]);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

export function detectBrand(pan: string): CardBrand {
  const digits = digitsOnly(pan);
  if (!digits) return 'unknown';

  if (digits.startsWith('4')) return 'visa';

  const two = Number(digits.slice(0, 2));
  if (two >= 51 && two <= 55) return 'mastercard';

  if (digits.length >= 4) {
    const four = Number(digits.slice(0, 4));
    if (four >= 2221 && four <= 2720) return 'mastercard';
  }

  return 'unknown';
}

export function formatCardNumber(value: string): string {
  const digits = digitsOnly(value).slice(0, 19);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

export function parseExpiry(value: string): { month: number; year: number } | null {
  const cleaned = value.replace(/\s/g, '');
  const match = /^(\d{2})\/(\d{2})$/.exec(cleaned);
  if (!match) return null;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { month, year };
}

export function formatExpiryInput(value: string): string {
  const digits = digitsOnly(value).slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export function isExpiryValid(value: string, now = new Date()): boolean {
  const parsed = parseExpiry(value);
  if (!parsed) return false;
  const { month, year } = parsed;
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  if (year < currentYear) return false;
  if (year === currentYear && month < currentMonth) return false;
  return true;
}

export function isCvcValid(cvc: string, brand: CardBrand): boolean {
  const digits = digitsOnly(cvc);
  if (brand === 'unknown') {
    return digits.length === 3 || digits.length === 4;
  }
  // Visa / Mastercard use 3; keep 4 for Amex-length BINs if brand unknown already handled
  return digits.length === 3;
}

export function last4(pan: string): string {
  const digits = digitsOnly(pan);
  return digits.slice(-4);
}

export function isCardholderValid(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 60) return false;
  return /^[A-Za-zÀ-ÿ\s]+$/.test(trimmed);
}

export function isEmailValid(email: string): boolean {
  const trimmed = email.trim();
  // RFC-ish: single @, non-empty local, domain with a dot
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export function isPhoneValid(phone: string): boolean {
  const trimmed = phone.trim();
  return /^\+?\d{7,15}$/.test(trimmed);
}

export function isAddressLine1Valid(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 5 && trimmed.length <= 100;
}

export function isCityOrRegionValid(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 2 && trimmed.length <= 60;
}
