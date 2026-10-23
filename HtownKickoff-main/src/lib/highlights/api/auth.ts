import { createHash, timingSafeEqual } from 'node:crypto';
import { AccessError } from '../access';

// X-API-Key authentication for the public integration API. Keys come only from
// HIGHLIGHTS_API_KEYS (comma-separated) and are never logged or returned.

type Env = Record<string, string | undefined>;
const digest = (value: string) => createHash('sha256').update(value).digest();

export function configuredKeys(env: Env = process.env) {
  return (env.HIGHLIGHTS_API_KEYS || '').split(',').map(key => key.trim()).filter(key => key.length >= 16);
}

/** Returns a stable, non-secret owner ID for the caller's key; jobs are isolated per key. */
export function apiOwner(request: Request, env: Env = process.env): string {
  const keys = configuredKeys(env);
  if (!keys.length) throw new AccessError('The integration API is not enabled on this server (HIGHLIGHTS_API_KEYS).', 503);
  const supplied = request.headers.get('x-api-key') || '';
  // Compare fixed-length digests so neither length nor content leaks through timing.
  const match = keys.find(key => timingSafeEqual(digest(key), digest(supplied)));
  if (!supplied || !match) throw new AccessError('Missing or invalid X-API-Key header.', 401);
  return `api:${digest(match).toString('hex').slice(0, 16)}`;
}

export function apiOwners(env: Env = process.env) {
  return configuredKeys(env).map(key => `api:${digest(key).toString('hex').slice(0, 16)}`);
}
