import { formatMoneyFromCents } from '@/components/ui/Money';

describe('Money formatting', () => {
  it('formats the 3-hour worked example as 159.500 COP', () => {
    // 159_500_00 cents = 159.500 COP
    const formatted = formatMoneyFromCents(15_950_000);
    expect(formatted).toMatch(/159\.500/);
    expect(formatted).toMatch(/COP|\$/);
  });

  it('formats zero', () => {
    const formatted = formatMoneyFromCents(0);
    expect(formatted).toMatch(/0/);
  });

  it('formats base fee 1.500 COP', () => {
    expect(formatMoneyFromCents(150_000)).toMatch(/1\.500/);
  });
});
