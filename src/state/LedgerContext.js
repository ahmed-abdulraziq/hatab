import { createContext, useContext } from 'react';

export const LedgerContext = createContext(null);

/**
 * Live data for the screens: { ready, clients, transactions, settings, clientsById,
 * balances, summary }. Updates by itself whenever the database changes.
 */
export function useLedger() {
  const value = useContext(LedgerContext);
  if (!value) throw new Error('useLedger must be used inside <LedgerProvider>');
  return value;
}
