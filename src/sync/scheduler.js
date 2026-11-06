import { useSyncExternalStore } from 'react';
import { NetworkError } from './api.js';
import { getSyncSettings, runSync } from './engine.js';
import { onLocalChange } from './signals.js';

// Decides when to sync: when the app opens, a moment after every change, when the internet
// comes back, and every minute while the app is on screen. Only one sync runs at a time;
// asking during a sync runs one more right after.

const EVERY_MINUTE = 60_000;
const AFTER_A_CHANGE = 1500;

let state = { phase: 'idle', error: null, rejected: 0 };
const listeners = new Set();

function setState(next) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** { phase: 'idle' | 'syncing' | 'offline' | 'error', error, rejected } */
export function useSyncState() {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

let running = null;
let again = false;
let timer = null;

/** Syncs now (or right after the sync in progress). Never throws: errors go to the state. */
export function syncNow(options) {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      const { authToken } = await getSyncSettings();
      if (!authToken) {
        setState({ phase: 'idle', error: null, rejected: 0 });
        return;
      }
      if (globalThis.navigator?.onLine === false) {
        setState({ phase: 'offline', error: null });
        return;
      }
      setState({ phase: 'syncing', error: null });
      try {
        const result = await runSync(options);
        const rejected = (result?.rejected ?? []).filter((r) => r.reason === 'not_yours').length;
        setState({ phase: 'idle', error: null, rejected });
      } catch (error) {
        setState({ phase: error instanceof NetworkError ? 'offline' : 'error', error });
        return;
      }
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

export function requestSync(delay = 0) {
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), delay);
}

/** Starts syncing on its own. Returns a function that stops it. */
export function startAutoSync() {
  const stopListening = onLocalChange(() => requestSync(AFTER_A_CHANGE));
  const sync = () => requestSync();
  const syncIfVisible = () => {
    if (document.visibilityState === 'visible') requestSync();
  };
  window.addEventListener('online', sync);
  document.addEventListener('visibilitychange', syncIfVisible);
  const interval = setInterval(syncIfVisible, EVERY_MINUTE);
  requestSync();

  return () => {
    stopListening();
    window.removeEventListener('online', sync);
    document.removeEventListener('visibilitychange', syncIfVisible);
    clearInterval(interval);
    clearTimeout(timer);
  };
}
