import { createContext, useContext } from 'react';

export const ConfirmContext = createContext(null);

/**
 * Returns confirm({ title, message, confirmLabel, danger }) → Promise<boolean>.
 * Used before anything that deletes data.
 */
export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return confirm;
}
