import { newId } from '../domain/ids.js';
import { convertLegacyData, LEGACY_CASH_KEY, LEGACY_CLIENTS_KEY } from '../domain/legacy.js';
import { localChange } from '../sync/signals.js';
import { db, isLive } from './db.js';

// The only module that writes clients, entries and settings (the sync engine in src/sync
// applies changes that come from the server). Inputs are already validated by the forms
// (see domain/validation.js). Every write marks the record `dirty`, so the next sync
// uploads it.

const timestamp = () => new Date().toISOString();

function changed() {
  requestPersistentStorage();
  localChange();
}

export async function addClient({ name, phone = '', address = '' }) {
  const now = timestamp();
  const client = { id: newId(), name, phone, address, createdAt: now, updatedAt: now, deletedAt: null, dirty: 1 };
  await db.clients.add(client);
  changed();
  return client;
}

export async function updateClient(id, { name, phone = '', address = '' }) {
  await db.clients.update(id, { name, phone, address, updatedAt: timestamp(), dirty: 1 });
  changed();
}

/** Deletes the client together with all of their entries. */
export async function deleteClient(id) {
  const gone = { deletedAt: timestamp(), updatedAt: timestamp(), dirty: 1 };
  await db.transaction('rw', db.clients, db.transactions, async () => {
    await db.transactions.where('clientId').equals(id).filter(isLive).modify(gone);
    await db.clients.update(id, gone);
  });
  changed();
}

export async function addTransaction({ clientId = null, type, amount, date, note = '' }) {
  const now = timestamp();
  const tx = { id: newId(), clientId, type, amount, date, note, createdAt: now, updatedAt: now, deletedAt: null, dirty: 1 };
  await db.transactions.add(tx);
  changed();
  return tx;
}

export async function updateTransaction(id, { clientId = null, type, amount, date, note = '' }) {
  await db.transactions.update(id, { clientId, type, amount, date, note, updatedAt: timestamp(), dirty: 1 });
  changed();
}

export async function deleteTransaction(id) {
  const now = timestamp();
  await db.transactions.update(id, { deletedAt: now, updatedAt: now, dirty: 1 });
  changed();
}

export async function setSetting(key, value) {
  await db.settings.put({ key, value });
}

export async function setSettings(values) {
  await db.settings.bulkPut(Object.entries(values).map(([key, value]) => ({ key, value })));
}

const clientFields = ({ id, name, phone, address, createdAt, updatedAt }) => ({ id, name, phone, address, createdAt, updatedAt });
const transactionFields = ({ id, clientId, type, amount, date, note, createdAt, updatedAt }) => ({
  id,
  clientId,
  type,
  amount,
  date,
  note,
  createdAt,
  updatedAt,
});

/** The book as it is now (no deleted records), for a backup file. */
export async function exportData() {
  return db.transaction('r', db.clients, db.transactions, db.settings, async () => {
    const clients = (await db.clients.filter(isLive).toArray()).map(clientFields);
    const transactions = (await db.transactions.filter(isLive).toArray()).map(transactionFields);
    const rows = await db.settings.toArray();
    return { clients, transactions, settings: Object.fromEntries(rows.map((row) => [row.key, row.value])) };
  });
}

/**
 * Makes the book exactly what a backup (checked by parseBackup) contains. Restoring counts
 * as a new edit: records missing from the backup are deleted and the backup's records are
 * stamped with the current time, so the restore also wins on the owner's other devices.
 */
export async function replaceAllData({ clients, transactions, settings }) {
  const now = timestamp();
  await db.transaction('rw', db.clients, db.transactions, db.settings, async () => {
    for (const [table, records] of [
      [db.clients, clients],
      [db.transactions, transactions],
    ]) {
      const keep = new Set(records.map((record) => record.id));
      await table
        .filter((record) => isLive(record) && !keep.has(record.id))
        .modify({ deletedAt: now, updatedAt: now, dirty: 1 });
      await table.bulkPut(records.map((record) => ({ ...record, updatedAt: now, deletedAt: null, dirty: 1 })));
    }
    await db.settings.put({ key: 'shopName', value: settings?.shopName ?? '' });
  });
  changed();
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
      const fresh = (record) => ({ ...record, deletedAt: null, dirty: 1 });
      await db.clients.bulkAdd(imported.clients.map(fresh));
      await db.transactions.bulkAdd(imported.transactions.map(fresh));
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
