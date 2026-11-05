import { createContext, useContext } from 'react';

export const ToastContext = createContext(null);

/** Returns toast(message, { tone: 'info' | 'error' }) for short messages at the bottom. */
export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error('useToast must be used inside <ToastProvider>');
  return toast;
}
