import { db } from '../db/db.js';
import { setSetting, setSettings } from '../db/repo.js';
import { ApiError, apiRequest, normalizeServerUrl } from './api.js';

// Two-way sync with the owner's account (see api/README.md for the rules):
//   1. Upload the records marked `dirty` on this device.
//   2. Get every change the server has after the last change number this device saw
//      (`syncRevision`), and apply it unless this device has a newer edit of that record.
// Both happen in the same request, repeated until nothing is left on either side.

/** Records per request, the server's limit. */
export const PAGE = 500;
const MAX_ROUNDS = 50;

const SYNC_KEYS = ['serverUrl', 'authToken', 'account', 'syncRevision', 'syncedAccountId'];

export async function getSyncSettings() {
  const rows = await db.settings.bulkGet(SYNC_KEYS);
  return Object.fromEntries(SYNC_KEYS.map((key, i) => [key, rows[i]?.value ?? null]));
}

// The server limits text lengths; old data imported from the first version could be longer.
const clientToWire = (c) => ({
  id: c.id,
  name: String(c.name).slice(0, 80),
  phone: String(c.phone ?? '').slice(0, 40),
  address: String(c.address ?? '').slice(0, 200),
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
  deletedAt: c.deletedAt ?? null,
});

const transactionToWire = (t) => ({
  id: t.id,
  clientId: t.clientId ?? null,
  type: t.type,
  amount: t.amount,
  date: t.date,
  note: String(t.note ?? '').slice(0, 200),
  createdAt: t.createdAt,
  updatedAt: t.updatedAt,
  deletedAt: t.deletedAt ?? null,
});

/** Marks what the server accepted as uploaded, unless it changed again in the meantime. */
async function settle(table, sent, keepDirty) {
  const current = await table.bulkGet(sent.map((record) => record.id));
  const done = sent.filter((record, i) => !keepDirty.has(record.id) && current[i]?.updatedAt === record.updatedAt);
  await Promise.all(done.map((record) => table.update(record.id, { dirty: 0 })));
}

/** Applies the server's records, except where this device has a newer edit (it goes up next). */
async function merge(table, incoming) {
  if (incoming.length === 0) return;
  const current = await table.bulkGet(incoming.map((record) => record.id));
  const newer = incoming.filter((remote, i) => !current[i] || current[i].updatedAt <= remote.updatedAt);
  await table.bulkPut(newer.map((remote) => ({ ...remote, dirty: 0 })));
}

async function applyResult(result, sentClients, sentTransactions) {
  // An entry whose client the server doesn't know yet is tried again next time; records that
  // belong to another account never will be accepted, so they stop being uploaded.
  const keepDirty = new Set(result.rejected.filter((r) => r.reason === 'unknown_client').map((r) => r.id));
  await db.transaction('rw', db.clients, db.transactions, db.settings, async () => {
    await settle(db.clients, sentClients, keepDirty);
    await settle(db.transactions, sentTransactions, keepDirty);
    await merge(db.clients, result.clients);
    await merge(db.transactions, result.transactions);
    await db.settings.put({ key: 'syncRevision', value: result.revision });
  });
}

/**
 * Syncs once, all the way. Returns null when not logged in, otherwise
 * { rejected } with the records the server refused. Throws ApiError or NetworkError; a 401
 * also logs this device out (the book stays on it).
 */
