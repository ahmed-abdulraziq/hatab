import { countAr, DAY_WORDS } from './text.js';

// Entry dates are plain calendar days ("YYYY-MM-DD") in the user's local time.
// Comparing them as strings is the same as comparing the days.

const pad = (number) => String(number).padStart(2, '0');

/** Local calendar day of a Date as "YYYY-MM-DD". */
export function toISODate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayISO(now = new Date()) {
  return toISODate(now);
}

/** Parses "YYYY-MM-DD" as a local date. Returns null for anything invalid, like 2026-02-31. */
export function parseISODate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return toISODate(date) === value ? date : null;
}

export function isISODate(value) {
  return parseISODate(value) !== null;
}

export function addDays(iso, days) {
  const date = parseISODate(iso);
  if (!date) return iso;
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

/** First day of the month that contains the given day. */
export function startOfMonth(iso) {
  return `${iso.slice(0, 7)}-01`;
}

const longDate = new Intl.DateTimeFormat('ar-EG', {
  numberingSystem: 'latn',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** "2026-11-05" → "5 نوفمبر 2026" */
export function formatDate(iso) {
  const date = parseISODate(iso);
  return date ? longDate.format(date) : String(iso ?? '');
}

/** Like formatDate, but says "النهارده" and "امبارح" for the last two days. */
export function formatDayLabel(iso, today = todayISO()) {
  if (iso === today) return 'النهارده';
  if (iso === addDays(today, -1)) return 'امبارح';
  return formatDate(iso);
}

/** Whole days since an ISO timestamp, or null if it can't be read. */
export function daysSince(timestamp, now = new Date()) {
  const then = new Date(timestamp);
  if (Number.isNaN(then.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - then.getTime()) / 86_400_000));
}

/** 0 → "النهارده", 1 → "امبارح", 2 → "من يومين", 5 → "من 5 أيام", 12 → "من 12 يوم". */
export function daysAgoText(days) {
  if (days <= 0) return 'النهارده';
  if (days === 1) return 'امبارح';
  return `من ${countAr(days, DAY_WORDS)}`;
}
