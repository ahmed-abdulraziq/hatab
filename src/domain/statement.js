import { formatDate, parseISODate } from './dates.js';
import { dueStatus } from './due.js';
import { GAVE, withRunningBalance } from './ledger.js';
import { formatAmount, formatMoney } from './money.js';
import { countAr, TX_WORDS } from './text.js';

// The statement image is sent to the client, so it speaks to them:
//   GAVE "إديته"   → "خدت"  (you took goods or money)
//   GOT  "خدت منه" → "دفعت" (you paid)

/** A picture is only readable with so many rows; older entries fold into one opening line. */
export const STATEMENT_MAX_ROWS = 25;

const dayAndMonth = new Intl.DateTimeFormat('ar-EG', { numberingSystem: 'latn', day: 'numeric', month: 'long' });

/** "5 نوفمبر" within the current year, "5 نوفمبر 2025" otherwise. */
export function shortDate(iso, today) {
  const date = parseISODate(iso);
  if (!date) return String(iso ?? '');
  return iso.slice(0, 4) === String(today).slice(0, 4) ? dayAndMonth.format(date) : formatDate(iso);
}

/** A balance from the client's side: "عليك 50 ج.م", "ليك 20 ج.م", "خالص". */
export function clientBalanceText(balance) {
  if (balance > 0) return `عليك ${formatMoney(balance)}`;
  if (balance < 0) return `ليك ${formatMoney(balance)}`;
  return 'خالص';
}

export function balanceKind(balance) {
  if (balance > 0) return 'owes';
  if (balance < 0) return 'owed';
  return 'settled';
}

/**
 * Everything the statement image shows, already in words. `transactions` may hold any
 * entries; only the client's are used. The newest `maxRows` are listed oldest first, and
 * whatever came before them is summed into an opening balance.
 */
export function buildStatement({ client, transactions, shopName = '', today, maxRows = STATEMENT_MAX_ROWS }) {
  const all = withRunningBalance(transactions.filter((tx) => tx.clientId === client.id));
  const shown = all.slice(Math.max(0, all.length - maxRows));
  const hiddenCount = all.length - shown.length;
  const openingBalance = hiddenCount > 0 ? all[hiddenCount - 1].balanceAfter : 0;
  const balance = all.length > 0 ? all[all.length - 1].balanceAfter : 0;

  let took = 0;
  let paid = 0;
  for (const tx of all) {
    if (tx.type === GAVE) took += tx.amount;
    else paid += tx.amount;
  }

  const due = dueStatus(client.dueDate, balance, today);

  return {
    shopName: shopName.trim(),
    clientName: client.name,
    clientPhone: client.phone ?? '',
    dateText: formatDate(today),
    balance,
    balanceKind: balanceKind(balance),
    balanceLabel: balance > 0 ? 'عليك' : balance < 0 ? 'ليك' : 'الحساب',
    balanceAmount: balance === 0 ? 'خالص' : formatMoney(balance),
    countText: all.length > 0 ? countAr(all.length, TX_WORDS) : 'لسه مفيش حركات',
    // Said to the client, so "كان" once the day has passed.
    dueText: due ? `${due.kind === 'overdue' ? 'ميعاد السداد كان' : 'ميعاد السداد'} ${due.dateText}` : '',
    dueOverdue: due?.kind === 'overdue',
    opening:
      hiddenCount > 0
        ? {
            text: `رصيد قبل كده (${countAr(hiddenCount, TX_WORDS)} أقدم)`,
            balance: clientBalanceText(openingBalance),
            kind: balanceKind(openingBalance),
          }
        : null,
    rows: shown.map((tx) => ({
      id: tx.id,
      date: shortDate(tx.date, today),
      note: tx.note || (tx.type === GAVE ? 'خدت' : 'دفعت'),
      took: tx.type === GAVE ? formatAmount(tx.amount) : '',
      paid: tx.type === GAVE ? '' : formatAmount(tx.amount),
      balance: clientBalanceText(tx.balanceAfter),
      kind: balanceKind(tx.balanceAfter),
    })),
    totals: { took: formatAmount(took), paid: formatAmount(paid) },
  };
}

/** "كشف-حساب-أحمد-علي-2026-11-20.png" — letters of any script, spaces turned to dashes. */
export function statementFileName(clientName, today) {
  const name = clientName
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '-');
  return `كشف-حساب-${name || 'عميل'}-${today}.png`;
}
