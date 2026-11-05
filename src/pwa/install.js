import { useSyncExternalStore } from 'react';

// Chrome and Edge fire "beforeinstallprompt" when the app can be installed. We keep the
// event so a button can show the install dialog when the user asks for it.

let deferredPrompt = null;
const listeners = new Set();
const notify = () => listeners.forEach((listener) => listener());

export function listenForInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** True when the browser offered to install the app and it isn't installed yet. */
export function useCanInstall() {
  return useSyncExternalStore(
    subscribe,
    () => deferredPrompt !== null,
    () => false,
  );
}

/** Shows the browser's install dialog. Resolves to true if the user installed the app. */
export async function promptInstall() {
  const prompt = deferredPrompt;
  if (!prompt) return false;
  deferredPrompt = null;
  notify();
  await prompt.prompt();
  const choice = await prompt.userChoice;
  return choice?.outcome === 'accepted';
}

/** Running as an installed app rather than in a browser tab. */
export function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function isIOS() {
  const { userAgent, platform, maxTouchPoints } = window.navigator;
  return /iphone|ipad|ipod/i.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
}
