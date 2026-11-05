import { useEffect, useMemo, useState } from 'react';

// Routes live in the URL hash (#/client/<id>), so the app works on any static host and
// in any folder, and the phone's back button closes the client page.

const NAVIGATE_EVENT = 'hatab:navigate';

export function parseRoute(hash) {
  const parts = hash
    .replace(/^#\/?/, '')
    .split('/')
    .filter(Boolean)
    .map((part) => decodeURIComponent(part));
  if (parts[0] === 'client' && parts[1]) return { name: 'client', id: parts[1] };
  if (parts[0] === 'transactions') return { name: 'transactions' };
  if (parts[0] === 'settings') return { name: 'settings' };
  return { name: 'clients' };
}

export const clientPath = (id) => `/client/${encodeURIComponent(id)}`;

/** Goes to a path like "/client/123". Tabs use replace so they don't pile up in history. */
export function navigate(path, { replace = false } = {}) {
  const url = `#${path}`;
  if (replace) window.history.replaceState({ inApp: true }, '', url);
  else window.history.pushState({ inApp: true }, '', url);
  window.dispatchEvent(new Event(NAVIGATE_EVENT));
}

/** Back to where the user came from inside the app, or to the clients list. */
export function goBack(fallback = '/') {
  if (window.history.state?.inApp) window.history.back();
  else navigate(fallback, { replace: true });
}

export function useRoute() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const update = () => setHash(window.location.hash);
    const events = ['hashchange', 'popstate', NAVIGATE_EVENT];
    events.forEach((name) => window.addEventListener(name, update));
    return () => events.forEach((name) => window.removeEventListener(name, update));
  }, []);
  return useMemo(() => parseRoute(hash), [hash]);
}
