import { describe, expect, it } from 'vitest';
import {
  ALL,
  balancesByClient,
  clientMatches,
  describeBalance,
  filterTransactions,
  GAVE,
  GOT,
  groupByDate,
  newestFirst,
  NO_CLIENT,
  sortClients,
  summarize,
  totals,
  txLabel,
  withRunningBalance,
} from './ledger.js';

const ahmed = { id: 'a', name: 'أحمد علي', phone: '010 1234 5678', address: 'شبرا', createdAt: '2026-11-01T08:00:00Z' };
const mona = { id: 'm', name: 'منى', phone: '', address: '', createdAt: '2026-11-02T08:00:00Z' };
const sameh = { id: 's', name: 'سامح', phone: '', address: '', createdAt: '2026-11-04T08:00:00Z' };
const clients = [ahmed, mona, sameh];
const clientsById = new Map(clients.map((c) => [c.id, c]));

let seq = 0;
const tx = (fields) => {
  seq += 1;
  return {
    id: `t${seq}`,
    clientId: null,
    note: '',
    createdAt: `2026-11-0${(seq % 9) + 1}T10:00:00Z`,
    ...fields,
  };
};

const entries = [
  tx({ clientId: 'a', type: GAVE, amount: 15000, date: '2026-11-01', note: '2 كيلو سكر', createdAt: '2026-11-01T09:00:00Z' }),
  tx({ clientId: 'a', type: GOT, amount: 10000, date: '2026-11-03', createdAt: '2026-11-03T09:00:00Z' }),
  tx({ clientId: 'm', type: GOT, amount: 3000, date: '2026-11-02', createdAt: '2026-11-02T09:00:00Z' }),
  tx({ type: GAVE, amount: 2500, date: '2026-11-03', note: 'كهربا', createdAt: '2026-11-03T12:00:00Z' }),
  tx({ type: GOT, amount: 50000, date: '2026-11-05', note: 'بيع نقدي', createdAt: '2026-11-05T12:00:00Z' }),
];

describe('balances', () => {
  const balances = balancesByClient(entries);

  it('adds what I gave and subtracts what I got, per client', () => {
    expect(balances.get('a')).toMatchObject({ balance: 5000, count: 2, lastDate: '2026-11-03' });
    expect(balances.get('m')).toMatchObject({ balance: -3000, count: 1 });
    expect(balances.has('s')).toBe(false);
  });

  it('sums what people owe me and what I owe them', () => {
    expect(summarize(clients, balances)).toEqual({
      receivable: 5000,
      payable: 3000,
      clientsOwing: 1,
      clientsOwed: 1,
    });
  });

  it('describes balances in words', () => {
    expect(describeBalance(5000)).toEqual({ kind: 'owes', label: 'عليه' });
    expect(describeBalance(-1)).toEqual({ kind: 'owed', label: 'له' });
    expect(describeBalance(0)).toEqual({ kind: 'settled', label: 'خالص' });
  });
});

describe('withRunningBalance', () => {
  it('orders by day, then by time recorded, and keeps a running balance', () => {
    const list = withRunningBalance([
      { id: 'x3', type: GOT, amount: 500, date: '2026-11-02', createdAt: '2026-11-02T10:00:00Z' },
      { id: 'x1', type: GAVE, amount: 1000, date: '2026-11-01', createdAt: '2026-11-04T10:00:00Z' },
      { id: 'x2', type: GAVE, amount: 200, date: '2026-11-02', createdAt: '2026-11-02T09:00:00Z' },
    ]);
    expect(list.map((e) => [e.id, e.balanceAfter])).toEqual([
      ['x1', 1000],
      ['x2', 1200],
      ['x3', 700],
    ]);
  });
});

describe('filterTransactions', () => {
  const ids = (list) => list.map((e) => e.id).sort();

  it('includes the whole "to" day (the old app dropped it)', () => {
    const result = filterTransactions(entries, { from: '2026-11-03', to: '2026-11-03' }, clientsById);
    expect(ids(result)).toEqual(['t2', 't4']);
  });

  it('filters by type and by client', () => {
    expect(ids(filterTransactions(entries, { type: GOT }))).toEqual(['t2', 't3', 't5']);
    expect(ids(filterTransactions(entries, { clientId: NO_CLIENT }))).toEqual(['t4', 't5']);
    expect(ids(filterTransactions(entries, { clientId: 'a', type: ALL }))).toEqual(['t1', 't2']);
  });

  it('searches notes and client names, forgiving spelling', () => {
    expect(ids(filterTransactions(entries, { query: 'احمد' }, clientsById))).toEqual(['t1', 't2']);
    expect(ids(filterTransactions(entries, { query: 'سكر' }, clientsById))).toEqual(['t1']);
  });
});

describe('totals and grouping', () => {
  it('sums money in and out', () => {
    expect(totals(entries)).toEqual({ moneyIn: 63000, moneyOut: 17500, net: 45500 });
    expect(totals([])).toEqual({ moneyIn: 0, moneyOut: 0, net: 0 });
  });

  it('groups consecutive entries of the same day', () => {
    const groups = groupByDate([...entries].sort(newestFirst));
    expect(groups.map((g) => [g.date, g.items.length])).toEqual([
      ['2026-11-05', 1],
      ['2026-11-03', 2],
      ['2026-11-02', 1],
      ['2026-11-01', 1],
    ]);
  });

  it('labels entries from the shop owner side', () => {
    expect(txLabel({ clientId: 'a', type: GAVE })).toBe('إديته');
    expect(txLabel({ clientId: 'a', type: GOT })).toBe('خدت منه');
    expect(txLabel({ clientId: null, type: GAVE })).toBe('خرج');
    expect(txLabel({ clientId: null, type: GOT })).toBe('دخل');
  });
});

describe('clients', () => {
  it('finds clients by name, address or phone digits', () => {
    expect(clientMatches(ahmed, 'احمد')).toBe(true);
    expect(clientMatches(ahmed, 'شبرا')).toBe(true);
    expect(clientMatches(ahmed, '٠١٠١٢٣')).toBe(true);
    expect(clientMatches(ahmed, '12')).toBe(false);
    expect(clientMatches(mona, '010')).toBe(false);
  });

  it('sorts by who owes the most, by name, and by latest activity', () => {
    const balances = balancesByClient(entries);
    expect(sortClients(clients, balances, 'balance').map((c) => c.id)).toEqual(['a', 's', 'm']);
    expect(sortClients(clients, balances, 'name').map((c) => c.id)).toEqual(['a', 's', 'm']);
    // Sameh was added on Nov 4, after Ahmed's last entry (Nov 3) and Mona's (Nov 2).
    expect(sortClients(clients, balances, 'recent').map((c) => c.id)).toEqual(['s', 'a', 'm']);
  });
});
