// Talking to the HATAB API (api/ in this repository). See api/README.md for the endpoints.

/** "https://api.example.com/" → "https://api.example.com" */
export function normalizeServerUrl(value) {
  return String(value ?? '')
    .trim()
    .replace(/\/+$/, '');
}

/** The server the app uses unless the owner types another one (set VITE_API_URL at build). */
export const DEFAULT_SERVER_URL = normalizeServerUrl(import.meta.env.VITE_API_URL ?? '');

/** The server answered with an error. `errors` holds validation messages per field. */
export class ApiError extends Error {
  name = 'ApiError';

  constructor(status, body) {
    super(body?.message || `HTTP ${status}`);
    this.status = status;
    this.errors = body?.errors ?? {};
  }
}

/** The server couldn't be reached at all (no internet, wrong address, server down). */
export class NetworkError extends Error {
  name = 'NetworkError';
}

export async function apiRequest(serverUrl, path, { method = 'GET', body, token, fetchImpl = globalThis.fetch } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetchImpl(`${normalizeServerUrl(serverUrl)}/api/v1${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (cause) {
    throw new NetworkError('Could not reach the server', { cause });
  }

  if (response.status === 204) return null;
  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) throw new ApiError(response.status, data);
  return data;
}

/** A message for the owner, in Arabic, for anything apiRequest can throw. */
export function describeError(error) {
  if (error instanceof NetworkError) return 'مش قادرين نوصل للسيرفر. اتأكد من النت ومن عنوان السيرفر.';
  if (error instanceof ApiError) {
    if (error.status === 401) return 'اتعمل خروج من الحساب على الجهاز ده. ادخل تاني.';
    if (error.status === 429) return 'محاولات كتير. استنى دقيقة وجرّب تاني.';
    const first = Object.values(error.errors).flat()[0];
    if (first) return first;
    return `السيرفر رجّع مشكلة (كود ${error.status}). جرّب بعدين.`;
  }
  return 'حصلت مشكلة. جرّب تاني.';
}
