import { formatMoney } from './money.js';
import { digitsOnly, matchesSearch } from './text.js';

// Every entry is written from the shop owner's side:
//   GAVE "إديته"   — I gave the client goods or money, so they owe me more (money out).
//   GOT  "خدت منه" — I got money from the client, so they owe me less (money in).
// A positive balance means the client owes me (عليه); a negative one means I owe them (له).

export const GAVE = 'gave';
export const GOT = 'got';
export const TX_TYPES = [GAVE, GOT];

export const ALL = 'all';
export const NO_CLIENT = 'none';

/** The entry's effect on the client's balance. */
export function signedAmount(tx) {
  return tx.type === GAVE ? tx.amount : -tx.amount;
}

/** Oldest first: by the entry's day, then by when it was recorded. */
export function compareChronological(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

export function newestFirst(a, b) {
  return compareChronological(b, a);
}

/** Per client: Map(clientId → { balance, count, lastDate, lastActivity }). */
export function balancesByClient(transactions) {
  const result = new Map();
  for (const tx of transactions) {
    if (!tx.clientId) continue;
    let entry = result.get(tx.clientId);
    if (!entry) {
      entry = { balance: 0, count: 0, lastDate: '', lastActivity: '' };
      result.set(tx.clientId, entry);
    }
    entry.balance += signedAmount(tx);
    entry.count += 1;
    if (tx.date > entry.lastDate) entry.lastDate = tx.date;
    const touched = tx.updatedAt || tx.createdAt || '';
    if (touched > entry.lastActivity) entry.lastActivity = touched;
  }
  return result;
}

export function balanceOf(balances, clientId) {
  return balances.get(clientId)?.balance ?? 0;
}

/** What people owe me in total, and what I owe people. */
export function summarize(clients, balances) {
  const summary = { receivable: 0, payable: 0, clientsOwing: 0, clientsOwed: 0 };
  for (const client of clients) {
    const balance = balanceOf(balances, client.id);
    if (balance > 0) {
      summary.receivable += balance;
      summary.clientsOwing += 1;
    } else if (balance < 0) {
      summary.payable -= balance;
      summary.clientsOwed += 1;
    }
  }
  return summary;
}

export function describeBalance(balance) {
  if (balance > 0) return { kind: 'owes', label: 'عليه' };
  if (balance < 0) return { kind: 'owed', label: 'له' };
  return { kind: 'settled', label: 'خالص' };
}

/** A balance in words: "عليه 50 ج.م", "له 20 ج.م", "خالص". */
export function balanceText(balance) {
  const { kind, label } = describeBalance(balance);
  return kind === 'settled' ? label : `${label} ${formatMoney(balance)}`;
}

/** A client's entries, oldest first, each with the balance right after it. */
export function withRunningBalance(transactions) {
  let running = 0;
  return [...transactions].sort(compareChronological).map((tx) => {
    running += signedAmount(tx);
    return { ...tx, balanceAfter: running };
  });
}

/** Words for an entry: for a client "إديته / خدت منه", otherwise plain "خرج / دخل". */
export function txLabel(tx) {
  if (tx.clientId) return tx.type === GAVE ? 'إديته' : 'خدت منه';
  return tx.type === GAVE ? 'خرج' : 'دخل';
}

/**
 * Filters entries. "from" and "to" are inclusive days, so choosing the same day for both
 * shows everything recorded on that day.
 */
export function filterTransactions(transactions, filters = {}, clientsById = new Map()) {
  const { query = '', clientId = ALL, type = ALL, from = '', to = '' } = filters;
  return transactions.filter((tx) => {
    if (type !== ALL && tx.type !== type) return false;
    if (clientId === NO_CLIENT && tx.clientId) return false;
    if (clientId !== ALL && clientId !== NO_CLIENT && tx.clientId !== clientId) return false;
    if (from && tx.date < from) return false;
    if (to && tx.date > to) return false;
    if (query) {
      const clientName = tx.clientId ? (clientsById.get(tx.clientId)?.name ?? '') : '';
      if (!matchesSearch([tx.note, clientName], query)) return false;
    }
    return true;
  });
}

/** Money in, money out and the difference. */
export function totals(transactions) {
  let moneyIn = 0;
  let moneyOut = 0;
  for (const tx of transactions) {
    if (tx.type === GOT) moneyIn += tx.amount;
    else moneyOut += tx.amount;
  }
  return { moneyIn, moneyOut, net: moneyIn - moneyOut };
}

/** Splits an already sorted list into runs of the same day: [{ date, items }]. */
export function groupByDate(sortedTransactions) {
  const groups = [];
  for (const tx of sortedTransactions) {
    const last = groups[groups.length - 1];
    if (last && last.date === tx.date) last.items.push(tx);
    else groups.push({ date: tx.date, items: [tx] });
  }
  return groups;
}

/** Search clients by name or address, or by at least 3 digits of their phone number. */
export function clientMatches(client, query) {
  if (matchesSearch([client.name, client.address], query)) return true;
  const digits = digitsOnly(query);
  return digits.length >= 3 && digitsOnly(client.phone).includes(digits);
}

export const CLIENT_SORTS = {
  recent: 'آخر حركة',
  balance: 'الأكتر عليه',
  name: 'الاسم',
};

const arabicOrder = new Intl.Collator('ar');

export function compareNames(a, b) {
  return arabicOrder.compare(a.name, b.name);
}

/** Sorts clients by latest activity (default), by who owes the most, or by name. */
export function sortClients(clients, balances, sortBy = 'recent') {
  const list = [...clients];
  if (sortBy === 'name') return list.sort(compareNames);
  if (sortBy === 'balance') {
    return list.sort(
      (a, b) => balanceOf(balances, b.id) - balanceOf(balances, a.id) || compareNames(a, b),
    );
  }
  const lastActivity = (client) => {
    const fromEntries = balances.get(client.id)?.lastActivity ?? '';
    const own = client.updatedAt || client.createdAt || '';
    return fromEntries > own ? fromEntries : own;
  };
  return list.sort((a, b) => {
    const x = lastActivity(a);
    const y = lastActivity(b);
    if (x === y) return compareNames(a, b);
    return x < y ? 1 : -1;
  });
}
