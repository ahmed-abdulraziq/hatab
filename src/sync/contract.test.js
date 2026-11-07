// @vitest-environment node
//
// Runs the app's sync engine against the real Laravel API (api/). Skipped unless
// HATAB_API_URL points at a running API; .github/workflows/api.yml starts one and runs this.

import { beforeEach, describe, expect, it } from 'vitest';
import { db, isLive } from '../db/db.js';
import { addClient, addTransaction, deleteTransaction, setSetting, updateClient } from '../db/repo.js';
import { GAVE, GOT } from '../domain/ledger.js';
import { ApiError } from './api.js';
import { countPending, getSyncSettings, pushProfile, runSync, signIn, signOut } from './engine.js';

const API = globalThis.process?.env.HATAB_API_URL;
const email = `contract-${Date.now()}@example.com`;
const password = 'secret-pass';

const withoutSyncFields = ({ dirty, ...record }) => record; // eslint-disable-line no-unused-vars
const snapshot = async () => ({
  clients: (await db.clients.toArray()).map(withoutSyncFields).sort((a, b) => a.id.localeCompare(b.id)),
  transactions: (await db.transactions.toArray()).map(withoutSyncFields).sort((a, b) => a.id.localeCompare(b.id)),
});
const newDevice = () => Promise.all(db.tables.map((table) => table.clear()));

describe.skipIf(!API)('the real API', () => {
  beforeEach(newDevice);

  it('syncs a book between two devices, edits and deletions included', async () => {
    // Device 1: a book made before logging in, then an account.
    await setSetting('shopName', 'بقالة الأمل');
    const client = await addClient({ name: 'أحمد علي', phone: '01012345678', address: 'شبرا' });
    await addTransaction({ clientId: client.id, type: GAVE, amount: 15050, date: '2026-11-05', note: '2 كيلو سكر' });
    const cash = await addTransaction({ type: GOT, amount: 100, date: '2026-11-05' });
    const { user } = await signIn({ mode: 'register', serverUrl: API, name: 'أحمد', email, password });
    expect(user).toMatchObject({ name: 'أحمد', email });

    expect(await runSync()).toEqual({ rejected: [] });
    expect(await countPending()).toBe(0);

    await updateClient(client.id, { name: 'أحمد علي حسن', phone: '01012345678', address: 'شبرا' });
    await deleteTransaction(cash.id);
    await runSync();
    const deviceOne = await snapshot();

    // Device 2: logs in and gets exactly the same book.
    await newDevice();
    await signIn({ mode: 'login', serverUrl: API, email, password });
    await runSync();

    expect(await snapshot()).toEqual(deviceOne);
    expect((await db.clients.filter(isLive).toArray()).map((c) => c.name)).toEqual(['أحمد علي حسن']);
    expect(await db.transactions.filter(isLive).count()).toBe(1);
    expect((await db.settings.get('shopName')).value).toBe('بقالة الأمل');
  });

  it('keeps the profile on the account', async () => {
    await signIn({ mode: 'login', serverUrl: API, email, password });
    expect(await pushProfile({ shopName: 'محل جديد' })).toMatchObject({ shopName: 'محل جديد' });
  });

  it('refuses a wrong password in Arabic, and a logged-out token', async () => {
    const error = await signIn({ mode: 'login', serverUrl: API, email, password: 'wrong-password' }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.errors.email).toEqual(['البريد الإلكتروني أو كلمة السر مش صح.']);

    await signIn({ mode: 'login', serverUrl: API, email, password });
    const { authToken } = await getSyncSettings();
    await signOut();
    await setSetting('authToken', authToken); // pretend this device kept the old token
    await expect(runSync()).rejects.toMatchObject({ status: 401 });
  });
});
