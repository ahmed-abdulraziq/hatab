// Helpers for Arabic text: digits, forgiving search and counting words.

const ARABIC_INDIC_ZERO = 0x0660; // ٠
const EASTERN_ARABIC_INDIC_ZERO = 0x06f0; // ۰

/** Converts Arabic-Indic digits (٠-٩ and ۰-۹) to Western digits (0-9). */
export function toLatinDigits(value) {
  return String(value ?? '').replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (digit) => {
    const code = digit.charCodeAt(0);
    const zero = code >= EASTERN_ARABIC_INDIC_ZERO ? EASTERN_ARABIC_INDIC_ZERO : ARABIC_INDIC_ZERO;
    return String(code - zero);
  });
}

/** Trims and collapses inner whitespace. */
export function cleanText(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes text so searching forgives common spelling differences:
 * أحمد = احمد, مكة = مكه, مصطفى = مصطفي, and diacritics or tatweel are ignored.
 */
export function normalizeForSearch(value) {
  return cleanText(toLatinDigits(value))
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي');
}

/** True when the query is empty or any of the fields contains it. */
export function matchesSearch(fields, query) {
  const wanted = normalizeForSearch(query);
  if (!wanted) return true;
  return fields.some((field) => normalizeForSearch(field).includes(wanted));
}

/** Keeps only the digits: "010-123 45" → "01012345". */
export function digitsOnly(value) {
  return toLatinDigits(value).replace(/\D/g, '');
}

/**
 * Arabic count phrases: 1 → "عميل واحد", 2 → "عميلين", 3-10 → "3 عملاء", 11+ → "11 عميل".
 * Callers handle zero themselves ("مفيش عملاء").
 */
export function countAr(count, { one, two, few, many }) {
  if (count === 1) return one;
  if (count === 2) return two;
  const lastTwo = count % 100;
  return `${count} ${lastTwo >= 3 && lastTwo <= 10 ? few : many}`;
}

export const CLIENT_WORDS = { one: 'عميل واحد', two: 'عميلين', few: 'عملاء', many: 'عميل' };
export const TX_WORDS = { one: 'حركة واحدة', two: 'حركتين', few: 'حركات', many: 'حركة' };
export const DAY_WORDS = { one: 'يوم واحد', two: 'يومين', few: 'أيام', many: 'يوم' };
export const CHANGE_WORDS = { one: 'تغيير واحد', two: 'تغييرين', few: 'تغييرات', many: 'تغيير' };
