import { exportData, setSetting } from './db/repo.js';
import { createBackup, exportFileName } from './domain/backup.js';
import { daysSince } from './domain/dates.js';
import { downloadFile } from './files.js';

async function backupFile() {
  const json = JSON.stringify(createBackup(await exportData()), null, 2);
  return new File([json], exportFileName('backup', 'json'), { type: 'application/json' });
}

const markBackedUp = () => setSetting('lastBackupAt', new Date().toISOString());

export async function downloadBackup() {
  downloadFile(await backupFile());
  await markBackedUp();
}

/** Opens the share sheet with the backup file. Resolves to false if the user closed it. */
export async function shareBackup() {
  const file = await backupFile();
  try {
    await navigator.share({ files: [file], title: 'نسخة احتياطية من HATAB' });
  } catch (error) {
    if (error?.name === 'AbortError') return false;
    throw error;
  }
  await markBackedUp();
  return true;
}

export const BACKUP_EVERY_DAYS = 7;
const SNOOZE_DAYS = 3;

/**
 * Whether to remind the user to back up: a week after their last backup (or after they
 * started, if they never made one), unless they tapped "بعدين" in the last few days.
 */
export function needsBackupReminder({ settings, clients, transactions }, now = new Date()) {
  if (clients.length === 0 && transactions.length === 0) return false;
  const snoozed = settings.backupSnoozedAt ? daysSince(settings.backupSnoozedAt, now) : null;
  if (snoozed !== null && snoozed < SNOOZE_DAYS) return false;

  let since = settings.lastBackupAt;
  if (!since) {
    for (const record of [...clients, ...transactions]) {
      if (record.createdAt && (!since || record.createdAt < since)) since = record.createdAt;
    }
  }
  const days = since ? daysSince(since, now) : null;
  return days === null || days >= BACKUP_EVERY_DAYS;
}

export const snoozeBackupReminder = () => setSetting('backupSnoozedAt', new Date().toISOString());
