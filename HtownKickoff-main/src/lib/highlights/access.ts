import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// Request authentication, signed resource tickets and per-account rate limits.
// Local development on loopback needs no login; production verifies the
// MatchWatch session and rejects cross-origin requests.

export class AccessError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

const LOOPBACK = ['localhost', '127.0.0.1', '[::1]'];
const TICKET_TTL_MS = 24 * 60 * 60 * 1000;
const isDevelopment = () => process.env.NODE_ENV === 'development';

export function studioEnabled() {
  return isDevelopment() || (process.env.HIGHLIGHTS_ENABLED === 'true' && (process.env.HIGHLIGHTS_SIGNING_SECRET || '').length >= 32);
}

export const publicSessionName = 'matchwatch_studio_session';
export const publicStudioEnabled = () => studioEnabled() && process.env.HIGHLIGHTS_PUBLIC_ACCESS === 'true';

function publicOwner(request: Request, now = Date.now()) {
  const value = (request.headers.get('cookie') || '').split(';').map(part => part.trim()).find(part => part.startsWith(publicSessionName + '='))?.slice(publicSessionName.length + 1);
  if (!value) return null;
  try { return `public:${videoFromTicket(value, 'public-session', now)}`; } catch { return null; }
}

/** The status endpoint creates a private, signed browser session without an account. */
export function newPublicSession(request: Request, now = Date.now()) {
  if (!publicStudioEnabled() || publicOwner(request, now)) return null;
  return videoTicket(randomBytes(12).toString('hex'), 'public-session', now);
}

/** Returns the account that owns this request's jobs. */
export async function requestOwner(request: Request, transport: typeof fetch = fetch): Promise<string> {
  const url = new URL(request.url), origin = request.headers.get('origin');
  if (origin && !sameOrigin(url, origin)) throw new AccessError('This request must come from the MatchWatch studio.', 403);
  if (isDevelopment() && LOOPBACK.includes(url.hostname)) return 'local';
  if (!studioEnabled()) throw new AccessError('The highlight studio is not enabled on this server.', 503);
  if (publicStudioEnabled()) {
    const owner = publicOwner(request);
    if (!owner) throw new AccessError('Refresh Highlight Studio to start a new session.', 401);
    return owner;
  }
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) throw new AccessError('Sign in to create highlights.', 401);
  let response: Response;
  try {
    const api = (process.env.API_PROXY_TARGET || 'http://localhost:4000').replace(/\/$/, '');
    response = await transport(`${api}/api/v1/user/me`, { headers: { Authorization: authorization }, cache: 'no-store', signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new AccessError('Account verification is temporarily unavailable.', 503);
  }
  if (response.status === 401 || response.status === 403) throw new AccessError('Your session expired. Please sign in again.', 401);
  const data = response.ok ? await response.json().catch(() => null) : null;
  if (!data?.success || typeof data.data?.id !== 'string') throw new AccessError('Your account could not be verified.', response.ok ? 401 : 503);
  return data.data.id;
}

function sameOrigin(url: URL, origin: string) {
  if (!isDevelopment()) return origin === (process.env.HIGHLIGHTS_PUBLIC_ORIGIN || 'https://matchwatch.us');
  if (origin === url.origin) return true;
  // The dev server may normalize 127.0.0.1 to localhost; accept loopback aliases on the same port.
  try {
    const source = new URL(origin);
    return LOOPBACK.includes(url.hostname) && LOOPBACK.includes(source.hostname) && source.port === url.port && source.protocol === url.protocol;
  } catch {
    return false;
  }
}

function signature(id: string, owner: string, expires: number) {
  const secret = process.env.HIGHLIGHTS_SIGNING_SECRET || (isDevelopment() ? 'matchwatch-development-resource-signing' : '');
  if (!secret) throw new AccessError('Highlight studio signing is unavailable.', 503);
  return createHmac('sha256', secret).update(`highlights|video|${owner}|${id}|${expires}`).digest('hex');
}

/** A signed, owner-bound reference to a provider video that expires after 24 hours. */
export function videoTicket(id: string, owner: string, now = Date.now()) {
  const expires = now + TICKET_TTL_MS;
  return `${id}.${expires}.${signature(id, owner, expires)}`;
}

export function videoFromTicket(ticket: string, owner: string, now = Date.now()) {
  const [id, expiry, mac, extra] = ticket.split('.');
  const expires = Number(expiry);
  const wellFormed = !extra && /^[a-f0-9]{24}$/.test(id || '') && /^[a-f0-9]{64}$/.test(mac || '') && Number.isSafeInteger(expires) && expires >= now && expires <= now + TICKET_TTL_MS;
  if (!wellFormed || !timingSafeEqual(Buffer.from(mac, 'hex'), Buffer.from(signature(id, owner, expires), 'hex'))) {
    throw new AccessError('This video selection expired or belongs to another session. Choose the video again.', 403);
  }
  return id;
}

export type Operation = 'create' | 'request' | 'render';
const hourlyLimits: Record<Operation, number> = { create: 10, request: 600, render: 10 };
const publicHourlyLimits: Record<Operation, number> = { create: 30, request: 3000, render: 30 };
const MAX_PARALLEL_RENDERS = 2;
const usage = new Map<string, { count: number; expires: number }>();
let activeRenders = 0;

/** Counts an operation against the hourly limit; returns a release callback for renders. */
export function reserve(owner: string, operation: Operation) {
  if (isDevelopment()) return () => {};
  const now = Date.now();
  for (const [key, value] of usage) if (value.expires <= now) usage.delete(key);
  const key = `${owner}:${operation}`;
  const entry = usage.get(key) || { count: 0, expires: now + 3600_000 };
  if (entry.count >= hourlyLimits[operation] || usage.size >= 10_000) throw new AccessError('Hourly highlight limit reached. Please try again later.', 429);
  if (operation === 'render' && activeRenders >= MAX_PARALLEL_RENDERS) throw new AccessError('The video renderers are busy. Please try again shortly.', 429);
  if (owner.startsWith('public:')) {
    const globalKey = `public-global:${operation}`, global = usage.get(globalKey) || { count: 0, expires: now + 3600_000 };
    if (global.count >= publicHourlyLimits[operation]) throw new AccessError('The public studio has reached its hourly processing limit. Please try again later.', 429);
    global.count++; usage.set(globalKey, global);
  }
  entry.count++;
  usage.set(key, entry);
  if (operation !== 'render') return () => {};
  activeRenders++;
  let released = false;
  return () => {
    if (!released) activeRenders--;
    released = true;
  };
}
