import { beforeEach, describe, expect, it } from 'vitest';
import { db, isLive } from '../db/db.js';
import { addClient, addTransaction, deleteClient, setSetting, updateClient } from '../db/repo.js';
import { GAVE } from '../domain/ledger.js';
import { createFakeServer, SERVER } from '../test/fakeServer.js';
import { ApiError, NetworkError } from './api.js';
import { countPending, getSyncSettings, runSync, signIn, signOut } from './engine.js';

let server;

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  server = createFakeServer();
});

const account = (mode = 'register', email = 'ahmed@example.com') =>
  signIn({ mode, serverUrl: `${SERVER}/`, name: 'أحمد', email, password: 'secret-pass', fetchImpl: server.fetch });
const sync = () => runSync({ fetchImpl: server.fetch });
const live = (table) => table.filter(isLive).toArray();

/** Forgets everything on this device, like opening the app on a new phone. */
async function newDevice() {
  await Promise.all(db.tables.map((table) => table.clear()));
}

describe('syncing the book', () => {
  it('uploads the book that was on the device before logging in', async () => {
    const client = await addClient({ name: 'أحمد علي', phone: '010' });
    await addTransaction({ clientId: client.id, type: GAVE, amount: 15000, date: '2026-11-05', note: 'سكر' });
    expect(await countPending()).toBe(2);

    await account();
    expect(await sync()).toEqual({ rejected: [] });

    expect(server.clients.get(client.id).record).toMatchObject({ name: 'أحمد علي', phone: '010', deletedAt: null });
    expect(server.transactions.size).toBe(1);
    expect(await countPending()).toBe(0);
    const settings = await getSyncSettings();
    expect(settings.syncRevision).toBe(2);
    expect(settings.serverUrl).toBe(SERVER);
    expect((await db.settings.get('lastSyncAt')).value).toEqual(expect.any(String));
  });

  it('brings the account’s book to a new device', async () => {
    await account();
    const client = await addClient({ name: 'منى' });
    await addTransaction({ clientId: client.id, type: GAVE, amount: 500, date: '2026-11-05' });
    await sync();

    await newDevice();
    await account('login');
    await sync();

    expect((await live(db.clients)).map((c) => c.name)).toEqual(['منى']);
    expect(await live(db.transactions)).toHaveLength(1);
    expect(await countPending()).toBe(0);
  });

  it('sends deletions to the other devices, and receives theirs', async () => {
    await account();
    const kept = await addClient({ name: 'هيفضل' });
    const gone = await addClient({ name: 'هيتمسح' });
    await sync();

    await deleteClient(gone.id);
    await sync();
    expect(server.clients.get(gone.id).record.deletedAt).toEqual(expect.any(String));

    // Another device deletes the other client.
    const phone = await server.otherDevice('ahmed@example.com');
    const deletedAt = new Date(Date.now() + 1000).toISOString();
    await phone({ clients: [{ ...server.clients.get(kept.id).record, updatedAt: deletedAt, deletedAt }] });
    await sync();

    expect(await live(db.clients)).toEqual([]);
  });

  it('keeps the newest edit, whichever device made it', async () => {
    await account();
    const client = await addClient({ name: 'الاسم الأول' });
    await sync();
    const phone = await server.otherDevice('ahmed@example.com');
    const at = (ms) => new Date(Date.parse(client.updatedAt) + ms).toISOString();

    // A newer edit from the other device replaces this device's copy.
    await phone({ clients: [{ ...server.clients.get(client.id).record, name: 'من الموبايل', updatedAt: at(1000) }] });
    await sync();
    expect((await db.clients.get(client.id)).name).toBe('من الموبايل');

    // An edit made here later wins over an older one that arrives afterwards.
    await db.clients.update(client.id, { name: 'من هنا', updatedAt: at(3000), dirty: 1 });
    await phone({ clients: [{ ...server.clients.get(client.id).record, name: 'قديم', updatedAt: at(2000) }] });
    await sync();
    expect((await db.clients.get(client.id)).name).toBe('من هنا');
    expect(server.clients.get(client.id).record.name).toBe('من هنا');
  });

  it('downloads long histories page by page', async () => {
    server = createFakeServer({ pageLimit: 2 });
    await account();
    const phone = await server.otherDevice('ahmed@example.com');
    const now = new Date().toISOString();
    const records = Array.from({ length: 5 }, (_, i) => ({
      id: crypto.randomUUID(),
      name: `عميل ${i + 1}`,
      phone: '',
      address: '',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }));
    await phone({ clients: records });

    await sync();

    expect(await db.clients.count()).toBe(5);
    expect(server.calls.filter((call) => call.path === '/sync').length).toBeGreaterThanOrEqual(4);
    expect((await getSyncSettings()).syncRevision).toBe(5);
  });

  it('keeps changes made offline and sends them when the server is back', async () => {
    await account();
    await addClient({ name: 'من غير نت' });
    server.setOnline(false);

    await expect(sync()).rejects.toBeInstanceOf(NetworkError);
    expect(await countPending()).toBe(1);

    server.setOnline(true);
    await sync();
    expect(await countPending()).toBe(0);
  });

  it('stops uploading records of another account, and retries entries whose client is missing', async () => {
    // Someone else's account already has this client id.
    await account('register', 'mona@example.com');
    const theirs = await addClient({ name: 'عميل منى' });
    await sync();
    await signOut({ fetchImpl: server.fetch });

    await newDevice();
    await account('register', 'ahmed@example.com');
    const now = new Date().toISOString();
    await db.clients.add({ ...theirs, updatedAt: now, dirty: 1 });
    await db.transactions.add({
      id: crypto.randomUUID(),
      clientId: crypto.randomUUID(),
      type: GAVE,
      amount: 100,
      date: '2026-11-05',
      note: '',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      dirty: 1,
    });

    const { rejected } = await sync();

    expect(rejected.map((r) => r.reason).sort()).toEqual(['not_yours', 'unknown_client']);
    expect((await db.clients.get(theirs.id)).dirty).toBe(0);
    expect(await db.transactions.where('dirty').equals(1).count()).toBe(1);
    expect(server.clients.get(theirs.id).record.name).toBe('عميل منى');
  });
});

