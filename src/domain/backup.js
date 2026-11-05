import { isISODate, toISODate } from './dates.js';
import { compareChronological, GAVE, TX_TYPES, txLabel } from './ledger.js';
import { cleanText } from './text.js';

export const BACKUP_APP = 'hatab';
export const BACKUP_VERSION = 1;

/** An error whose message can be shown to the user as is. */
export class BackupError extends Error {
  name = 'BackupError';
}

export function createBackup({ clients, transactions, settings = {} }, now = new Date()) {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    settings: { shopName: settings.shopName ?? '' },
    clients,
    transactions,
  };
}

/** "hatab-backup-2026-11-05.json" */
export function exportFileName(kind, extension, now = new Date()) {
  return `hatab-${kind}-${toISODate(now)}.${extension}`;
}

const isText = (value) => typeof value === 'string';
const notHatab = () => new BackupError('الملف ده مش نسخة احتياطية من HATAB.');
const broken = () => new BackupError('الملف فيه بيانات بايظة، ومينفعش نرجّع منه.');

/**
 * Reads the text of a backup file and returns { clients, transactions, settings }.
 * Throws BackupError when the file can't be trusted, so nothing gets half-restored.
 */
export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw notHatab();
  }
  if (!data || data.app !== BACKUP_APP || !Array.isArray(data.clients) || !Array.isArray(data.transactions)) {
    throw notHatab();
  }
  if (!Number.isInteger(data.version) || data.version < 1) throw notHatab();
  if (data.version > BACKUP_VERSION) {
    throw new BackupError('النسخة دي معمولة من إصدار أحدث من البرنامج. حدّث البرنامج الأول.');
  }

  const now = new Date().toISOString();
  const clientIds = new Set();
  const clients = data.clients.map((client) => {
    const name = cleanText(client?.name);
    if (!isText(client?.id) || !client.id || clientIds.has(client.id) || !name) throw broken();
    clientIds.add(client.id);
    return {
      id: client.id,
      name,
      phone: isText(client.phone) ? client.phone : '',
      address: isText(client.address) ? client.address : '',
      createdAt: isText(client.createdAt) ? client.createdAt : now,
      updatedAt: isText(client.updatedAt) ? client.updatedAt : now,
    };
  });

  const entryIds = new Set();
  const transactions = data.transactions.map((tx) => {
    const clientId = tx?.clientId ?? null;
    const valid =
      isText(tx?.id) &&
      tx.id &&
      !entryIds.has(tx.id) &&
      TX_TYPES.includes(tx.type) &&
      Number.isSafeInteger(tx.amount) &&
      tx.amount > 0 &&
      isISODate(tx.date) &&
      (clientId === null || clientIds.has(clientId));
    if (!valid) throw broken();
    entryIds.add(tx.id);
    return {
      id: tx.id,
      clientId,
      type: tx.type,
      amount: tx.amount,
      date: tx.date,
      note: isText(tx.note) ? tx.note : '',
      createdAt: isText(tx.createdAt) ? tx.createdAt : now,
      updatedAt: isText(tx.updatedAt) ? tx.updatedAt : now,
    };
  });

  return {
    clients,
    transactions,
    settings: { shopName: isText(data.settings?.shopName) ? data.settings.shopName : '' },
  };
}

// Spreadsheet apps run cells that start with these characters as formulas.
const FORMULA_START = /^[=+\-@\t\r]/;

function csvCell(value) {
  let text = String(value ?? '');
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const decimal = (piasters) => (piasters / 100).toFixed(2);

/** All entries as CSV that Excel and Google Sheets open with Arabic intact. */
export function transactionsToCSV(transactions, clientsById) {
  const header = ['التاريخ', 'العميل', 'النوع', 'إديت (خرج)', 'خدت (دخل)', 'ملاحظة'];
  const rows = [...transactions].sort(compareChronological).map((tx) => [
    tx.date,
    tx.clientId ? (clientsById.get(tx.clientId)?.name ?? '') : 'بدون عميل',
    txLabel(tx),
    tx.type === GAVE ? decimal(tx.amount) : '',
    tx.type === GAVE ? '' : decimal(tx.amount),
    tx.note,
  ]);
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(','));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
