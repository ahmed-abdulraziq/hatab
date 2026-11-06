import Dexie from 'dexie';

// Data lives in IndexedDB on the device: no size limit worth worrying about (unlike
// localStorage's ~5 MB), and changes made in one tab show up in the others.
//
// Every record has a random id plus createdAt/updatedAt, and two fields for syncing with
// the account on the server (see src/sync):
//   - deletedAt: deleting keeps the record as a "tombstone", so the deletion can reach the
//     owner's other devices. Screens never see tombstones.
//   - dirty: 1 while the record has changes the server hasn't received yet.
export const db = new Dexie('hatab');

db.version(1).stores({
  clients: 'id',
  transactions: 'id, clientId',
  settings: 'key',
});

db.version(2)
  .stores({
    clients: 'id, dirty',
    transactions: 'id, clientId, dirty',
    settings: 'key',
  })
  .upgrade(async (tx) => {
    // Everything made before syncing existed gets uploaded on the first sync.
    const markForUpload = (record) => {
      record.deletedAt ??= null;
      record.dirty = 1;
    };
    await tx.table('clients').toCollection().modify(markForUpload);
    await tx.table('transactions').toCollection().modify(markForUpload);
  });

/** Only records that weren't deleted. */
export const isLive = (record) => !record.deletedAt;
