import { toLatinDigits } from './text.js';

// Amounts are stored as whole piasters (قروش): 1 جنيه = 100 قرش.
// Whole numbers add up exactly, so totals never show things like 0.30000000000000004.

/** A sanity limit: one billion pounds. */
export const MAX_AMOUNT = 1_000_000_000 * 100;

const GROUPED_THOUSANDS = /^\d{1,3}(,\d{3})+(\.\d*)?$/;
const DECIMAL_COMMA = /^\d+,\d{1,2}$/;
const PLAIN_NUMBER = /^(\d*)(?:\.(\d{0,2}))?$/;

/**
 * Turns what the user typed into piasters, or null when it isn't an amount above zero.
 * Accepts Arabic digits, "٫" as the decimal point, and thousands separators ("1,500").
 */
export function parseAmount(input) {
  let text = toLatinDigits(input)
    .trim()
    .replace(/[\s\u066C\u2009\u202F]/g, '')
    .replace(/\u066B/g, '.')
    .replace(/\u060C/g, ',');

  if (text.includes(',')) {
    if (GROUPED_THOUSANDS.test(text)) text = text.replace(/,/g, '');
    else if (DECIMAL_COMMA.test(text)) text = text.replace(',', '.');
    else return null;
  }

  const match = PLAIN_NUMBER.exec(text);
  if (!match || (match[1] === '' && !match[2])) return null;

  const pounds = match[1] === '' ? 0 : Number(match[1]);
  const piasters = Number((match[2] ?? '').padEnd(2, '0'));
  const total = pounds * 100 + piasters;
  if (!Number.isSafeInteger(total) || total <= 0 || total > MAX_AMOUNT) return null;
  return total;
}

const wholePounds = new Intl.NumberFormat('ar-EG', {
  numberingSystem: 'latn',
  maximumFractionDigits: 0,
});
const withPiasters = new Intl.NumberFormat('ar-EG', {
  numberingSystem: 'latn',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 125050 → "1,250.50". Always positive: callers say the direction in words. */
export function formatAmount(piasters) {
  const abs = Math.abs(piasters);
  return (abs % 100 === 0 ? wholePounds : withPiasters).format(abs / 100);
}

/** 125050 → "1,250.50 ج.م" */
export function formatMoney(piasters) {
  return `${formatAmount(piasters)} ج.م`;
}

/** What to put back in an input when editing: 125050 → "1250.50", 15000 → "150". */
export function amountToInput(piasters) {
  const abs = Math.abs(piasters);
  const pounds = Math.trunc(abs / 100);
  const rest = abs % 100;
  return rest === 0 ? String(pounds) : `${pounds}.${String(rest).padStart(2, '0')}`;
}
