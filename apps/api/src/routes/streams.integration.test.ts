import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import { generateAccessToken } from '../lib/auth';
import streams from './streams';
import { db } from '../db/client';
import { newStreamKey, streamKeyHash, youtubeId, playbackTicket } from '../lib/stream-security';
import { serve } from '@hono/node-server';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { S3Client, CreateBucketCommand } from '@aws-sdk/client-s3';

// Opt-in only. This suite refuses to connect to any database without a stream_test name.
const url = process.env.DATABASE_URL || '';
const target = new URL(url);
if (target.pathname !== '/stream_test' || target.hostname !== '127.0.0.1' || target.port !== '55439') throw new Error('Use the isolated local stream_test database on port 55439');
const connection = postgres(url, { max: 1 });
const app = new Hono(); app.route('/streams', streams);
// API payloads are asserted below; preserve flexible fixture types at this test boundary.
const request = app.request.bind(app) as (...args: Parameters<typeof app.request>) => Promise<Omit<Response, 'json'> & { json(): Promise<any> }>;
const alice = randomUUID(); const bob = randomUUID(); let aliceToken: string; let bobToken: string;
const headers = (token: string) => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });
const post = (route: string, body: unknown, token?: string) => request(`/streams${route}`, { method: 'POST', headers: token ? headers(token) : { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
before(async () => {
  await connection`CREATE TABLE IF NOT EXISTS users (id uuid PRIMARY KEY)`;
  await connection.unsafe(readFileSync(new URL('../db/migrations/0027_personal_streaming.sql', import.meta.url), 'utf8'));
  await connection`INSERT INTO users(id) VALUES (${alice}), (${bob})`;
  aliceToken = await generateAccessToken({ sub: alice, email: 'alice@example.test', role: 'USER', name: 'Alice' });
  bobToken = await generateAccessToken({ sub: bob, email: 'bob@example.test', role: 'USER', name: 'Bob' });
  Object.assign(process.env, { MEDIAMTX_RTMP_URL: 'rtmp://camera.example.test:1935', MEDIAMTX_HLS_URL: 'https://live.example.test', MEDIAMTX_API_URL: 'http://127.0.0.1:59999', MEDIAMTX_SERVICE_PASSWORD: 'test-service-secret' });
});
after(async () => { await connection.end(); await (db as unknown as { $client: { end(): Promise<void> } }).$client.end(); });

test('protected library and write routes require a real account', async () => {
  for (const path of ['/mine', '/favorites', '/broadcasts', '/videos/upload']) {
    const r = await request(`/streams${path}`, path === '/mine' ? {} : { method: 'POST' }); assert.equal(r.status, 401);
  }
});
test('two users have independent favorites, safe URLs, and owner-scoped deletion', async () => {
  const payload = { videoId: 'https://youtu.be/abcdefghijk', title: 'Game recap', sport: 'Soccer' };
  assert.equal((await post('/favorites', payload, aliceToken)).status, 200);
  await post('/favorites', payload, aliceToken);
  let a = await (await request('/streams/mine', { headers: headers(aliceToken) })).json();
  const b = await (await request('/streams/mine', { headers: headers(bobToken) })).json();
  assert.equal(a.data.favorites.length, 1); assert.equal(b.data.favorites.length, 0);
  assert.equal((await request(`/streams/favorites/${a.data.favorites[0].id}`, { method: 'DELETE', headers: headers(bobToken) })).status, 404);
  assert.equal((await post('/favorites', { ...payload, videoId: 'https://youtube.com.evil.test/watch?v=abcdefghijk' }, aliceToken)).status, 400);
  await request(`/streams/favorites/${a.data.favorites[0].id}`, { method: 'DELETE', headers: headers(aliceToken) });
  a = await (await request('/streams/mine', { headers: headers(aliceToken) })).json(); assert.equal(a.data.favorites.length, 0);
});
test('publishing credentials are hashed, owner-only, revocable, and scoped to one broadcast', async () => {
  const r = await post('/broadcasts', { title: 'Test game', sport: 'Soccer', rightsConfirmed: true }, aliceToken);
  assert.equal(r.status, 201); const { data: created } = await r.json();
  const key = new URL(created.publishUrl).searchParams.get('pass')!;
  const rows = await connection`SELECT key_hash FROM stream_broadcasts WHERE id=${created.id}`;
  assert.equal(rows[0].key_hash, streamKeyHash(key)); assert.notEqual(rows[0].key_hash, key);
  const auth = { user: created.id, password: key, action: 'publish', path: `broadcasts/${created.id}` };
  assert.equal((await post('/media-auth', auth)).status, 204);
  assert.equal((await post('/media-auth', { ...auth, password: newStreamKey() })).status, 401);
  assert.equal((await post('/media-auth', { ...auth, path: `broadcasts/${randomUUID()}` })).status, 401);
  assert.equal((await post('/media-auth', { action: 'playback', path: auth.path })).status, 401);
  assert.equal((await post(`/broadcasts/${created.id}/credentials`, {}, bobToken)).status, 404);
  assert.equal((await post(`/broadcasts/${created.id}/end`, {}, bobToken)).status, 404);
  assert.equal((await request(`/streams/broadcasts/${created.id}/recordings`, { headers: headers(bobToken) })).status, 404);
  const mine = await (await request('/streams/mine', { headers: headers(aliceToken) })).json();
  assert.equal(mine.data.broadcasts[0].keyHash, undefined); assert.equal(mine.data.broadcasts[0].publishUrl, undefined);
  const rotated = await (await post(`/broadcasts/${created.id}/credentials`, {}, aliceToken)).json();
  assert.equal((await post('/media-auth', auth)).status, 401);
  const next = new URL(rotated.data.publishUrl).searchParams.get('pass');
  assert.equal((await post('/media-auth', { ...auth, password: next })).status, 204);
  // Unreachable media server still revokes new camera connections without claiming a successful kick.
  assert.equal((await post(`/broadcasts/${created.id}/end`, {}, aliceToken)).status, 503);
  assert.equal((await post('/media-auth', { ...auth, password: next })).status, 401);
});
test('private recording and upload access cannot cross accounts', async () => {
  const id = randomUUID(); await connection`INSERT INTO stream_videos(id,owner_id,title,sport,object_key,content_type,file_size,ready) VALUES (${id},${alice},'Private match','Soccer','test-key','video/mp4',100,true)`;
  assert.equal((await request(`/streams/videos/${id}/play`, { headers: headers(bobToken) })).status, 404);
  assert.equal((await post(`/videos/${id}/complete`, {}, bobToken)).status, 404);
  assert.equal((await request(`/streams/videos/${id}`, { method: 'DELETE', headers: headers(bobToken) })).status, 404);
  assert.equal((await request('/streams/recording-playback?id=bad')).status, 403);
  process.env.MEDIAMTX_PLAYBACK_URL = 'http://127.0.0.1:59998';
  const params = { id: randomUUID(), start: '2026-10-20T10:00:00Z', duration: '60', expires: String(Date.now() - 1000), ticket: '' };
  params.ticket = playbackTicket(`${params.id}|${params.start}|60|${params.expires}`, process.env.MEDIAMTX_SERVICE_PASSWORD!);
  assert.equal((await request(`/streams/recording-playback?${new URLSearchParams(params)}`)).status, 403);
});
test('YouTube parser accepts supported formats and rejects unrelated origins', () => {
  assert.equal(youtubeId('https://www.youtube.com/shorts/abcdefghijk'), 'abcdefghijk');
  assert.equal(youtubeId('https://www.youtube.com/live/abcdefghijk'), 'abcdefghijk');
  assert.equal(youtubeId('javascript:alert(1)'), null); assert.equal(youtubeId('https://evil.test/?v=abcdefghijk'), null);
});

test('real RTMP broadcast becomes HLS, private replay, and an archived S3 recording', { skip: process.env.RUN_LIVE_STREAM_TEST !== '1', timeout: 240000 }, async () => {
  const exec = promisify(execFile);
  const docker = (...args: string[]) => exec('docker', args, { timeout: 180000, maxBuffer: 1024 * 1024 });
  const server = serve({ fetch: app.fetch, hostname: '0.0.0.0', port: 55440 });
  try {
    Object.assign(process.env, { MEDIAMTX_RTMP_URL: 'rtmp://127.0.0.1:51935', MEDIAMTX_HLS_URL: 'http://127.0.0.1:58888', MEDIAMTX_API_URL: 'http://127.0.0.1:59997', MEDIAMTX_PLAYBACK_URL: 'http://127.0.0.1:59996', AWS_ACCESS_KEY_ID: 'stream-test-access', AWS_SECRET_ACCESS_KEY: 'stream-test-secret-only-123456789', S3_ENDPOINT: 'http://127.0.0.1:59000', STREAM_S3_PUBLIC_ENDPOINT: 'http://127.0.0.1:59000', STREAM_S3_BUCKET: 'stream-test-recordings' });
    await docker('run', '--detach', '--rm', '--name', 'matchwatch-live-test-media', '-p', '127.0.0.1:51935:1935', '-p', '127.0.0.1:58888:8888', '-p', '127.0.0.1:59997:9997', '-p', '127.0.0.1:59996:9996', '-e', 'MTX_RTSP=no', '-e', 'MTX_WEBRTC=no', '-e', 'MTX_SRT=no', '-e', 'MTX_MOQ=no', '-e', 'MTX_HLSVARIANT=mpegts', '-e', 'MTX_API=yes', '-e', 'MTX_PLAYBACK=yes', '-e', 'MTX_AUTHMETHOD=http', '-e', 'MTX_AUTHHTTPADDRESS=http://host.docker.internal:55440/streams/media-auth', '-e', 'MTX_AUTHHTTPEXCLUDE=[]', '-e', 'MTX_PATHDEFAULTS_RECORD=yes', '-e', 'MTX_PATHDEFAULTS_RECORDSEGMENTDURATION=5s', '-e', 'MTX_PATHDEFAULTS_OVERRIDEPUBLISHER=no', process.env.MEDIAMTX_TEST_IMAGE || 'bluenviron/mediamtx:1.21.2-ffmpeg');
    await docker('run', '--detach', '--rm', '--name', 'matchwatch-live-test-storage', '-p', '127.0.0.1:59000:9000', '-e', 'MINIO_ROOT_USER=stream-test-access', '-e', 'MINIO_ROOT_PASSWORD=stream-test-secret-only-123456789', 'ghcr.io/coollabsio/minio:latest', 'server', '/data');
    const s3 = new S3Client({ endpoint: process.env.S3_ENDPOINT, region: 'us-east-1', forcePathStyle: true, credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID!, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY! } });
    for (let i = 0; ; i++) {
      try { await s3.send(new CreateBucketCommand({ Bucket: process.env.STREAM_S3_BUCKET })); break; }
      catch(e) { if (i >= 20) throw e; await new Promise(r => setTimeout(r, 500)); }
    }
    const { data: b } = await (await post('/broadcasts', { title: 'Real test broadcast', sport: 'Basketball', rightsConfirmed: true }, aliceToken)).json();
    const publish = b.publishUrl.replace('127.0.0.1:51935', '127.0.0.1:1935');
    const encoder = docker('exec', 'matchwatch-live-test-media', 'ffmpeg', '-hide_banner', '-loglevel', 'error', '-re', '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=15', '-f', 'lavfi', '-i', 'sine=frequency=1000:sample_rate=44100', '-t', '20', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'ultrafast', '-g', '15', '-c:a', 'aac', '-f', 'flv', publish);
    // Attach rejection handling immediately so an encoder failure never becomes unhandled.
    const finished = encoder.then(() => null, e => e as Error);
    let live = false;
    for (let i = 0; i < 30; i++) {
      const response = await (await request(`/streams/watch/${b.id}`)).json();
      if (response.data.live) { live = true; break; }
      await new Promise(r => setTimeout(r, 500));
    }
    assert.equal(live, true, 'MediaMTX reports actual ready camera');
    const hls = await fetch(`http://127.0.0.1:58888/broadcasts/${b.id}/index.m3u8`);
    assert.equal(hls.status, 200); assert.match(await hls.text(), /#EXTM3U/);
    const stop = await post(`/broadcasts/${b.id}/end`, {}, aliceToken);
    assert.equal(stop.status, 200, await stop.text());
    // A deliberately disconnected publisher may finish with a broken-pipe error.
    await finished;
    let segments: { start: string; duration: number; url: string }[] = [];
    for (let i = 0; i < 20; i++) {
      const r = await request(`/streams/broadcasts/${b.id}/recordings`, { headers: headers(aliceToken) });
      assert.equal(r.status, 200); segments = (await r.json()).data;
      if (segments.length) break; await new Promise(r => setTimeout(r, 500));
    }
    assert.ok(segments.length > 0, 'Recorded segments are in the owner library');
    const privateRecording = await request(segments[0].url.replace('/api/v1', ''));
    assert.equal(privateRecording.status, 200); assert.ok((await privateRecording.arrayBuffer()).byteLength > 0);
    const archive = await post(`/broadcasts/${b.id}/archive`, { start: segments[0].start, duration: segments[0].duration }, aliceToken);
    assert.equal(archive.status, 200, await archive.text());
    const mine = await (await request('/streams/mine', { headers: headers(aliceToken) })).json();
    const saved = mine.data.videos.find((v: { title: string }) => v.title.startsWith('Real test broadcast'));
    assert.ok(saved);
    const play = await (await request(`/streams/videos/${saved.id}/play`, { headers: headers(aliceToken) })).json();
    const file = await fetch(play.data.url); assert.equal(file.status, 200); assert.ok((await file.arrayBuffer()).byteLength > 0);
    const videoBytes = Buffer.from('small-test-video');
    const upload = await (await post('/videos/upload', { title: 'Uploaded video', sport: 'Soccer', contentType: 'video/mp4', fileSize: videoBytes.length }, aliceToken)).json();
    const put = await fetch(upload.data.uploadUrl, { method: 'PUT', headers: upload.data.headers, body: videoBytes });
    assert.equal(put.status, 200, await put.text());
    assert.equal((await post(`/videos/${upload.data.id}/complete`, {}, bobToken)).status, 404);
    assert.equal((await post(`/videos/${upload.data.id}/complete`, {}, aliceToken)).status, 200);
    assert.equal((await request(`/streams/videos/${saved.id}`, { method: 'DELETE', headers: headers(aliceToken) })).status, 200);
    const end = await post(`/broadcasts/${b.id}/end`, {}, aliceToken); assert.equal(end.status, 200);
  } finally {
    await docker('stop', 'matchwatch-live-test-media').catch(() => {});
    await docker('stop', 'matchwatch-live-test-storage').catch(() => {});
    await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
  }
});
