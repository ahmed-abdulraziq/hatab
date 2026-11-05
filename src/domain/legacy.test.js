import { describe, expect, it } from 'vitest';
import { GAVE, GOT } from './ledger.js';
import { convertLegacyData } from './legacy.js';

// Exactly what the first version of the app saved in localStorage.
const oldClients = JSON.stringify([
  { id: 0.123, name: 'Ahmed', phone: '0100', address: 'Cairo' },
  { id: 0.456, name: 'Mona', phone: '', address: '' },
]);
const oldCash = JSON.stringify([
  { id: 0.1, cash: 150.5, name: 'Ahmed', type: 'cach out', date: 'Nov 01 2026 14:33:12 ' },
  { id: 0.2, cash: 100, name: 'Ahmed', type: 'cach in', date: 'Nov 03 2026 09:00:00 ' },
  { id: 0.3, cash: 20, name: 'free', type: 'cach in', date: 'Nov 04 2026 10:00:00 ' },
  { id: 0.4, cash: 75, name: 'Sameh', type: 'cach out', date: 'garbage' },
  { id: 0.5, cash: 'abc', name: 'Mona', type: 'cach in', date: 'Nov 04 2026 10:00:00 ' },
  { id: 0.6, cash: 10, name: 'Mona', type: 'something', date: 'Nov 04 2026 10:00:00 ' },
]);

describe('convertLegacyData', () => {
  let n = 0;
  const now = new Date(2026, 10, 5, 12, 0);
  const { clients, transactions, skipped } = convertLegacyData(oldClients, oldCash, {
    newId: () => `id${++n}`,
    now,
  });
  const ahmed = clients.find((c) => c.name === 'Ahmed');

  it('keeps the clients and their details', () => {
    expect(clients.map((c) => c.name)).toEqual(['Ahmed', 'Mona']);
    expect(ahmed).toMatchObject({ phone: '0100', address: 'Cairo' });
  });

  it('links entries by id and maps cash in/out to خدت منه/إديته', () => {
    expect(transactions.slice(0, 2)).toMatchObject([
      { clientId: ahmed.id, type: GAVE, amount: 15050, date: '2026-11-01' },
      { clientId: ahmed.id, type: GOT, amount: 10000, date: '2026-11-03' },
    ]);
  });

  it('keeps entries without a client, and remembers deleted clients by name', () => {
    expect(transactions[2]).toMatchObject({ clientId: null, type: GOT, amount: 2000, note: '' });
    expect(transactions[3]).toMatchObject({ clientId: null, type: GAVE, note: 'عميل قديم: Sameh', date: '2026-11-05' });
  });

  it('skips entries it cannot understand', () => {
    expect(transactions).toHaveLength(4);
    expect(skipped).toBe(2);
  });

  it('copes with missing or broken data', () => {
    expect(convertLegacyData(null, '{broken', { newId: () => 'x' })).toEqual({ clients: [], transactions: [], skipped: 0 });
  });
});
