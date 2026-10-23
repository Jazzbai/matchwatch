import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ScorePlayClient, scorePlayAllowed, scorePlayDownloadUrl, selectScorePlayFormat, requireScorePlayExternalProcessing } from './scoreplay';

test('ScorePlay imports remain blocked even when an old override is present', () => {
  const previous = process.env.SCOREPLAY_ALLOW_EXTERNAL_PROCESSING;
  try {
    delete process.env.SCOREPLAY_ALLOW_EXTERNAL_PROCESSING;
    assert.throws(requireScorePlayExternalProcessing, /re-uploading/);
    process.env.SCOREPLAY_ALLOW_EXTERNAL_PROCESSING = 'true';
    assert.throws(requireScorePlayExternalProcessing, /re-uploading/);
  } finally { if (previous === undefined) delete process.env.SCOREPLAY_ALLOW_EXTERNAL_PROCESSING; else process.env.SCOREPLAY_ALLOW_EXTERNAL_PROCESSING = previous; }
});

test('ScorePlay uses documented filename search and never returns signed media links', async () => {
  const client = new ScorePlayClient('private-key', async (url, init) => {
    assert.equal(String(url), 'https://media.scoreplay.io/v1/media/search?page=1&per_page=12');
    assert.equal(new Headers(init?.headers).get('X-ScorePlay-Api-Key'), 'private-key');
    assert.deepEqual(JSON.parse(String(init?.body)), { media_type: 'video', name: 'basketball' });
    return Response.json({ media: [{ ID: 123, name: 'basketball.mp4', type: 'video', duration: 60, original_url: 'private' }, { ID: 124, name: 'photo', type: 'photo' }] });
  });
  assert.deepEqual(await client.search('basketball'), [{ id: '123', name: 'basketball.mp4', duration: 60 }]);
});

test('format selection respects readiness, storage, MP4 and size limits', () => {
  const file = { id: 'a', file_name: 'a.mp4', size: 1000, mime_type: 'video/mp4', file_url: 'https://cdn.scoreplay.io/a.mp4', is_scoreplay: true, status: 'ready' };
  assert.equal(selectScorePlayFormat({ items: { a: [file, { ...file, size: 2000 }] } }).size, 2000);
  assert.equal(selectScorePlayFormat({ items: { a: [{ ...file, status: 'active' }] } }).size, 1000);
  for (const change of [{ size: -1 }, { size: 201 * 1024 * 1024 }, { mime_type: 'application/vnd.apple.mpegurl' }, { status: 'processing' }, { is_scoreplay: false }, { file_url: undefined }]) {
    assert.throws(() => selectScorePlayFormat({ items: { a: [{ ...file, ...change }] } }));
  }
  for (const url of ['http://cdn.scoreplay.io/a', 'https://127.0.0.1/a', 'https://cdn.scoreplay.io.evil.test/a', 'https://user:pass@cdn.scoreplay.io/a', 'https://cdn.scoreplay.io:9000/a']) assert.throws(() => scorePlayDownloadUrl(url));
});

test('download rechecks provider visibility and keeps the API key off storage requests', async () => {
  const paths: string[] = [];
  const client = new ScorePlayClient('private-key', async (url, init) => {
    paths.push(String(url));
    if (String(url).endsWith('/media/123')) return Response.json({ type: 'video' });
    if (String(url).includes('/formats/download')) return Response.json({ items: { a: [{ id: 'a', file_name: 'game.mp4', size: 4, mime_type: 'video/mp4', file_url: 'https://cdn.scoreplay.io/file', is_scoreplay: true }] } });
    assert.equal(new Headers(init?.headers).has('X-ScorePlay-Api-Key'), false);
    assert.equal(init?.redirect, 'error');
    return new Response('test');
  });
  assert.equal((await client.download('123', new AbortController().signal)).bytes.length, 4);
  assert.equal(paths.length, 3);
  await assert.rejects(() => client.download('../whoami', new AbortController().signal));
});

test('production ScorePlay library access defaults to denied', () => {
  const previous = process.env.SCOREPLAY_ALLOWED_USER_IDS;
  try {
    delete process.env.SCOREPLAY_ALLOWED_USER_IDS;
    assert.equal(scorePlayAllowed('another-user'), false);
    process.env.SCOREPLAY_ALLOWED_USER_IDS = 'owner-one, owner-two';
    assert.equal(scorePlayAllowed('owner-one'), true);
    assert.equal(scorePlayAllowed('owner'), false);
  } finally { if (previous === undefined) delete process.env.SCOREPLAY_ALLOWED_USER_IDS; else process.env.SCOREPLAY_ALLOWED_USER_IDS = previous; }
});

test('a truncated storage response cannot become an imported video', async () => {
  const client = new ScorePlayClient('private-key', async url => {
    if (String(url).endsWith('/media/123')) return Response.json({ type: 'video' });
    if (String(url).includes('/formats/download')) return Response.json({ items: { a: [{ id: 'a', file_name: 'game.mp4', size: 100, mime_type: 'video/mp4', file_url: 'https://cdn.scoreplay.io/file', is_scoreplay: true }] } });
    return new Response('short');
  });
  await assert.rejects(() => client.download('123', new AbortController().signal), /incomplete/);
});

test('direct ScorePlay source resolution supports recordings beyond the browser upload limit', async () => {
  const client = new ScorePlayClient('private-key', async url => String(url).endsWith('/media/123')
    ? Response.json({ type: 'video', name: 'full-game.mp4', duration: 10800 })
    : Response.json({ items: { a: [{ id: 'a', file_name: 'full-game.mp4', size: 2 * 1024 ** 3, mime_type: 'video/mp4', file_url: 'https://cdn.scoreplay.io/full-game.mp4', is_scoreplay: true, status: 'active' }] } }));
  const source = await client.source('123');
  assert.equal(source.bytes, 2 * 1024 ** 3); assert.equal(source.duration, 10800);
});

test('a transient metadata connection retries once using the same deadline and private server credentials', async () => {
  let calls = 0;
  let deadline: AbortSignal | null | undefined;
  const client = new ScorePlayClient('private-key', async (_url, init) => {
    calls++;
    assert.equal(new Headers(init?.headers).get('X-ScorePlay-Api-Key'), 'private-key');
    if (calls === 1) {
      deadline = init?.signal;
      throw new TypeError('fetch failed', { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } });
    }
    assert.equal(init?.signal, deadline, 'a retry must not reset the total deadline');
    return Response.json({ media: [{ ID: 123, name: 'game.mp4', type: 'video' }], count: 1 });
  });
  assert.equal((await client.search('')).length, 1);
  assert.equal(calls, 2);
});

test('repeated network failures stop after two attempts and expose no credentials', async () => {
  let calls = 0;
  const client = new ScorePlayClient('private-key', async () => {
    calls++;
    throw new TypeError('fetch failed', { cause: { code: 'ECONNRESET' } });
  });
  await assert.rejects(() => client.search(''), error => error instanceof Error && /temporarily unreachable/.test(error.message) && !error.message.includes('private-key'));
  assert.equal(calls, 2);
});

test('authentication errors and certificate failures are never retried', async () => {
  for (const mode of ['authentication', 'certificate']) {
    let calls = 0;
    const client = new ScorePlayClient('private-key', async () => {
      calls++;
      if (mode === 'authentication') return Response.json({}, { status: 403 });
      throw new TypeError('fetch failed', { cause: { code: 'CERT_HAS_EXPIRED' } });
    });
    await assert.rejects(() => client.search(''));
    assert.equal(calls, 1);
  }
});
