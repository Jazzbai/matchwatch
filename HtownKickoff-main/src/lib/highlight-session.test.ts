import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setAccessToken } from './api';
import { highlightFetch } from './highlight-session';

test('an expired processing request renews once and reuses its video reference', async () => {
  setAccessToken('opaque-old-token');
  const body = new FormData(); body.set('assetId', 'existing-video-ticket');
  const seen: RequestInit[] = []; let renewals = 0;
  const transport: typeof fetch = async (_url, init) => {
    seen.push(init!);
    return new Response(null, { status: seen.length === 1 ? 401 : 200 });
  };
  try {
    const response = await highlightFetch('/highlights', { method: 'POST', body }, transport, async () => { renewals++; return 'renewed-token'; });
    assert.equal(response.status, 200); assert.equal(renewals, 1);
    assert.equal(seen.length, 2); assert.equal(seen[1].body, body);
    assert.equal(new Headers(seen[1].headers).get('Authorization'), 'Bearer renewed-token');
  } finally { setAccessToken(null); }
});

test('failed renewal, cancellation and provider errors never loop or replay work', async () => {
  setAccessToken('opaque-old-token');
  try {
    for (const status of [401, 429, 502]) {
      let calls = 0, renewals = 0;
      const response = await highlightFetch('/highlights', {}, async () => { calls++; return new Response(null, { status }); }, async () => { renewals++; return null; });
      assert.equal(response.status, status); assert.equal(calls, 1); assert.equal(renewals, status === 401 ? 1 : 0);
    }
    const abort = new AbortController();
    let renewals = 0;
    await highlightFetch('/highlights', { signal: abort.signal }, async () => { abort.abort(); return new Response(null, { status: 401 }); }, async () => { renewals++; return 'new-token'; });
    assert.equal(renewals, 0);
  } finally { setAccessToken(null); }
});
