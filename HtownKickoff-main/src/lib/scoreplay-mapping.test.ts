import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir, readFile, writeFile } from 'node:fs/promises';
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
test('asset custom IDs map renamed files and conflicting IDs never fall back to filenames', () => {
  const videos = [{ ID: 123, name: 'solanke over the bar.mp4', type: 'video', duration: 28 }, { ID: 124, name: 'X S1 JAM-423A-.mov', type: 'video', duration: 21 }];
  const indexed = { ...entry('1', 'renamed-by-organizer.mp4', 28), asset_user_metadata: { custom_id: '123' } };
  const mapping = mapScorePlayVideos(videos, [indexed], 'custom_id').mappings['123'];
  assert.equal(mapping.matchedBy, 'metadata'); assert.equal(mapping.metadataKey, 'asset.user_metadata.custom_id');
  assert.equal(mapping.assetId, asset); assert.equal(mapping.twelvelabsVideoId, indexed._id);
  assert.equal(mapScorePlayVideos(videos, [indexed]).mappings['123'].matchedBy, 'metadata');
  const conflicting = { ...indexed, system_metadata: { filename: videos[0].name, duration: 28 }, user_metadata: { custom_id: 124 } };
  const rejected = mapScorePlayVideos(videos, [conflicting]);
  assert.equal(Object.keys(rejected.mappings).length, 0); assert.equal(rejected.unmapped.length, 2);
});

test('index pagination retrieves every page and caches full metadata on disk until the count or refresh changes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'matchwatch-map-test-')); let count = 2, lists = 0, details = 0, assetReads = 0;
  const first = entry('1', 'solanke over the bar.mp4', 28), second = entry('2', 'X S1 JAM-423A-.mov', 21);
  const labs = new TwelveLabsClient('synthetic-team-key', index, async (url, init) => {
    assert.notEqual(init?.method, 'POST'); const path = String(url);
    if (path.endsWith(`/assets/${asset}`)) { assetReads++; return Response.json({ _id: asset, status: 'ready', user_metadata: {} }); }
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
    let report = await service.diagnostics(); assert.equal(report.mappedCount, 2); assert.equal(lists, 2); assert.equal(details, 2); assert.equal(assetReads, 1);
    service = new ScorePlayMappingService(labs, scoreplay, index, root); report = await service.diagnostics(); assert.equal(lists, 2); assert.equal(details, 2); assert.equal(assetReads, 1);
    assert.equal(report.mappings['123'].matchedBy, 'filename'); assert.ok((await readdir(root)).some(name => name.endsWith('-mapping.json')));
    count = 3; service = new ScorePlayMappingService(labs, scoreplay, index, root); await service.diagnostics(); assert.equal(lists, 4);
    await service.diagnostics(true); assert.equal(lists, 6);
    await assert.rejects(() => service.resolve({ ID: 999, name: 'missing.mp4', type: 'video' }), (error: unknown) => {
      assert.ok(error instanceof Error && 'status' in error && error.status === 409);
      assert.match(error.message, /missing.mp4.*connected TwelveLabs index "Synthetic shared fixture"/);
      assert.match(error.message, /authorized team key.*Refresh AI mapping/);
      assert.doesNotMatch(error.message, /isn't in the TwelveLabs index yet|Ask the organizers to index it|synthetic-team-key|synthetic-scoreplay-key/);
      return true;
    });
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('mapping fetches asset metadata, survives restart and replaces caches that omitted custom IDs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'matchwatch-asset-map-test-')); let assetReads = 0;
  const indexed = entry('1', 'renamed-in-twelvelabs.mp4', 28);
  const labs = new TwelveLabsClient('synthetic-key', index, async (url, init) => {
    assert.notEqual(init?.method, 'POST'); const path = String(url);
    if (path.endsWith(`/indexes/${index}`)) return Response.json({ _id: index, index_name: 'Synthetic fixture', video_count: 1 });
    if (path.includes('/indexed-assets?')) return Response.json({ data: [{ _id: indexed._id }], page_info: { total_page: 1 } });
    if (path.endsWith(`/indexed-assets/${indexed._id}`)) return Response.json(indexed);
    assert.ok(path.endsWith(`/assets/${asset}`)); assetReads++;
    return Response.json({ _id: asset, status: 'ready', user_metadata: { custom_id: '123' } });
  });
  const scoreplay = new ScorePlayClient('synthetic-key', async url => {
    assert.ok(String(url).includes('/media/search?'));
    return Response.json({ media: [{ ID: 123, name: 'solanke over the bar.mp4', type: 'video', duration: 28 }], total_pages: 1 });
  });
  const video = { ID: 123, name: 'solanke over the bar.mp4', type: 'video', duration: 28 };
  try {
    let service = new ScorePlayMappingService(labs, scoreplay, index, root);
    assert.equal((await service.resolve(video)).metadataKey, 'asset.user_metadata.custom_id'); assert.equal(assetReads, 1);
    service = new ScorePlayMappingService(labs, scoreplay, index, root);
    assert.equal((await service.resolve(video)).matchedBy, 'metadata'); assert.equal(assetReads, 1);
    const filename = (await readdir(root)).find(name => name.endsWith('.json') && !name.endsWith('-mapping.json'))!;
    const path = join(root, filename), old = JSON.parse(await readFile(path, 'utf8'));
    old.version = 1; delete old.entries[0].asset_user_metadata; await writeFile(path, JSON.stringify(old));
    service = new ScorePlayMappingService(labs, scoreplay, index, root);
    assert.equal((await service.resolve(video)).metadataKey, 'asset.user_metadata.custom_id'); assert.equal(assetReads, 2);
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
