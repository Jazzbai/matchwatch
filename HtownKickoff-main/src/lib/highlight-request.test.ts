import { test } from 'node:test';
import assert from 'node:assert/strict';
import { highlightResponse } from './highlight-request';

test('upload failures remain actionable even when a proxy returns HTML', async () => {
  for (const [status, expected] of [[401, /Sign in/], [413, /too large/], [502, /temporarily unavailable/], [504, /temporarily unavailable/]] as const) {
    await assert.rejects(() => highlightResponse(new Response('<html>Error</html>', { status })), expected);
  }
});
test('provider errors are preserved and successful video responses remain unconsumed', async () => {
  await assert.rejects(() => highlightResponse(Response.json({ error: 'Index is not ready.' }, { status: 409 })), /Index is not ready/);
  const response = new Response('mp4 bytes');
  assert.equal(await highlightResponse(response), response);
  assert.equal(await response.text(), 'mp4 bytes');
});
