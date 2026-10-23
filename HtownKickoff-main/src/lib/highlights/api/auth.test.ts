import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AccessError } from '../access';
import { apiOwner, apiOwners } from './auth';

const env = { HIGHLIGHTS_API_KEYS: 'first-key-0123456789, second-key-0123456789,short' };
const request = (key?: string) => new Request('https://example.test/api/v1/process', { headers: key ? { 'X-API-Key': key } : {} });

test('accepts configured keys and isolates each key as its own owner', () => {
  const first = apiOwner(request('first-key-0123456789'), env), second = apiOwner(request('second-key-0123456789'), env);
  assert.match(first, /^api:[a-f0-9]{16}$/);
  assert.notEqual(first, second);
  assert.equal(apiOwner(request('first-key-0123456789'), env), first);
  assert.deepEqual(apiOwners(env), [first, second]);
  assert.ok(!first.includes('first-key'), 'the owner ID never contains the key');
});

test('rejects missing, wrong and too-short keys with 401', () => {
  for (const key of [undefined, 'wrong-key-0123456789', 'short']) {
    assert.throws(() => apiOwner(request(key), env), (error: unknown) => error instanceof AccessError && error.status === 401);
  }
});

test('reports 503 when no API keys are configured', () => {
  assert.throws(() => apiOwner(request('anything-0123456789'), {}), (error: unknown) => error instanceof AccessError && error.status === 503);
});
