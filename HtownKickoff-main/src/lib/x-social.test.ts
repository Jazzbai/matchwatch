import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchX, XSearchError } from './x-social';
const input = { matchId: 'game', query: '(Knicks OR 76ers) -is:retweet', start: '2026-10-22T18:00:00Z', end: '2026-10-22T19:00:00Z' };
test('X search maps actual response metrics and text, bounded to one page with private authorization', async () => {
  const result = await searchX('private-test-token', input, (async (url, init) => {
    assert.equal(new URL(String(url)).origin, 'https://api.x.com');
    assert.equal(new URL(String(url)).searchParams.get('max_results'), '100');
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer private-test-token');
    assert.equal(init?.redirect, 'error');
    return Response.json({ data: [{ id: 'post', text: 'wrong call', created_at: input.start, public_metrics: { like_count: 4, reply_count: 2, retweet_count: 1 } }], meta: { next_token: 'next' } });
  }) as typeof fetch);
  assert.equal(result.posts[0].matchId, 'game'); assert.equal(result.posts[0].reposts, 1); assert.equal(result.posts[0].text, 'wrong call'); assert.ok(result.truncated);
  assert.ok(!JSON.stringify(result).includes('private-test-token'));
});
test('X permissions and limits remain actionable and never expose provider bodies', async () => {
  for (const status of [401, 403, 429, 500]) await assert.rejects(searchX('secret', input, (async () => new Response('sensitive-provider-body', { status })) as typeof fetch), error => error instanceof XSearchError && !error.message.includes('sensitive') && error.status === (status === 429 ? 429 : 502));
});
test('X invalid dates do not call provider; missing metrics and partial results are rejected', async () => {
  let called = false;
  await assert.rejects(searchX('secret', { ...input, start: 'yesterday' }, (async () => { called = true; return Response.json({}); }) as typeof fetch));
  assert.equal(called, false);
  await assert.rejects(searchX('secret', input, (async () => Response.json({ data: [{ id: 'p', created_at: input.start }] })) as typeof fetch));
  await assert.rejects(searchX('secret', input, (async () => Response.json({ errors: [{ detail: 'partial' }] })) as typeof fetch));
  assert.deepEqual((await searchX('secret', input, (async () => Response.json({ meta: { result_count: 0 } })) as typeof fetch)).posts, []);
});
