// Lets the database code say "something changed on this device" without knowing about the
// sync scheduler, which listens and uploads the change shortly after.

const listeners = new Set();

export function onLocalChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function localChange() {
  listeners.forEach((listener) => listener());
}
