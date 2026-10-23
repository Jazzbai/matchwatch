import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TwelveLabsClient, TwelveLabsError } from './twelvelabs';

test('index catalog follows every declared page and rejects invalid partial responses', async () => {
  const pages: string[] = [];
  const client = new TwelveLabsClient('synthetic-key', 'a'.repeat(24), async (url) => {
    const page = new URL(String(url)).searchParams.get('page')!;
    pages.push(page);
    return Response.json({ data: [{ _id: page.padStart(24, 'b') }], page_info: { total_page: 3 } });
  });
  assert.equal((await client.listIndexedAssets()).length, 3);
  assert.deepEqual(pages, ['1', '2', '3']);
  const invalid = new TwelveLabsClient('synthetic-key', 'a'.repeat(24), async () => Response.json({ data: [{ _id: 'invalid' }] }));
  await assert.rejects(() => invalid.listIndexedAssets(), TwelveLabsError);
});

test('a dropped index connection retries once within the same deadline', async () => {
  let calls = 0, deadline: AbortSignal | null | undefined;
  const client = new TwelveLabsClient('private-key', 'a'.repeat(24), async (_url, init) => {
    assert.equal(new Headers(init?.headers).get('x-api-key'), 'private-key');
    if (++calls === 1) { deadline = init?.signal; throw new TypeError('fetch failed', { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } }); }
    assert.equal(init?.signal, deadline);
    return Response.json({ _id: 'a'.repeat(24), index_name: 'Synthetic index', video_count: 12 });
  });
  assert.equal((await client.indexInfo()).video_count, 12);
  assert.equal(calls, 2);
});

test('read retries stop after two failures without exposing the key', async () => {
  let calls = 0;
  const client = new TwelveLabsClient('private-key', 'a'.repeat(24), async () => { calls++; throw new TypeError('fetch failed', { cause: { code: 'ECONNRESET' } }); });
  await assert.rejects(() => client.indexInfo(), error => error instanceof TwelveLabsError && error.status === 502 && !error.message.includes('private-key'));
  assert.equal(calls, 2);
});

test('uploads, indexing, search and paid analysis are never replayed on connection failure', async () => {
  let calls = 0;
  const client = new TwelveLabsClient('private-key', 'a'.repeat(24), async () => { calls++; throw new TypeError('fetch failed', { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } }); });
  const operations = [
    () => client.uploadAsset(new File(['synthetic'], 'test.mp4')),
    () => client.indexAsset('b'.repeat(24)),
    () => client.search('b'.repeat(24), 'Goal'),
    () => client.createAnalysis('b'.repeat(24), 'Review', {}, { start: 0, end: 10 }, 'synthetic-task'),
  ];
  for (const operation of operations) { const before = calls; await assert.rejects(operation, TwelveLabsError); assert.equal(calls, before + 1); }
});

test('permission, certificate and cancellation failures remain distinct and are not retried', async () => {
  for (const mode of ['permission', 'certificate', 'cancellation']) {
    let calls = 0;
    const client = new TwelveLabsClient('private-key', 'a'.repeat(24), async () => {
      calls++;
      if (mode === 'permission') return Response.json({}, { status: 403 });
      if (mode === 'cancellation') throw new DOMException('Cancelled', 'AbortError');
      throw new TypeError('fetch failed', { cause: { code: 'CERT_HAS_EXPIRED' } });
    });
    await assert.rejects(() => client.indexInfo(), error => error instanceof TwelveLabsError && error.status === (mode === 'permission' ? 403 : 502));
    assert.equal(calls, 1);
  }
});
