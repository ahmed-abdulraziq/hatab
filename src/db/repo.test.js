import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { GAVE, GOT } from '../domain/ledger.js';
import { onLocalChange } from '../sync/signals.js';
import { db, isLive } from './db.js';
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
const live = (table) => table.filter(isLive).toArray();

describe('clients and entries', () => {
  it('saves and edits entries, marking each change for upload', async () => {
    const client = await addClient({ name: 'أحمد', phone: '010', address: '' });
    const tx = await addTransaction({ clientId: client.id, type: GAVE, amount: 15000, date: '2026-11-05', note: 'سكر' });
    expect(await db.transactions.get(tx.id)).toMatchObject({ clientId: client.id, amount: 15000, deletedAt: null, dirty: 1 });

    await db.transactions.update(tx.id, { dirty: 0 }); // as if a sync uploaded it
    await updateTransaction(tx.id, { clientId: client.id, type: GOT, amount: 500, date: '2026-11-04', note: '' });
    const updated = await db.transactions.get(tx.id);
    expect(updated).toMatchObject({ type: GOT, amount: 500, date: '2026-11-04', createdAt: tx.createdAt, dirty: 1 });
    expect(updated.updatedAt >= tx.updatedAt).toBe(true);
  });

  it('keeps deleted entries as tombstones, so the deletion can sync', async () => {
    const tx = await addTransaction({ type: GOT, amount: 100, date: '2026-11-05' });
    await db.transactions.update(tx.id, { dirty: 0 });

    await deleteTransaction(tx.id);

    expect(await live(db.transactions)).toEqual([]);
    expect(await db.transactions.get(tx.id)).toMatchObject({ dirty: 1, deletedAt: expect.any(String) });
  });

  it('updates client details', async () => {
    const client = await addClient({ name: 'منى' });
    await updateClient(client.id, { name: 'منى حسن', phone: '01012345678' });
    expect(await db.clients.get(client.id)).toMatchObject({ name: 'منى حسن', phone: '01012345678', address: '' });
  });

  it('deletes a client with all of their entries, and nothing else', async () => {
    const ahmed = await addClient({ name: 'أحمد' });
    const mona = await addClient({ name: 'منى' });
    const first = await addTransaction({ clientId: ahmed.id, type: GAVE, amount: 100, date: '2026-11-05' });
    await addTransaction({ clientId: ahmed.id, type: GOT, amount: 50, date: '2026-11-05' });
    const kept = await addTransaction({ clientId: mona.id, type: GAVE, amount: 70, date: '2026-11-05' });
    const loose = await addTransaction({ type: GOT, amount: 20, date: '2026-11-05' });
    await deleteTransaction(first.id);
    const firstDeletedAt = (await db.transactions.get(first.id)).deletedAt;

    await deleteClient(ahmed.id);

    expect((await live(db.clients)).map((c) => c.id)).toEqual([mona.id]);
    expect((await live(db.transactions)).map((t) => t.id).sort()).toEqual([kept.id, loose.id].sort());
    // An entry deleted earlier keeps its own deletion time.
    expect((await db.transactions.get(first.id)).deletedAt).toBe(firstDeletedAt);
  });

  it('tells the sync about every change', async () => {
    let changes = 0;
    const stop = onLocalChange(() => {
      changes += 1;
    });
    const client = await addClient({ name: 'أحمد' });
    await updateClient(client.id, { name: 'أحمد علي' });
    await deleteClient(client.id);
    stop();
    expect(changes).toBe(3);
  });
});

describe('backup data', () => {
  it('exports only what is in the book now', async () => {
    const client = await addClient({ name: 'أحمد' });
    await addTransaction({ clientId: client.id, type: GAVE, amount: 100, date: '2026-11-05' });
    const gone = await addClient({ name: 'اتمسح' });
    await deleteClient(gone.id);
    await setSetting('shopName', 'محل الأمل');

    const backup = await exportData();

    expect(backup.clients).toEqual([
      { id: client.id, name: 'أحمد', phone: '', address: '', createdAt: client.createdAt, updatedAt: client.updatedAt },
    ]);
    expect(backup.transactions).toHaveLength(1);
    expect(backup.transactions[0]).not.toHaveProperty('dirty');
    expect(backup.settings.shopName).toBe('محل الأمل');
  });

  it('restores a backup as a new edit that wins on every device', async () => {
    const client = await addClient({ name: 'أحمد' });
    await addTransaction({ clientId: client.id, type: GAVE, amount: 100, date: '2026-11-05' });
    await setSetting('shopName', 'محل الأمل');
    const backup = await exportData();

    const extra = await addClient({ name: 'هيتمسح' });
    await updateClient(client.id, { name: 'اسم اتغيّر بعد النسخة' });
    await setSetting('shopName', 'اسم تاني');
    await db.clients.toCollection().modify({ dirty: 0 });

    await replaceAllData(backup);

    const restored = await exportData();
    expect(restored.clients.map((c) => c.name)).toEqual(['أحمد']);
    expect(restored.transactions).toHaveLength(1);
    expect(restored.settings.shopName).toBe('محل الأمل');
    expect(await db.clients.get(client.id)).toMatchObject({ dirty: 1, deletedAt: null });
    expect((await db.clients.get(client.id)).updatedAt > backup.clients[0].updatedAt).toBe(true);
    expect(await db.clients.get(extra.id)).toMatchObject({ dirty: 1, deletedAt: expect.any(String) });
  });
});

describe('upgrading a database from before syncing', () => {
  it('marks existing records for upload', async () => {
    db.close();
    await Dexie.delete('hatab');
    const old = new Dexie('hatab');
    old.version(1).stores({ clients: 'id', transactions: 'id, clientId', settings: 'key' });
    await old.clients.add({ id: 'c1', name: 'قديم', phone: '', address: '', createdAt: 'x', updatedAt: 'x' });
    await old.transactions.add({ id: 't1', clientId: 'c1', type: GAVE, amount: 5, date: '2026-01-01', note: '', createdAt: 'x', updatedAt: 'x' });
    old.close();

    await db.open();

    expect(await db.clients.where('dirty').equals(1).primaryKeys()).toEqual(['c1']);
    expect(await db.transactions.get('t1')).toMatchObject({ dirty: 1, deletedAt: null });
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

  it('imports the old data once, ready to sync, even when called twice at the same time', async () => {
    const [first, second] = await Promise.all([migrateLegacyData(legacy), migrateLegacyData(legacy)]);
    expect([first, second].filter(Boolean)).toHaveLength(1);
    expect(await db.clients.count()).toBe(1);
    expect(await db.transactions.where('dirty').equals(1).count()).toBe(1);

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
