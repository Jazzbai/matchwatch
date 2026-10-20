import { createHash, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';
export const newStreamKey = () => randomBytes(32).toString('hex');
export const streamKeyHash = (value: string) => createHash('sha256').update(value).digest('hex');
export function secureEqual(a: string, b: string) {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function playbackTicket(payload: string, secret: string) {
  return createHmac('sha256', secret).update(payload).digest('hex');
}
export function youtubeId(input: string): string | null {
  if (/^[\w-]{11}$/.test(input)) return input;
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase();
    const id = host === 'youtu.be' ? url.pathname.slice(1) : ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host) ? (url.searchParams.get('v') || /^\/(?:shorts|live|embed)\/([\w-]{11})\/?$/.exec(url.pathname)?.[1]) : null;
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}
