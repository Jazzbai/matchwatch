import { test } from 'node:test';
import assert from 'node:assert/strict';
import { highlightOwner, HighlightAccessError, resourceTicket, resourceId, reserveOperation } from './highlight-access';
const id = '111111111111111111111111';
test('local browser uploads accept same-port loopback aliases but reject other origins', async () => {
  const previous = process.env.NODE_ENV;
  Object.assign(process.env, { NODE_ENV: 'development' });
  try {
    assert.equal(await highlightOwner(new Request('http://localhost:3001/api/stream/highlights', { headers: { Origin: 'http://127.0.0.1:3001' } })), 'local');
    for (const origin of ['http://127.0.0.1:9999', 'https://unrelated.example']) {
      await assert.rejects(() => highlightOwner(new Request('http://localhost:3001/api/stream/highlights', { headers: { Origin: origin } })), HighlightAccessError);
    }
  } finally {
    if (previous === undefined) Reflect.deleteProperty(process.env, 'NODE_ENV');
    else Object.assign(process.env, { NODE_ENV: previous });
  }
});
async function production(work: () => Promise<void> | void) {
  const previous = { NODE_ENV: process.env.NODE_ENV, HIGHLIGHTS_ENABLED: process.env.HIGHLIGHTS_ENABLED, HIGHLIGHTS_SIGNING_SECRET: process.env.HIGHLIGHTS_SIGNING_SECRET, HIGHLIGHTS_PUBLIC_ORIGIN: process.env.HIGHLIGHTS_PUBLIC_ORIGIN, API_PROXY_TARGET: process.env.API_PROXY_TARGET };
  Object.assign(process.env, { NODE_ENV: 'production', HIGHLIGHTS_ENABLED: 'true', HIGHLIGHTS_SIGNING_SECRET: 'test-only-secret-with-more-than-32-characters', HIGHLIGHTS_PUBLIC_ORIGIN: 'https://matchwatch.us', API_PROXY_TARGET: 'http://private-api:4000' });
  try { await work(); } finally { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
}
test('production processing requires a signed-in account and blocks unrelated origins', async () => production(async () => {
  await assert.rejects(() => highlightOwner(new Request('https://matchwatch.us/app/api/stream/highlights')), (e: unknown) => e instanceof HighlightAccessError && e.status === 401);
  await assert.rejects(() => highlightOwner(new Request('https://matchwatch.us/app/api/stream/highlights', { headers: { Origin: 'https://unrelated.example', Authorization: 'Bearer token' } })), (e: unknown) => e instanceof HighlightAccessError && e.status === 403);
  const owner = await highlightOwner(new Request('https://matchwatch.us/app/api/stream/highlights', { headers: { Origin: 'https://matchwatch.us', Authorization: 'Bearer token' } }), async (url, init) => {
    assert.equal(String(url), 'http://private-api:4000/api/v1/user/me'); assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer token');
    return Response.json({ success: true, data: { id: 'owner' } });
  });
  assert.equal(owner, 'owner');
}));
test('video references reject another user, resource type, tampering, and expiry', async () => production(() => {
  const now = Date.now(), ticket = resourceTicket(id, 'owner', 'asset', now);
  assert.equal(resourceId(ticket, 'owner', 'asset', now), id);
  assert.throws(() => resourceId(ticket, 'other-user', 'asset', now), HighlightAccessError);
  assert.throws(() => resourceId(ticket, 'owner', 'indexed', now), HighlightAccessError);
  assert.throws(() => resourceId(ticket, 'owner', 'review', now), HighlightAccessError);
  const review = resourceTicket(id, 'owner', 'review', now);
  assert.equal(resourceId(review, 'owner', 'review', now), id);
  assert.throws(() => resourceId(review, 'other-user', 'review', now), HighlightAccessError);
  assert.throws(() => resourceId(ticket.replace(id, '222222222222222222222222'), 'owner', 'asset', now), HighlightAccessError);
  assert.throws(() => resourceId(ticket, 'owner', 'asset', now + 86400001), HighlightAccessError);
}));
test('upload quotas and export concurrency are bounded and leases release once', async () => production(() => {
  for (let i = 0; i < 3; i++) reserveOperation('quota-test-owner', 'upload')();
  for (let i = 0; i < 9; i++) reserveOperation('review-test-owner', 'review')();
  assert.throws(() => reserveOperation('review-test-owner', 'review'), HighlightAccessError);
  assert.throws(() => reserveOperation('quota-test-owner', 'upload'), (e: unknown) => e instanceof HighlightAccessError && e.status === 429);
  const first = reserveOperation('export-test-owner', 'export'), second = reserveOperation('export-test-owner', 'export');
  assert.throws(() => reserveOperation('export-test-owner', 'export'), HighlightAccessError);
  first(); first();
  const third = reserveOperation('export-test-owner', 'export');
  assert.throws(() => reserveOperation('export-test-owner', 'export'), HighlightAccessError);
  second(); third();
}));
