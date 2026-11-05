import { describe, expect, it } from 'vitest';
import { amountToInput, formatAmount, formatMoney, MAX_AMOUNT, parseAmount } from './money.js';

describe('parseAmount', () => {
  it.each([
    ['150', 15000],
    ['12.5', 1250],
    ['12.05', 1205],
    ['12.', 1200],
    ['.5', 50],
    [' 7 ', 700],
    ['١٥٠', 15000],
    ['١٢٫٥', 1250],
    ['1,500', 150000],
    ['1,500.25', 150025],
    ['1 500', 150000],
    ['12,5', 1250],
    ['12,50', 1250],
  ])('reads %j as %i piasters', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it.each(['', '   ', '0', '0.00', '-5', 'abc', '1e3', '1.234', '1,50,0', '12,345,6', '.'])(
    'rejects %j',
    (input) => {
      expect(parseAmount(input)).toBeNull();
    },
  );

  it('rejects amounts above the sanity limit', () => {
    expect(parseAmount(String(MAX_AMOUNT / 100 + 1))).toBeNull();
  });

  it('adds up exactly, unlike floating point', () => {
    expect(parseAmount('0.1') + parseAmount('0.2')).toBe(parseAmount('0.3'));
  });
});

describe('formatting', () => {
  it('shows piasters only when there are any', () => {
    expect(formatAmount(15000)).toBe('150');
    expect(formatAmount(125050)).toBe('1,250.50');
    expect(formatAmount(-500)).toBe('5');
    expect(formatMoney(1205)).toBe('12.05 ج.م');
  });

  it('turns amounts back into editable text', () => {
    expect(amountToInput(125050)).toBe('1250.50');
    expect(amountToInput(15000)).toBe('150');
    expect(amountToInput(1205)).toBe('12.05');
    expect(parseAmount(amountToInput(987654))).toBe(987654);
  });
});