describe('the account', () => {
  it('logs the device out when the server no longer accepts its token, and keeps the book', async () => {
    await account();
    await addClient({ name: 'أحمد' });
    server.tokens.clear();

    await expect(sync()).rejects.toMatchObject({ status: 401 });

    expect((await getSyncSettings()).authToken).toBeNull();
    expect(await live(db.clients)).toHaveLength(1);
  });

  it('shows the server’s reason when logging in fails', async () => {
    const error = await signIn({
      mode: 'login',
      serverUrl: SERVER,
      email: 'nobody@example.com',
      password: 'x',
      fetchImpl: server.fetch,
    }).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.errors.email).toEqual(['البريد الإلكتروني أو كلمة السر مش صح.']);
    expect((await getSyncSettings()).authToken).toBeNull();
  });

  it('logs out on the server too, and keeps the book on the device', async () => {
    await account();
    await addClient({ name: 'أحمد' });
    await signOut({ fetchImpl: server.fetch });

    expect(server.tokens.size).toBe(0);
    expect((await getSyncSettings()).authToken).toBeNull();
    expect(await live(db.clients)).toHaveLength(1);
  });

  it('never mixes two accounts’ books on one device', async () => {
    await account('register', 'ahmed@example.com');
    const ahmeds = await addClient({ name: 'عميل أحمد' });
    await sync();
    await signOut({ fetchImpl: server.fetch });

    const { replacedBook } = await account('register', 'mona@example.com');
    expect(replacedBook).toBe(true);
    expect(await db.clients.count()).toBe(0);
    await signOut({ fetchImpl: server.fetch });

    // Back to the first account: its book comes back from the server.
    await account('login', 'ahmed@example.com');
    await sync();
    expect((await live(db.clients)).map((c) => c.id)).toEqual([ahmeds.id]);
  });

  it('logging back into the same account keeps the book and its unsynced changes', async () => {
    await account();
    const client = await addClient({ name: 'قبل الخروج' });
    await sync();
    await signOut({ fetchImpl: server.fetch });
    await updateClient(client.id, { name: 'اتعدّل وأنا خارج' });

    const { replacedBook } = await account('login');
    await sync();

    expect(replacedBook).toBe(false);
    expect(server.clients.get(client.id).record.name).toBe('اتعدّل وأنا خارج');
  });

  it('takes the shop name typed before logging in to the account', async () => {
    await setSetting('shopName', 'بقالة الأمل');
    await account();
    expect(server.users[0].shopName).toBe('بقالة الأمل');
  });
});
