import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TwelveLabsClient, TwelveLabsError } from './twelvelabs';
import { jevPrompt } from './jev';
const asset = '111111111111111111111111', indexed = '222222222222222222222222', index = '333333333333333333333333';

test('cloud imports send only a source URL instead of buffering the game', async () => {
  const client = new TwelveLabsClient('test-key', index, async (url, init) => {
    assert.equal(String(url), 'https://api.twelvelabs.io/v1.3/assets');
    assert.ok(init?.body instanceof FormData);
    assert.equal(init.body.get('method'), 'url'); assert.equal(init.body.get('url'), 'https://cdn.scoreplay.io/game.mp4');
    assert.equal(init.body.has('file'), false);
    return Response.json({ _id: asset });
  });
  assert.equal(await client.importUrl('https://cdn.scoreplay.io/game.mp4'), asset);
});
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

test('Jev reuses the uploaded asset in an asynchronous Pegasus structured review', async () => {
  const client = new TwelveLabsClient('key', index, async (url, init) => {
    if (String(url).endsWith('/analyze/tasks')) {
      const body = JSON.parse(String(init?.body));
      assert.deepEqual(body.video, { type: 'asset_id', asset_id: asset });
      assert.equal(body.model_name, 'pegasus1.6'); assert.equal(body.response_format.type, 'json_schema');
      assert.equal(body.start_time, 10); assert.equal(body.end_time, 40);
      return Response.json({ task_id: indexed });
    }
    return Response.json({ status: 'ready', result: { finish_reason: 'length', data: '{' } });
  });
  assert.equal(await client.review(asset, [{ id: 'goal', label: 'Goal', start: 20, end: 25 }], 100), indexed);
  await assert.rejects(() => client.reviewStatus(indexed), (e: unknown) => e instanceof TwelveLabsError && e.status === 502);
});

test('Jev returns validated evidence only when its analysis task is complete', async () => {
  const reviews = [{ candidate_id: 'goal', event: 'goal', importance_estimate: 0.9, excitement_estimate: null, watchability_estimate: 0.8, match_context: null, duplicate_of: null, suggested_start: 15, suggested_end: 30, recommend_include: true, reason: 'Clear goal.', needs_review: false }];
  let status = 'processing';
  const client = new TwelveLabsClient('key', index, async () => Response.json({ status, result: { finish_reason: 'stop', data: JSON.stringify({ reviews }) } }));
  assert.deepEqual(await client.reviewStatus(indexed), { status: 'processing', error: undefined });
  status = 'ready';
  assert.deepEqual(await client.reviewStatus(indexed), { status: 'ready', reviews });
});

test('completed older tasks recover mistyped IDs using their original request manifest', async () => {
  const candidates = [{ id: 'goal', label: 'Goal', start: 20, end: 25 }, { id: 'replay', label: 'Replay', start: 60, end: 65 }];
  const base = { event: 'goal', importance_estimate: 0.9, excitement_estimate: 0.8, watchability_estimate: 0.8, match_context: null, duplicate_of: null, recommend_include: true, reason: 'Visible action.', needs_review: false };
  const client = new TwelveLabsClient('key', index, async () => Response.json({ status: 'ready', request_params: { prompt: jevPrompt(candidates), start_time: 10, end_time: 80 }, result: { finish_reason: 'stop', data: JSON.stringify({ reviews: [ { ...base, candidate_id: 'goal', suggested_start: 15, suggested_end: 30 }, { ...base, candidate_id: 'repla', suggested_start: 55, suggested_end: 70 } ] }) } }));
  const result = await client.reviewStatus(indexed);
  assert.equal(result.reviews?.length, 2);
  assert.equal(result.reviews?.[0].needs_review, false);
  assert.equal(result.reviews?.[1].candidate_id, 'replay');
  assert.equal(result.reviews?.[1].needs_review, true);
  assert.equal(result.reviews?.[1].recommend_include, false);
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
