import { beforeEach, describe, expect, it } from 'vitest';
import { GAVE, GOT } from '../domain/ledger.js';
import { db } from './db.js';
import {
  addClient,
  addTransaction,
  deleteClient,
  deleteTransaction,
  exportData,
  migrateLegacyData,
  replaceAllData,
  setSetting,
  updateClient,
  updateTransaction,
} from './repo.js';

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

const memoryStorage = (items) => ({ getItem: (key) => items[key] ?? null });

describe('clients and entries', () => {
  it('saves, edits and deletes entries', async () => {
    const client = await addClient({ name: 'أحمد', phone: '010', address: '' });
    const tx = await addTransaction({ clientId: client.id, type: GAVE, amount: 15000, date: '2026-11-05', note: 'سكر' });
    expect(await db.transactions.get(tx.id)).toMatchObject({ clientId: client.id, amount: 15000 });

    await updateTransaction(tx.id, { clientId: client.id, type: GOT, amount: 500, date: '2026-11-04', note: '' });
    const updated = await db.transactions.get(tx.id);
    expect(updated).toMatchObject({ type: GOT, amount: 500, date: '2026-11-04', createdAt: tx.createdAt });
    expect(updated.updatedAt >= tx.updatedAt).toBe(true);

    await deleteTransaction(tx.id);
    expect(await db.transactions.count()).toBe(0);
  });

  it('updates client details', async () => {
    const client = await addClient({ name: 'منى' });
    await updateClient(client.id, { name: 'منى حسن', phone: '01012345678' });
    expect(await db.clients.get(client.id)).toMatchObject({ name: 'منى حسن', phone: '01012345678', address: '' });
  });

  it('deletes a client with all of their entries, and nothing else', async () => {
    const ahmed = await addClient({ name: 'أحمد' });
    const mona = await addClient({ name: 'منى' });
    await addTransaction({ clientId: ahmed.id, type: GAVE, amount: 100, date: '2026-11-05' });
    await addTransaction({ clientId: ahmed.id, type: GOT, amount: 50, date: '2026-11-05' });
    const kept = await addTransaction({ clientId: mona.id, type: GAVE, amount: 70, date: '2026-11-05' });
    const loose = await addTransaction({ type: GOT, amount: 20, date: '2026-11-05' });

    await deleteClient(ahmed.id);

    expect(await db.clients.toCollection().primaryKeys()).toEqual([mona.id]);
    expect((await db.transactions.toCollection().primaryKeys()).sort()).toEqual([kept.id, loose.id].sort());
  });
});

describe('backup data', () => {
  it('exports everything and restores it in place of the current data', async () => {
    const client = await addClient({ name: 'أحمد' });
    await addTransaction({ clientId: client.id, type: GAVE, amount: 100, date: '2026-11-05' });
    await setSetting('shopName', 'محل الأمل');
    const backup = await exportData();
    expect(backup.settings.shopName).toBe('محل الأمل');

    await addClient({ name: 'هيتمسح' });
    await setSetting('shopName', 'اسم تاني');
    await replaceAllData(backup);

    expect(await exportData()).toEqual(backup);
  });
});

describe('migrateLegacyData', () => {
  const legacy = memoryStorage({
    client: JSON.stringify([{ id: 0.5, name: 'Ahmed', phone: '', address: '' }]),
    cash: JSON.stringify([{ id: 0.1, cash: 40, name: 'Ahmed', type: 'cach out', date: 'Nov 01 2026 10:00:00 ' }]),
  });

  it('does nothing when the old app left no data', async () => {
    expect(await migrateLegacyData(memoryStorage({}))).toBeNull();
    expect(await db.settings.count()).toBe(0);
  });

  it('imports the old data once, even when called twice at the same time', async () => {
    const [first, second] = await Promise.all([migrateLegacyData(legacy), migrateLegacyData(legacy)]);
    expect([first, second].filter(Boolean)).toHaveLength(1);
    expect(await db.clients.count()).toBe(1);
    expect(await db.transactions.count()).toBe(1);

    expect(await migrateLegacyData(legacy)).toBeNull();
    expect(await db.clients.count()).toBe(1);
  });

  it('never mixes old data into a database that is already in use', async () => {
    await addClient({ name: 'جديد' });
    expect(await migrateLegacyData(legacy)).toBeNull();
    expect((await db.clients.toArray()).map((c) => c.name)).toEqual(['جديد']);
    expect((await db.settings.get('legacyImported')).value).toBe(true);
  });
});
