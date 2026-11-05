import { toISODate } from './dates.js';
import { GAVE, GOT } from './ledger.js';
import { cleanText } from './text.js';

// The first version of HATAB kept everything in localStorage under these keys.
export const LEGACY_CLIENTS_KEY = 'client';
export const LEGACY_CASH_KEY = 'cash';

// Money that came in from a client means "خدت منه"; money that went out means "إديته".
const LEGACY_TYPES = { 'cach in': GOT, 'cash in': GOT, 'cach out': GAVE, 'cash out': GAVE };
const NO_CLIENT_NAME = 'free';

function readArray(json) {
  try {
    const value = JSON.parse(json ?? '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

/**
 * Converts the old data into the new shape. Entries are linked to clients by id now; entries
 * of clients that were deleted in the old app stay, without a client, and keep the old name
 * in their note.
 */
export function convertLegacyData(clientsJSON, cashJSON, { newId, now = new Date() }) {
  const nowISO = now.toISOString();
  const clients = [];
  const idByName = new Map();

  for (const old of readArray(clientsJSON)) {
    const name = cleanText(old?.name);
    if (!name || idByName.has(name)) continue;
    const client = {
      id: newId(),
      name,
      phone: cleanText(old.phone),
      address: cleanText(old.address),
      createdAt: nowISO,
      updatedAt: nowISO,
    };
    idByName.set(name, client.id);
    clients.push(client);
  }

  const transactions = [];
  let skipped = 0;
  for (const old of readArray(cashJSON)) {
    const type = LEGACY_TYPES[cleanText(old?.type).toLowerCase()];
    const amount = Math.round(Math.abs(Number(old?.cash)) * 100);
    if (!type || !Number.isSafeInteger(amount) || amount <= 0) {
      skipped += 1;
      continue;
    }

    const name = cleanText(old.name);
    const hasName = name !== '' && name !== NO_CLIENT_NAME;
    const clientId = hasName ? (idByName.get(name) ?? null) : null;
    const recordedAt = new Date(cleanText(old.date));
    const dateKnown = !Number.isNaN(recordedAt.getTime());
    const stamp = dateKnown ? recordedAt.toISOString() : nowISO;

    transactions.push({
      id: newId(),
      clientId,
      type,
      amount,
      date: toISODate(dateKnown ? recordedAt : now),
      note: hasName && !clientId ? `عميل قديم: ${name}` : '',
      createdAt: stamp,
      updatedAt: stamp,
    });
  }

  return { clients, transactions, skipped };
}
