import { addDays, daysAgoText, formatDate, parseISODate } from './dates.js';
import { balanceOf } from './ledger.js';
import { countAr, DAY_WORDS } from './text.js';

// A due date is the day a client promised to pay by ("ميعاد السداد"). It is kept on the
// client as "YYYY-MM-DD" (or empty), and only means something while the client owes money:
// once their balance is paid off, the app clears it (see db/repo.js).

/** Whole calendar days from `from` to `to` ("YYYY-MM-DD"); negative when `to` is earlier. */
export function daysBetween(from, to) {
  const a = parseISODate(from);
  const b = parseISODate(to);
  if (!a || !b) return null;
  const utc = (date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((utc(b) - utc(a)) / 86_400_000);
}

/**
 * Where a client stands with their due date, or null when there's nothing to remind about
 * (no date, or they don't owe anything).
 *   kind: "overdue" | "today" | "soon" (within 3 days) | "later"
 *   short: a few words for lists; text: a full sentence for the client's page.
 */
export function dueStatus(dueDate, balance, today) {
  if (!dueDate || balance <= 0) return null;
  const days = daysBetween(today, dueDate);
  if (days === null) return null;
  const dateText = formatDate(dueDate);

  if (days < 0) {
    return { kind: 'overdue', days, dateText, short: 'فات ميعاده', text: `فات ميعاد السداد ${daysAgoText(-days)}` };
  }
  if (days === 0) return { kind: 'today', days, dateText, short: 'ميعاده النهارده', text: 'ميعاد السداد النهارده' };
  if (days === 1) return { kind: 'soon', days, dateText, short: 'ميعاده بكره', text: 'ميعاد السداد بكره' };
  const after = `بعد ${countAr(days, DAY_WORDS)}`;
  return { kind: days <= 3 ? 'soon' : 'later', days, dateText, short: `ميعاده ${after}`, text: `ميعاد السداد ${after}` };
}

/** True when the reminder needs doing now: the day came or passed. */
export const isDueNow = (status) => status?.kind === 'overdue' || status?.kind === 'today';

/** Clients whose due date is today or already passed, earliest date first. */
export function clientsDueNow(clients, balances, today) {
  return clients
    .filter((client) => isDueNow(dueStatus(client.dueDate, balanceOf(balances, client.id), today)))
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
}

/** One-tap choices when setting a due date. */
export function dueDateChoices(today) {
  const date = parseISODate(today);
  const nextMonth = date ? new Date(date.getFullYear(), date.getMonth() + 1, 1) : null;
  const pad = (n) => String(n).padStart(2, '0');
  return [
    { label: 'بعد 3 أيام', date: addDays(today, 3) },
    { label: 'بعد أسبوع', date: addDays(today, 7) },
    { label: 'بعد أسبوعين', date: addDays(today, 14) },
    {
      label: 'أول الشهر الجاي',
      date: nextMonth ? `${nextMonth.getFullYear()}-${pad(nextMonth.getMonth() + 1)}-01` : today,
    },
  ];
}

/** Checks a due date typed in the form. Returns an error message, or null when it's fine. */
export function validateDueDate(value, today) {
  if (!parseISODate(value)) return 'اختار يوم السداد.';
  if (value < today) return 'اختار النهارده أو يوم جاي.';
  return null;
}
