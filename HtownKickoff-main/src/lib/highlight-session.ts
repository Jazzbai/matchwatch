import { ensureToken, getAccessToken } from './api';

/** Renew before a potentially long upload; the server still verifies every token. */
export async function highlightAuthorization(): Promise<HeadersInit> {
  let token = getAccessToken();
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now() + 300000) token = await ensureToken();
    } catch { /* Opaque tokens are verified by the server. */ }
  }
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Retry only an authentication rejection, once, using the shared refresh lock. */
export async function highlightFetch(url: string, init: RequestInit = {},
  transport: typeof fetch = fetch, renew: typeof ensureToken = ensureToken): Promise<Response> {
  const headers = new Headers(init.headers);
  new Headers(await highlightAuthorization()).forEach((value, name) => headers.set(name, value));
  const response = await transport(url, { ...init, headers });
  if (response.status !== 401 || !headers.has('Authorization') || init.signal?.aborted) return response;
  const token = await renew();
  if (!token || init.signal?.aborted) return response;
  headers.set('Authorization', `Bearer ${token}`);
  return transport(url, { ...init, headers });
}
