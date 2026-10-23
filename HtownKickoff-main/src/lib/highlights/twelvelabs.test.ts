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
