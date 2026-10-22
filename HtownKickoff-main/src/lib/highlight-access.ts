import { createHmac, timingSafeEqual } from 'node:crypto';

export class HighlightAccessError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export function studioEnabled() { return process.env.NODE_ENV === 'development' || process.env.HIGHLIGHTS_ENABLED === 'true'; }
export async function highlightOwner(request: Request, transport: typeof fetch = fetch): Promise<string> {
  const url = new URL(request.url), origin = request.headers.get('origin');
  const development = process.env.NODE_ENV === 'development';
  const expected = development ? url.origin : (process.env.HIGHLIGHTS_PUBLIC_ORIGIN || 'https://matchwatch.us');
  let sameOrigin = origin === expected;
  // Next's development server may normalize 127.0.0.1 to localhost internally.
  // Accept loopback aliases only on the same port; production still requires the exact origin.
  if (development && origin) {
    try {
      const source = new URL(origin), loopback = ['localhost', '127.0.0.1', '[::1]'];
      sameOrigin ||= loopback.includes(url.hostname) && loopback.includes(source.hostname) && source.port === url.port && source.protocol === url.protocol;
    } catch { /* Invalid origins remain rejected. */ }
  }
  if (origin && !sameOrigin) throw new HighlightAccessError('This request must come from the MatchWatch studio.', 403);
  if (development && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return 'local';
  if (!studioEnabled()) throw new HighlightAccessError('The highlight studio is not enabled on this server yet.', 503);
  if (!process.env.HIGHLIGHTS_SIGNING_SECRET || process.env.HIGHLIGHTS_SIGNING_SECRET.length < 32) throw new HighlightAccessError('Highlight studio server configuration is incomplete.', 503);
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) throw new HighlightAccessError('Sign in to create highlights.', 401);
  let response: Response;
  try { response = await transport(`${(process.env.API_PROXY_TARGET || 'http://localhost:4000').replace(/\/$/, '')}/api/v1/user/me`, { headers: { Authorization: authorization }, cache: 'no-store', signal: AbortSignal.timeout(10000) }); }
  catch { throw new HighlightAccessError('Account verification is temporarily unavailable.', 503); }
  if (response.status === 401 || response.status === 403) throw new HighlightAccessError('Your session expired. Please sign in again.', 401);
  if (!response.ok) throw new HighlightAccessError('Account verification is temporarily unavailable.', 503);
  const data = await response.json().catch(() => null);
  if (!data?.success || typeof data.data?.id !== 'string') throw new HighlightAccessError('Your account could not be verified.', 401);
  return data.data.id;
}
function signature(id: string, owner: string, kind: string, expires: number) {
  const secret = process.env.HIGHLIGHTS_SIGNING_SECRET || (process.env.NODE_ENV === 'development' ? 'matchwatch-development-resource-signing' : '');
  if (!secret) throw new HighlightAccessError('Highlight studio signing is unavailable.', 503);
  return createHmac('sha256', secret).update(`highlights|${kind}|${owner}|${id}|${expires}`).digest('hex');
}
export function resourceTicket(id: string, owner: string, kind: 'asset' | 'indexed' | 'review', now = Date.now()) {
  const expires = now + 24 * 60 * 60 * 1000;
  return `${id}.${expires}.${signature(id, owner, kind, expires)}`;
}
export function resourceId(ticket: string, owner: string, kind: 'asset' | 'indexed' | 'review', now = Date.now()) {
  const [id, expiry, mac, extra] = ticket.split('.');
  const expires = Number(expiry);
  if (extra || !/^[a-f0-9]{24}$/.test(id || '') || !/^[a-f0-9]{64}$/.test(mac || '') || !Number.isSafeInteger(expires) || expires < now || expires > now + 24 * 60 * 60 * 1000) throw new HighlightAccessError('This video session expired or is invalid. Upload the video again.', 403);
  if (!timingSafeEqual(Buffer.from(mac, 'hex'), Buffer.from(signature(id, owner, kind, expires), 'hex'))) throw new HighlightAccessError('This video belongs to a different session.', 403);
  return id;
}
const usage = new Map<string, { count: number; expires: number }>();
let activeExports = 0;
export function reserveOperation(owner: string, action: string) {
  if (process.env.NODE_ENV === 'development') return () => {};
  const now = Date.now();
  for (const [key, value] of usage) if (value.expires <= now) usage.delete(key);
  const key = `${owner}:${action}`, limit = action === 'request' ? 60 : action === 'upload' || action === 'review' ? 3 : action === 'search' ? 30 : 10;
  const value = usage.get(key) || { count: 0, expires: now + 3600000 };
  if (value.count >= limit || usage.size >= 10000) throw new HighlightAccessError('Hourly highlight limit reached. Please try again later.', 429);
  const processing = action === 'export' || action === 'compress' || action === 'scoreplay-import';
  if (processing && activeExports >= 2) throw new HighlightAccessError('The video processors are busy. Please try again shortly.', 429);
  value.count++; usage.set(key, value);
  if (!processing) return () => {};
  activeExports++;
  let released = false;
  return () => { if (!released) { activeExports--; released = true; } };
}
