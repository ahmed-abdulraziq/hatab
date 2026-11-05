import { newId } from '../domain/ids.js';
import { convertLegacyData, LEGACY_CASH_KEY, LEGACY_CLIENTS_KEY } from '../domain/legacy.js';
import { db } from './db.js';

// The only module that writes to the database. Inputs are already validated by the forms
// (see domain/validation.js).

const timestamp = () => new Date().toISOString();

export async function addClient({ name, phone = '', address = '' }) {
  const now = timestamp();
  const client = { id: newId(), name, phone, address, createdAt: now, updatedAt: now };
  await db.clients.add(client);
  requestPersistentStorage();
  return client;
}

export async function updateClient(id, { name, phone = '', address = '' }) {
  await db.clients.update(id, { name, phone, address, updatedAt: timestamp() });
}

/** Deletes the client together with all of their entries. */
export async function deleteClient(id) {
  await db.transaction('rw', db.clients, db.transactions, async () => {
    await db.transactions.where('clientId').equals(id).delete();
    await db.clients.delete(id);
  });
}

export async function addTransaction({ clientId = null, type, amount, date, note = '' }) {
  const now = timestamp();
  const tx = { id: newId(), clientId, type, amount, date, note, createdAt: now, updatedAt: now };
  await db.transactions.add(tx);
  requestPersistentStorage();
  return tx;
}

export async function updateTransaction(id, { clientId = null, type, amount, date, note = '' }) {
  await db.transactions.update(id, { clientId, type, amount, date, note, updatedAt: timestamp() });
}

export async function deleteTransaction(id) {
  await db.transactions.delete(id);
}

export async function setSetting(key, value) {
  await db.settings.put({ key, value });
}

/** Everything, for a backup file. */
export async function exportData() {
  return db.transaction('r', db.clients, db.transactions, db.settings, async () => {
    const clients = await db.clients.toArray();
    const transactions = await db.transactions.toArray();
    const rows = await db.settings.toArray();
    return { clients, transactions, settings: Object.fromEntries(rows.map((row) => [row.key, row.value])) };
  });
}

/** Replaces all clients and entries with the contents of a backup checked by parseBackup. */
export async function replaceAllData({ clients, transactions, settings }) {
  await db.transaction('rw', db.clients, db.transactions, db.settings, async () => {
    await db.transactions.clear();
    await db.clients.clear();
    await db.clients.bulkAdd(clients);
    await db.transactions.bulkAdd(transactions);
    await db.settings.put({ key: 'shopName', value: settings?.shopName ?? '' });
  });
}

/**
 * Imports what the first version of the app saved in localStorage, once, and only into an
 * empty database. The old keys are left in place. Returns the imported data, or null.
 */
export async function migrateLegacyData(storage = globalThis.localStorage) {
  const oldClients = storage?.getItem(LEGACY_CLIENTS_KEY) ?? null;
  const oldCash = storage?.getItem(LEGACY_CASH_KEY) ?? null;
  if (oldClients === null && oldCash === null) return null;

  // Read-write transactions on the same tables run one after another, so even if this is
  // called twice at once (React StrictMode), only the first call imports anything.
  return db.transaction('rw', db.clients, db.transactions, db.settings, async () => {
    if ((await db.settings.get('legacyImported'))?.value) return null;
    const isEmpty = (await db.clients.count()) === 0 && (await db.transactions.count()) === 0;
    let imported = null;
    if (isEmpty) {
      imported = convertLegacyData(oldClients, oldCash, { newId });
      await db.clients.bulkAdd(imported.clients);
      await db.transactions.bulkAdd(imported.transactions);
    }
    await db.settings.put({ key: 'legacyImported', value: true });
    return imported;
  });
}

let persistenceRequested = false;

/**
 * Asks the browser not to clear our data when the device runs low on space. Called after
 * the first save, when the request makes sense to the user (Firefox shows a prompt).
 */
export function requestPersistentStorage() {
  if (persistenceRequested) return;
  persistenceRequested = true;
  globalThis.navigator?.storage?.persist?.().catch(() => {});
}

/** true, false, or null when the browser can't tell. */
export async function isStoragePersisted() {
  try {
    return (await globalThis.navigator?.storage?.persisted?.()) ?? null;
  } catch {
    return null;
  }
}
