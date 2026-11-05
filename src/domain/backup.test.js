import { describe, expect, it } from 'vitest';
import { BackupError, createBackup, exportFileName, parseBackup, transactionsToCSV } from './backup.js';
import { GAVE, GOT } from './ledger.js';

const clients = [
  { id: 'a', name: 'أحمد', phone: '01012345678', address: '', createdAt: '2026-11-01T08:00:00.000Z', updatedAt: '2026-11-01T08:00:00.000Z' },
];
const transactions = [
  { id: 't1', clientId: 'a', type: GAVE, amount: 15050, date: '2026-11-01', note: 'سكر, "فاخر"', createdAt: '2026-11-01T09:00:00.000Z', updatedAt: '2026-11-01T09:00:00.000Z' },
  { id: 't2', clientId: null, type: GOT, amount: 2000, date: '2026-11-02', note: '=1+1', createdAt: '2026-11-02T09:00:00.000Z', updatedAt: '2026-11-02T09:00:00.000Z' },
];
const json = (value) => JSON.stringify(value);

describe('backups', () => {
  it('survive a round trip', () => {
    const backup = createBackup({ clients, transactions, settings: { shopName: 'محل الأمل', lastBackupAt: 'x' } });
    expect(backup).toMatchObject({ app: 'hatab', version: 1, settings: { shopName: 'محل الأمل' } });
    expect(parseBackup(json(backup))).toEqual({ clients, transactions, settings: { shopName: 'محل الأمل' } });
  });

  it('are named by date', () => {
    expect(exportFileName('backup', 'json', new Date(2026, 10, 5))).toBe('hatab-backup-2026-11-05.json');
  });

  it.each([
    ['not JSON', 'hello'],
    ['another app', json({ app: 'other', version: 1, clients: [], transactions: [] })],
    ['missing lists', json({ app: 'hatab', version: 1 })],
  ])('reject %s', (_, text) => {
    expect(() => parseBackup(text)).toThrow(BackupError);
    expect(() => parseBackup(text)).toThrow('الملف ده مش نسخة احتياطية من HATAB.');
  });

  it('reject files from a newer version of the app', () => {
    expect(() => parseBackup(json({ app: 'hatab', version: 2, clients: [], transactions: [] }))).toThrow(/إصدار أحدث/);
  });

  it.each([
    ['an entry of an unknown client', { transactions: [{ ...transactions[0], clientId: 'ghost' }] }],
    ['a fractional amount', { transactions: [{ ...transactions[0], amount: 10.5 }] }],
    ['a bad date', { transactions: [{ ...transactions[0], date: '2026-13-01' }] }],
    ['a duplicate id', { transactions: [transactions[0], transactions[0]] }],
    ['a client without a name', { clients: [{ ...clients[0], name: ' ' }] }],
  ])('reject %s', (_, change) => {
    const text = json({ app: 'hatab', version: 1, clients, transactions, ...change });
    expect(() => parseBackup(text)).toThrow(/بيانات بايظة/);
  });
});

describe('transactionsToCSV', () => {
  const csv = transactionsToCSV(transactions, new Map(clients.map((c) => [c.id, c])));

  it('starts with a byte order mark so Excel reads Arabic', () => {
    expect(csv.startsWith('\uFEFFالتاريخ,العميل,النوع')).toBe(true);
  });

  it('quotes commas and quotes, and keeps formulas from running', () => {
    const lines = csv.slice(1).trimEnd().split('\r\n');
    expect(lines).toEqual([
      'التاريخ,العميل,النوع,إديت (خرج),خدت (دخل),ملاحظة',
      '2026-11-01,أحمد,إديته,150.50,,"سكر, ""فاخر"""',
      "2026-11-02,بدون عميل,دخل,,20.00,'=1+1",
    ]);
  });
});