export async function runSync({ fetchImpl } = {}) {
  const { serverUrl, authToken, syncRevision } = await getSyncSettings();
  if (!serverUrl || !authToken) return null;

  let since = syncRevision ?? 0;
  const rejected = [];
  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const clients = await db.clients.where('dirty').equals(1).limit(PAGE).toArray();
      // Entries go up only after all clients have, so the server knows who they belong to.
      const transactions =
        clients.length < PAGE ? await db.transactions.where('dirty').equals(1).limit(PAGE).toArray() : [];

      const result = await apiRequest(serverUrl, '/sync', {
        method: 'POST',
        token: authToken,
        fetchImpl,
        body: {
          since,
          clients: clients.map(clientToWire),
          transactions: transactions.map(transactionToWire),
        },
      });
      await applyResult(result, clients, transactions);
      rejected.push(...result.rejected);
      since = result.revision;

      const moreToSend = clients.length === PAGE || transactions.length === PAGE;
      if (!result.hasMore && !moreToSend) break;
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) await forgetLogin();
    throw error;
  }

  await setSetting('lastSyncAt', new Date().toISOString());
  return { rejected };
}

/** How many changes on this device the server hasn't received yet. */
export async function countPending() {
  const [clients, transactions] = await Promise.all([
    db.clients.where('dirty').equals(1).count(),
    db.transactions.where('dirty').equals(1).count(),
  ]);
  return clients + transactions;
}

export function deviceName(userAgent = globalThis.navigator?.userAgent ?? '') {
  for (const [pattern, name] of [
    [/iPhone/i, 'iPhone'],
    [/iPad/i, 'iPad'],
    [/Android/i, 'Android'],
    [/Windows/i, 'Windows'],
    [/Mac OS X|Macintosh/i, 'Mac'],
    [/Linux/i, 'Linux'],
  ]) {
    if (pattern.test(userAgent)) return name;
  }
  return 'متصفح';
}

/**
 * Logs in (mode "login") or creates the account (mode "register") and keeps the token.
 * The first sync after this uploads the book on this device and downloads the account's.
 * If the book here was synced with a different account before, it's cleared first, so two
 * accounts' books never mix. Returns { user, replacedBook }.
 */
export async function signIn({ mode, serverUrl, name, email, password, fetchImpl }) {
  const url = normalizeServerUrl(serverUrl);
  const body = { email, password, device: deviceName() };
  if (mode === 'register') body.name = name;
  const { token, user } = await apiRequest(url, mode === 'register' ? '/register' : '/login', {
    method: 'POST',
    body,
    fetchImpl,
  });

  const { syncedAccountId } = await getSyncSettings();
  const replacedBook = syncedAccountId !== null && syncedAccountId !== user.id;
  const localShopName = (await db.settings.get('shopName'))?.value ?? '';

  await db.transaction('rw', db.clients, db.transactions, db.settings, async () => {
    if (replacedBook) {
      await db.clients.clear();
      await db.transactions.clear();
    }
    await setSettings({
      serverUrl: url,
      authToken: token,
      account: user,
      syncedAccountId: user.id,
      syncRevision: 0,
      lastSyncAt: null,
      ...(replacedBook || !localShopName ? { shopName: user.shopName ?? '' } : {}),
    });
  });

  // The shop name typed on this device before logging in goes to the account.
  if (!replacedBook && localShopName && localShopName !== user.shopName) {
    await pushProfile({ shopName: localShopName }, { fetchImpl }).catch(() => {});
  }
  return { user, replacedBook };
}

/** Logs this device out. The book stays here and keeps working offline. */
export async function signOut({ fetchImpl } = {}) {
  const { serverUrl, authToken } = await getSyncSettings();
  if (serverUrl && authToken) {
    await apiRequest(serverUrl, '/logout', { method: 'POST', token: authToken, fetchImpl }).catch(() => {});
  }
  await forgetLogin();
}

async function forgetLogin() {
  await setSettings({ authToken: null, account: null, syncRevision: 0, lastSyncAt: null });
}

/** Saves profile changes ({ name, shopName }) to the account, when logged in. */
export async function pushProfile(changes, { fetchImpl } = {}) {
  const { serverUrl, authToken } = await getSyncSettings();
  if (!serverUrl || !authToken) return null;
  const { user } = await apiRequest(serverUrl, '/me', { method: 'PATCH', token: authToken, body: changes, fetchImpl });
  await setSetting('account', user);
  return user;
}
