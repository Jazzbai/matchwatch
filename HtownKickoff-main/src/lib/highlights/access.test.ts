import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AccessError, requestOwner, reserve, videoFromTicket, videoTicket, newPublicSession, publicSessionName } from './access';

const id = '111111111111111111111111';

async function withEnv(values: Record<string, string>, work: () => Promise<void> | void) {
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  Object.assign(process.env, values);
  try {
    await work();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
const production = (work: () => Promise<void> | void) => withEnv({
  NODE_ENV: 'production', HIGHLIGHTS_ENABLED: 'true', HIGHLIGHTS_SIGNING_SECRET: 'test-only-secret-with-more-than-32-characters',
  HIGHLIGHTS_PUBLIC_ORIGIN: 'https://matchwatch.us', API_PROXY_TARGET: 'http://private-api:4000',
  HIGHLIGHTS_PUBLIC_ACCESS: 'false',
}, work);

test('local development accepts loopback aliases on the same port only', () => withEnv({ NODE_ENV: 'development' }, async () => {
  assert.equal(await requestOwner(new Request('http://localhost:3001/api/stream/pipeline', { headers: { Origin: 'http://127.0.0.1:3001' } })), 'local');
  for (const origin of ['http://127.0.0.1:9999', 'https://unrelated.example']) {
    await assert.rejects(() => requestOwner(new Request('http://localhost:3001/api/stream/pipeline', { headers: { Origin: origin } })), AccessError);
  }
}));

test('production requires a signed-in account and the public origin', () => production(async () => {
  const url = 'https://matchwatch.us/app/api/stream/pipeline';
  await assert.rejects(() => requestOwner(new Request(url)), (error: unknown) => error instanceof AccessError && error.status === 401);
  await assert.rejects(() => requestOwner(new Request(url, { headers: { Origin: 'https://unrelated.example', Authorization: 'Bearer token' } })), (error: unknown) => error instanceof AccessError && error.status === 403);
  const owner = await requestOwner(new Request(url, { headers: { Origin: 'https://matchwatch.us', Authorization: 'Bearer token' } }), async (target, init) => {
    assert.equal(String(target), 'http://private-api:4000/api/v1/user/me');
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer token');
    return Response.json({ success: true, data: { id: 'owner' } });
  });
  assert.equal(owner, 'owner');
}));

test('video tickets are bound to their owner and expire', () => production(() => {
  const now = Date.now(), ticket = videoTicket(id, 'owner', now);
  assert.equal(videoFromTicket(ticket, 'owner', now), id);
  assert.throws(() => videoFromTicket(ticket, 'someone-else', now), AccessError);
  assert.throws(() => videoFromTicket(ticket.replace(id, '222222222222222222222222'), 'owner', now), AccessError);
  assert.throws(() => videoFromTicket(ticket, 'owner', now + 86_400_001), AccessError);
}));

test('hourly limits and render concurrency are bounded, and leases release once', () => production(() => {
  for (let i = 0; i < 10; i++) reserve('quota-owner', 'create')();
  assert.throws(() => reserve('quota-owner', 'create'), (error: unknown) => error instanceof AccessError && error.status === 429);
  const first = reserve('render-owner', 'render'), second = reserve('render-owner', 'render');
  assert.throws(() => reserve('render-owner', 'render'), AccessError);
  first();
  first();
  const third = reserve('render-owner', 'render');
  assert.throws(() => reserve('render-owner', 'render'), AccessError);
  second();
  third();
}));

test('public studio creates isolated signed sessions without calling account verification', () => production(() => withEnv({ HIGHLIGHTS_PUBLIC_ACCESS: 'true' }, async () => {
  const url = 'https://matchwatch.us/app/api/stream/pipeline';
  const first = newPublicSession(new Request(url))!, second = newPublicSession(new Request(url))!;
  const request = (cookie: string, origin = 'https://matchwatch.us') => new Request(url, { headers: { Cookie: `${publicSessionName}=${cookie}`, Origin: origin } });
  const forbiddenTransport: typeof fetch = async () => { throw Error('Public sessions must not call the login service'); };
  const owner = await requestOwner(request(first), forbiddenTransport);
  assert.match(owner, /^public:[a-f0-9]{24}$/);
  assert.notEqual(owner, await requestOwner(request(second), forbiddenTransport));
  assert.equal(newPublicSession(request(first)), null);
  const ticket = videoTicket(id, owner);
  assert.throws(() => videoFromTicket(ticket, `public:${'0'.repeat(24)}`), AccessError);
  await assert.rejects(() => requestOwner(request(first + 'tampered'), forbiddenTransport), AccessError);
  await assert.rejects(() => requestOwner(request(first, 'https://unrelated.example'), forbiddenTransport), AccessError);
  await assert.rejects(() => requestOwner(new Request(url), forbiddenTransport), AccessError);
})));

test('public processing remains globally bounded when browsers create new sessions', () => production(() => {
  for (let n = 0; n < 30; n++) reserve(`public:${n.toString(16).padStart(24, '0')}`, 'create')();
  assert.throws(() => reserve(`public:${'f'.repeat(24)}`, 'create'), (error: unknown) => error instanceof AccessError && error.status === 429);
}));
