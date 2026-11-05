import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { useToast } from '../components/toast.js';
import { db } from '../db/db.js';
import { migrateLegacyData } from '../db/repo.js';
import { balancesByClient, summarize } from '../domain/ledger.js';
import { CLIENT_WORDS, countAr, TX_WORDS } from '../domain/text.js';
import { LedgerContext } from './LedgerContext.js';

// Shared by both StrictMode effect runs, so the "we moved your data" message shows once.
let legacyImport;
const importLegacyDataOnce = () => {
  legacyImport ??= migrateLegacyData();
  return legacyImport;
};

export default function LedgerProvider({ children }) {
  const toast = useToast();
  const [booted, setBooted] = useState(false);
  const [storageError, setStorageError] = useState(null);

  // When the browser refuses on-device storage, the live queries below just wait forever.
  // Opening the database up front turns that into an error ErrorBoundary can explain.
  useEffect(() => {
    let active = true;
    db.open().catch((error) => {
      if (active) setStorageError(error);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    importLegacyDataOnce()
      .then((imported) => {
        if (!active || !imported) return;
        const { clients, transactions } = imported;
        if (clients.length === 0 && transactions.length === 0) return;
        const parts = [
          clients.length && countAr(clients.length, CLIENT_WORDS),
          transactions.length && countAr(transactions.length, TX_WORDS),
        ].filter(Boolean);
        toast(`نقلنا بياناتك من النسخة القديمة: ${parts.join(' و')}.`, { duration: 6000 });
      })
      .catch((error) => console.error('Could not import the old data', error))
      .finally(() => {
        if (active) setBooted(true);
      });
    return () => {
      active = false;
    };
  }, [toast]);

  const clients = useLiveQuery(() => db.clients.toArray(), []);
  const transactions = useLiveQuery(() => db.transactions.toArray(), []);
  const settingsRows = useLiveQuery(() => db.settings.toArray(), []);

  const value = useMemo(() => {
    if (!booted || !clients || !transactions || !settingsRows) return { ready: false };
    const balances = balancesByClient(transactions);
    return {
      ready: true,
      clients,
      transactions,
      settings: Object.fromEntries(settingsRows.map((row) => [row.key, row.value])),
      clientsById: new Map(clients.map((client) => [client.id, client])),
      balances,
      summary: summarize(clients, balances),
    };
  }, [booted, clients, transactions, settingsRows]);

  if (storageError) throw storageError;
  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}
