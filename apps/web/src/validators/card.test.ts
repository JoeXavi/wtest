import {
  detectBrand,
  isCardholderValid,
  isCvcValid,
  isExpiryValid,
  isPersonNameValid,
  luhnValid,
  formatCardNumber,
  formatExpiryInput,
} from '@/validators/card';

describe('luhnValid', () => {
  it.each([
    ['4242424242424242', true],
    ['4111111111111111', true],
    ['5555555555554444', true],
    ['4242424242424241', false],
    ['1234', false],
    ['', false],
  ])('%s → %s', (pan, expected) => {
    expect(luhnValid(pan)).toBe(expected);
  });
});

describe('detectBrand', () => {
  it.each([
    ['4', 'visa'],
    ['4242424242424242', 'visa'],
    ['51', 'mastercard'],
    ['5555555555554444', 'mastercard'],
    ['2221', 'mastercard'],
    ['2720', 'mastercard'],
    ['6011', 'unknown'],
    ['', 'unknown'],
  ] as const)('%s → %s', (pan, expected) => {
    expect(detectBrand(pan)).toBe(expected);
  });
});

describe('isExpiryValid', () => {
  const now = new Date(2026, 7, 15); // Aug 2026 (0-indexed month)

  it.each([
    ['08/26', true],
    ['09/26', true],
    ['07/26', false],
    ['13/26', false],
    ['00/26', false],
    ['08/25', false],
    ['8/26', false],
    ['', false],
  ])('%s → %s', (value, expected) => {
    expect(isExpiryValid(value, now)).toBe(expected);
  });
});

describe('isCvcValid', () => {
  it('requires 3 digits for visa/mastercard', () => {
    expect(isCvcValid('123', 'visa')).toBe(true);
    expect(isCvcValid('12', 'visa')).toBe(false);
    expect(isCvcValid('1234', 'mastercard')).toBe(false);
  });

  it('allows 3 or 4 for unknown', () => {
    expect(isCvcValid('123', 'unknown')).toBe(true);
    expect(isCvcValid('1234', 'unknown')).toBe(true);
  });
});

describe('formatters', () => {
  it('groups card number in fours', () => {
    expect(formatCardNumber('4242424242424242')).toBe('4242 4242 4242 4242');
  });

  it('inserts slash in expiry', () => {
    expect(formatExpiryInput('0827')).toBe('08/27');
    expect(formatExpiryInput('08')).toBe('08');
  });
});

describe('isCardholderValid', () => {
  it('requires at least 5 characters for PSP card_holder', () => {
    expect(isCardholderValid('Ada')).toBe(false);
    expect(isCardholderValid('Ada L')).toBe(true);
    expect(isCardholderValid('Ada Lovelace')).toBe(true);
  });

  it('rejects invalid characters', () => {
    expect(isCardholderValid('Ada1')).toBe(false);
    expect(isCardholderValid('John3')).toBe(false);
  });
});

describe('isPersonNameValid', () => {
  it('allows short names for delivery full name', () => {
    expect(isPersonNameValid('Ana')).toBe(true);
    expect(isPersonNameValid('A')).toBe(false);
  });

  it('rejects invalid characters', () => {
    expect(isPersonNameValid('Ana1')).toBe(false);
  });
});
