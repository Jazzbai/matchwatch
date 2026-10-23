import { createHash, createHmac } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { publicIPv4 } from '../media';

// Webhook delivery for the integration API. Destinations must be public HTTPS
// endpoints; DNS is resolved and checked on every attempt, and the connection is
// pinned to the checked address so rebinding cannot reach internal networks.
// Redirects are never followed.

export class WebhookUrlError extends Error {}

export type WebhookPayload = { event: 'job.completed' | 'job.failed'; job_id: string; video_id: string; status: 'completed' | 'failed'; result?: unknown; error?: string };
export type DeliveryAttempt = { at: string; status: number | null; error?: string };
export type DeliveryResult = { delivered: boolean; attempts: DeliveryAttempt[]; deliveryId: string };
/** Sends one request; resolves with the HTTP status or throws on network failure. */
export type Sender = (url: URL, address: string, body: string, headers: Record<string, string>) => Promise<number>;
export type Resolver = (hostname: string) => Promise<string[]>;

const TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 4;

/** Syntactic checks only; the address check happens at delivery time. */
export function parseWebhookUrl(value: unknown): URL {
  if (typeof value !== 'string' || value.length > 2048) throw new WebhookUrlError('webhook_url must be a string of at most 2048 characters.');
  let url: URL;
  try { url = new URL(value); } catch { throw new WebhookUrlError('webhook_url is not a valid URL.'); }
  if (url.protocol !== 'https:') throw new WebhookUrlError('webhook_url must use https.');
  if (url.username || url.password) throw new WebhookUrlError('webhook_url must not contain credentials.');
  if (url.port && url.port !== '443') throw new WebhookUrlError('webhook_url must use the default HTTPS port (443).');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(url.hostname) ? !publicIPv4(url.hostname) : url.hostname.startsWith('[') || !url.hostname.includes('.') || /\.(local|internal|localhost)$/i.test(url.hostname)) {
    throw new WebhookUrlError('webhook_url must point to a public host.');
  }
  return url;
}

const resolveIPv4: Resolver = async hostname => (await lookup(hostname, { family: 4, all: true })).map(entry => entry.address);

/** Returns a public IPv4 address for the host, or throws when any address is private. */
export async function publicAddress(url: URL, resolve: Resolver = resolveIPv4) {
  const addresses = /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname) ? [url.hostname] : await resolve(url.hostname).catch(() => []);
  if (!addresses.length) throw new WebhookUrlError('webhook_url host could not be resolved.');
  if (addresses.some(address => !publicIPv4(address))) throw new WebhookUrlError('webhook_url resolves to a private or reserved address.');
  return addresses[0];
}

const httpsSender: Sender = (url, address, body, headers) => new Promise((resolve, reject) => {
  const request = httpsRequest(url, {
    method: 'POST', headers: { ...headers, 'Content-Length': String(Buffer.byteLength(body)) }, family: 4,
    lookup: (_host, _options, callback) => callback(null, address, 4),
  }, response => { response.resume(); resolve(response.statusCode ?? 0); });
  request.setTimeout(TIMEOUT_MS, () => request.destroy(new Error('Webhook timed out.')));
  request.on('error', reject);
  request.end(body);
});

/** Stable per job and outcome, so receivers can de-duplicate retried deliveries. */
export const deliveryId = (payload: WebhookPayload) => createHash('sha256').update(`${payload.job_id}|${payload.status}`).digest('hex').slice(0, 32);

export function signature(secret: string, timestamp: string, body: string) {
  return `sha256=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;
}

type Options = { sender?: Sender; resolve?: Resolver; sleep?: (ms: number) => Promise<void>; secret?: string; log?: (entry: Record<string, unknown>) => void };

/** Delivers with exponential backoff; retries network errors, 429 and 5xx only. */
export async function deliverWebhook(webhookUrl: string, payload: WebhookPayload, options: Options = {}): Promise<DeliveryResult> {
  const { sender = httpsSender, resolve = resolveIPv4, sleep = ms => new Promise(done => setTimeout(done, ms)), secret = process.env.HIGHLIGHTS_WEBHOOK_SECRET, log = entry => console.info(JSON.stringify(entry)) } = options;
  const id = deliveryId(payload), body = JSON.stringify({ delivery_id: id, ...payload });
  const attempts: DeliveryAttempt[] = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const headers: Record<string, string> = {
      'Content-Type': 'application/json', 'User-Agent': 'MatchWatch-Highlights-Webhook/1',
      'X-Webhook-Id': id, 'X-Webhook-Event': payload.event, 'X-Webhook-Timestamp': timestamp,
      ...(secret ? { 'X-Webhook-Signature': signature(secret, timestamp, body) } : {}),
    };
    let status: number | null = null, error: string | undefined;
    try {
      const url = parseWebhookUrl(webhookUrl);
      status = await sender(url, await publicAddress(url, resolve), body, headers);
      if (status >= 300 && status < 400) error = 'Redirects are not followed.';
    } catch (failure) {
      error = failure instanceof Error ? failure.message : 'Delivery failed.';
      if (failure instanceof WebhookUrlError) {
        attempts.push({ at: new Date().toISOString(), status, error });
        log({ component: 'highlights-webhook', job: payload.job_id, delivery: id, attempt, outcome: 'rejected', error });
        return { delivered: false, attempts, deliveryId: id };
      }
    }
    attempts.push({ at: new Date().toISOString(), status, ...(error ? { error } : {}) });
    const delivered = status !== null && status >= 200 && status < 300;
    log({ component: 'highlights-webhook', job: payload.job_id, delivery: id, attempt, status, outcome: delivered ? 'delivered' : 'failed' });
    if (delivered) return { delivered: true, attempts, deliveryId: id };
    const retryable = status === null || status === 429 || status >= 500;
    if (!retryable || attempt === MAX_ATTEMPTS) break;
    await sleep(1000 * 2 ** (attempt - 1));
  }
  return { delivered: false, attempts, deliveryId: id };
}
