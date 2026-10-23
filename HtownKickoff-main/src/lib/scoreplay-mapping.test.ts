import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mapScorePlayVideos, ScorePlayMappingService } from './scoreplay-mapping';
import { TwelveLabsClient, type IndexedVideo } from './twelvelabs';
import { ScorePlayClient } from './scoreplay';

const index = '111111111111111111111111', asset = '222222222222222222222222';
const entry = (id: string, name: string, duration = 20, metadata: Record<string, unknown> = {}): IndexedVideo => ({ _id: id.padStart(24, '0'), asset_id: asset, status: 'ready', system_metadata: { filename: name, duration }, user_metadata: metadata });
test('ScorePlay IDs take precedence, metadata arrays and configurable keys are respected', () => {
  const videos = [{ ID: 123, name: 'solanke over the bar.mp4', type: 'video', duration: 28 }];
  const entries = [entry('1', 'different-name.mov', 28, { scoreplay_id: [123] }), entry('2', 'solanke_over_the_bar.MOV', 28)];
  const result = mapScorePlayVideos(videos, entries);
  assert.equal(result.mappings['123'].twelvelabsVideoId, entries[0]._id); assert.equal(result.mappings['123'].matchedBy, 'metadata');
  assert.equal(result.mappings['123'].assetId, asset); assert.equal(result.mappings['123'].metadataKey, 'scoreplay_id');
  assert.equal(mapScorePlayVideos(videos, entries, 'other_field').mappings['123'].matchedBy, 'filename');
});
test('filename matching ignores extension, case, spaces, underscores and punctuation; duration resolves unique ties', () => {
  const videos = [{ ID: 1, name: 'X S1 JAM-423A-.mov', type: 'video', duration: 21 }];
  const entries = [entry('1', 'x_s1_jam_423a.mp4', 50), entry('2', 'X S1 JAM 423A.MOV', 21)];
  assert.equal(mapScorePlayVideos(videos, entries).mappings['1'].twelvelabsVideoId, entries[1]._id);
  const ambiguous = mapScorePlayVideos(videos, [entries[1], { ...entries[1], _id: entries[0]._id }]);
  assert.equal(ambiguous.mappings['1'], undefined); assert.match(ambiguous.unmapped[0].reason, /Multiple/);
  assert.equal(mapScorePlayVideos(videos, [{ ...entries[1], asset_id: undefined }]).mappings['1'], undefined);
});
test('index pagination retrieves every page and caches full metadata on disk until the count or refresh changes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'matchwatch-map-test-')); let count = 2, lists = 0, details = 0;
  const first = entry('1', 'solanke over the bar.mp4', 28), second = entry('2', 'X S1 JAM-423A-.mov', 21);
  const labs = new TwelveLabsClient('synthetic-team-key', index, async (url, init) => {
    assert.notEqual(init?.method, 'POST'); const path = String(url);
    if (path.endsWith(`/indexes/${index}`)) return Response.json({ _id: index, index_name: 'Synthetic shared fixture', video_count: count });
    if (path.includes('/indexed-assets?')) { lists++; const page = new URL(path).searchParams.get('page'); return Response.json({ data: [page === '1' ? { _id: first._id } : { _id: second._id }], page_info: { total_page: 2 } }); }
    details++; return Response.json(path.endsWith(first._id) ? first : second);
  });
  const scoreplay = new ScorePlayClient('synthetic-scoreplay-key', async (url, init) => {
    assert.ok(String(url).includes('/media/search')); assert.equal(init?.method, 'POST');
    return Response.json({ media: [{ ID: 123, name: first.system_metadata!.filename, type: 'video', duration: 28 }, { ID: 124, name: second.system_metadata!.filename, type: 'video', duration: 21 }], total_pages: 1 });
  });
  try {
    let service = new ScorePlayMappingService(labs, scoreplay, index, root);
    let report = await service.diagnostics(); assert.equal(report.mappedCount, 2); assert.equal(lists, 2); assert.equal(details, 2);
    service = new ScorePlayMappingService(labs, scoreplay, index, root); report = await service.diagnostics(); assert.equal(lists, 2); assert.equal(details, 2);
    assert.equal(report.mappings['123'].matchedBy, 'filename'); assert.ok((await readdir(root)).some(name => name.endsWith('-mapping.json')));
    count = 3; service = new ScorePlayMappingService(labs, scoreplay, index, root); await service.diagnostics(); assert.equal(lists, 4);
    await service.diagnostics(true); assert.equal(lists, 6);
    await assert.rejects(() => service.resolve({ ID: 999, name: 'missing.mp4', type: 'video' }), /missing.mp4.*isn't in the TwelveLabs index/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('ScorePlay catalog paging includes all 123 media without downloading a file', async () => {
  const calls: string[] = [];
  const client = new ScorePlayClient('synthetic-key', async (url, init) => {
    const path = String(url); calls.push(path); assert.equal(init?.method, 'POST'); assert.ok(path.includes('/media/search?'));
    const page = Number(new URL(path).searchParams.get('page'));
    return Response.json({ media: Array.from({ length: page === 1 ? 100 : 23 }, (_, i) => ({ ID: (page - 1) * 100 + i + 1, name: `${i}.mp4`, type: 'video' })), total_pages: 2 });
  });
  assert.equal((await client.allVideos()).length, 123); assert.equal(calls.length, 2);
});
test('ScorePlay selected media resolves nested playback and duration without formats/download', async () => {
  const client = new ScorePlayClient('synthetic-key', async url => {
    assert.ok(String(url).endsWith('/media/123'));
    return Response.json({ ID: 123, name: 'solanke over the bar.mp4', type: 'video', duration: 0, video: { duration: 28, proxy_medium: 'https://cdn.scoreplay.io/source.mp4', stream: 'https://cdn.scoreplay.io/source.m3u8' } });
  });
  const media = await client.media('123'); assert.equal(media.duration, 28); assert.equal(media.proxy_medium, 'https://cdn.scoreplay.io/source.mp4');
});
