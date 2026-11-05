import Dexie from 'dexie';

// Data lives in IndexedDB on the device: no size limit worth worrying about (unlike
// localStorage's ~5 MB), and changes made in one tab show up in the others.
//
// Every record has a random id plus createdAt/updatedAt, so syncing to a server later
// (accounts, more than one device) can be added without changing the data.
export const db = new Dexie('hatab');

db.version(1).stores({
  clients: 'id',
  transactions: 'id, clientId',
  settings: 'key',
});
