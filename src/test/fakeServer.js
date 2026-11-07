// An in-memory stand-in for the HATAB API (api/), following the same rules as
// api/app/Sync/SyncService.php, so the sync engine and screens can be tested without PHP.
// src/sync/contract.test.js runs the same kind of checks against the real API on CI.

export const SERVER = 'https://api.test';

export function createFakeServer({ pageLimit = 500 } = {}) {
  const users = [];
  const tokens = new Map();
  const clients = new Map();
  const transactions = new Map();
  const calls = [];
  let online = true;
  let nextToken = 1;

  const reply = (status, body = null) =>
    new Response(body === null ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  const invalid = (field, message) => reply(422, { message, errors: { [field]: [message] } });
  const profile = (user) => ({ id: user.id, name: user.name, email: user.email, shopName: user.shopName });
  const session = (user) => {
    const token = `${nextToken++}|token`;
    tokens.set(token, user.id);
    return { token, user: profile(user) };
  };

  function sync(user, body) {
    const rejected = [];
    let revision = user.revision;
    const push = (store, items, kind) => {
      for (const item of items) {
        const current = store.get(item.id);
        if (current && current.userId !== user.id) {
          rejected.push({ kind, id: item.id, reason: 'not_yours' });
          continue;
        }
        if (kind === 'transaction' && item.clientId && clients.get(item.clientId)?.userId !== user.id) {
          rejected.push({ kind, id: item.id, reason: 'unknown_client' });
          continue;
        }
        if (current && current.record.updatedAt >= item.updatedAt) continue;
        store.set(item.id, { userId: user.id, record: { ...item }, revision: ++revision });
      }
    };
    push(clients, body.clients ?? [], 'client');
    push(transactions, body.transactions ?? [], 'transaction');
    user.revision = revision;

    const limit = Math.min(body.limit ?? pageLimit, pageLimit);
    const changes = [
      ...[...clients.values()].map((entry) => ({ ...entry, kind: 'client' })),
      ...[...transactions.values()].map((entry) => ({ ...entry, kind: 'transaction' })),
    ]
      .filter((entry) => entry.userId === user.id && entry.revision > body.since)
      .sort((a, b) => a.revision - b.revision);
    const page = changes.slice(0, limit);
    const hasMore = changes.length > limit;
    return {
      revision: hasMore ? page[page.length - 1].revision : Math.max(body.since, user.revision),
      hasMore,
      clients: page.filter((entry) => entry.kind === 'client').map((entry) => entry.record),
      transactions: page.filter((entry) => entry.kind === 'transaction').map((entry) => entry.record),
      rejected,
    };
  }

  async function fetch(url, init = {}) {
    if (!online) throw new TypeError('Failed to fetch');
    const { pathname } = new URL(url);
    const path = pathname.replace(/^\/api\/v1/, '');
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : {};
    const token = init.headers?.Authorization?.replace(/^Bearer /, '');
    const user = users.find((u) => u.id === tokens.get(token));
    calls.push({ method, path, body });

    if (method === 'POST' && path === '/register') {
      const email = String(body.email).trim().toLowerCase();
      if (String(body.password ?? '').length < 8) return invalid('password', 'كلمة السر: على الأقل 8 حروف.');
      if (users.some((u) => u.email === email)) return invalid('email', 'البريد الإلكتروني ده مستخدم قبل كده.');
      const created = { id: users.length + 1, name: body.name, email, password: body.password, shopName: '', revision: 0 };
      users.push(created);
      return reply(201, session(created));
    }
    if (method === 'POST' && path === '/login') {
      const found = users.find((u) => u.email === String(body.email).trim().toLowerCase());
      if (!found || found.password !== body.password) {
        return invalid('email', 'البريد الإلكتروني أو كلمة السر مش صح.');
      }
      return reply(200, session(found));
    }
    if (!user) return reply(401, { message: 'Unauthenticated.' });
    if (method === 'POST' && path === '/logout') {
      tokens.delete(token);
      return reply(204);
    }
    if (path === '/me') {
      if (method === 'PATCH') {
        if ('name' in body) user.name = body.name;
        if ('shopName' in body) user.shopName = body.shopName ?? '';
      }
      return reply(200, { user: profile(user) });
    }
    if (method === 'POST' && path === '/sync') return reply(200, sync(user, body));
    return reply(404, { message: 'Not Found' });
  }

  /** Logs in from "another device" and returns a function that syncs as that device. */
  async function otherDevice(email, password = 'secret-pass') {
    const { token } = await (
      await fetch(`${SERVER}/api/v1/login`, { method: 'POST', body: JSON.stringify({ email, password }) })
    ).json();
    return async (body) =>
      (
        await fetch(`${SERVER}/api/v1/sync`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ since: 0, clients: [], transactions: [], ...body }),
        })
      ).json();
  }

  return {
    fetch,
    otherDevice,
    users,
    tokens,
    clients,
    transactions,
    calls,
    setOnline(value) {
      online = value;
    },
  };
}
