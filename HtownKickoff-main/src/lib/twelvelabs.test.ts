import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TwelveLabsClient, TwelveLabsError } from './twelvelabs';
const asset = '111111111111111111111111', indexed = '222222222222222222222222', index = '333333333333333333333333';
test('direct upload, ready asset indexing, indexed status, and search use separate resource IDs', async () => {
  const calls: string[] = [];
  const mock: typeof fetch = async (input, init) => {
    const url = String(input); calls.push(url);
    assert.equal(new Headers(init?.headers).get('x-api-key'), 'test-key');
    if (url.endsWith('/assets') && init?.method === 'POST') {
      assert.ok(init.body instanceof FormData); assert.equal(init.body.get('method'), 'direct'); assert.ok(init.body.get('file') instanceof File);
      return Response.json({ _id: asset, status: 'processing' }, { status: 201 });
    }
    if (url.endsWith(`/assets/${asset}`)) return Response.json({ _id: asset, status: 'ready' });
    if (url.endsWith(`/indexes/${index}/indexed-assets`)) {
      assert.deepEqual(JSON.parse(String(init?.body)), { asset_id: asset });
      return Response.json({ _id: indexed, asset_id: asset }, { status: 202 });
    }
    if (url.endsWith(`/indexed-assets/${indexed}`)) return Response.json({ _id: indexed, status: 'ready' });
    if (url.endsWith('/search')) {
      const form = init?.body as FormData; assert.deepEqual(JSON.parse(String(form.get('filter'))), { id: [indexed] });
      return Response.json({ data: [{ video_id: indexed, start: 10, end: 15 }, { video_id: asset, start: 2, end: 5 }, { video_id: indexed, start: 20, end: 10 }] });
    }
    throw new Error(`Unexpected endpoint ${url}`);
  };
  const client = new TwelveLabsClient('test-key', index, mock);
  assert.equal(await client.upload(new File(['video'], 'match.mp4')), asset);
  assert.equal(await client.indexAsset(asset), indexed);
  assert.equal((await client.indexedAsset(indexed)).status, 'ready');
  assert.deepEqual(await client.search(indexed, 'Goal'), [{ video_id: indexed, start: 10, end: 15 }]);
  assert.equal(calls.length, 5); assert.ok(calls.every(url => !url.includes('/tasks')));
});
test('indexing waits for ready assets, including small uploads', async () => {
  let requests = 0;
  const client = new TwelveLabsClient('key', index, async () => { requests++; return Response.json({ status: 'processing' }); });
  await assert.rejects(() => client.indexAsset(asset), (e: unknown) => e instanceof TwelveLabsError && e.status === 409);
  assert.equal(requests, 1);
});
test('provider status, error code, and retry timing survive rate limits', async () => {
  const client = new TwelveLabsClient('key', index, async () => Response.json({ code: 'rate_limit', message: 'Please wait.' }, { status: 429, headers: { 'Retry-After': '30' } }));
  await assert.rejects(() => client.asset(asset), (e: unknown) => e instanceof TwelveLabsError && e.status === 429 && e.code === 'rate_limit' && e.retryAfter === '30' && e.message === 'Please wait.');
});
test('invalid credentials and non-JSON provider failures remain actionable', async () => {
  const unauthorized = new TwelveLabsClient('key', index, async () => new Response('', { status: 401 }));
  await assert.rejects(() => unauthorized.asset(asset), (e: unknown) => e instanceof TwelveLabsError && e.status === 401 && e.message.includes('API key'));
  const unreadable = new TwelveLabsClient('key', index, async () => new Response('not JSON'));
  await assert.rejects(() => unreadable.asset(asset), (e: unknown) => e instanceof TwelveLabsError && e.status === 502);
});
