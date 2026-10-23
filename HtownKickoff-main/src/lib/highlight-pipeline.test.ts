import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { HighlightPipeline, parsePipelineInput } from './highlight-pipeline';
import { PipelineStore } from './pipeline-store';
import { TwelveLabsClient } from './twelvelabs';
import { ScorePlayClient } from './scoreplay';
import { buildStoryDraft } from './story-builder';
import { captureHls, downloadTo, parseHls, publicIPv4, runMedia } from './pipeline-media';
import { processingTempRoot, withProcessingTemp } from './processing-temp';
import type { JevReview } from './jev';
import type { PipelineInput, SourceOutput, StepNumber, StoryDraft } from './pipeline-types';
import type { HighlightClip, HighlightEvent } from './highlight-plan';

const assetId = '111111111111111111111111', indexId = '222222222222222222222222', indexedId = '333333333333333333333333', taskId = '444444444444444444444444';
function input(): PipelineInput { return parsePipelineInput({ matchId: 'synthetic-game', title: 'Synthetic pipeline test', sport: 'Basketball', duration: 100, target: 60, queries: ['Dunk'], before: 5, after: 10, scoringPriority: 'balanced', source: { kind: 'upload', name: 'fixture.mp4' }, fusion: { matchId: 'synthetic-game', stats: [], posts: [], anchors: [], videoUtc: '', reactionDelay: 15, tolerance: 10 } }); }
function review(event: { id: string; start: number; end: number }): JevReview { return { candidate_id: event.id, event: 'Dunk', importance_estimate: .9, excitement_estimate: .8, watchability_estimate: .8, emotional_intensity: { score: .7, evidence: 'Synthetic fixture: visible celebration.' }, controversy_surprise: { score: null, evidence: 'Unavailable in fixture.' }, match_context: null, duplicate_of: null, suggested_start: event.start, suggested_end: event.end, recommend_include: true, reason: 'Synthetic test evidence only.', needs_review: false }; }
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'matchwatch-pipeline-test-')), store = new PipelineStore(root);
  const counts = { upload: 0, indexing: 0, review: 0, poll: 0 }; let reviews: JevReview[] = [];
  const labs = new TwelveLabsClient('synthetic-test-key', indexId, async (url, init) => {
    const path = String(url);
    if (path.endsWith('/assets') && init?.method === 'POST') { counts.upload++; return Response.json({ _id: assetId }); }
    if (path.endsWith(`/assets/${assetId}`)) return Response.json({ status: 'ready', system_metadata: { duration: 100 } });
    if (path.endsWith('/indexed-assets') && init?.method === 'POST') { counts.indexing++; return Response.json({ _id: indexedId }); }
    if (path.endsWith(`/indexed-assets/${indexedId}`)) return Response.json({ _id: indexedId, asset_id: assetId, status: 'ready', system_metadata: { duration: 100 } });
    if (path.endsWith('/search')) return Response.json({ data: [{ video_id: indexedId, start: 10, end: 16 }, { video_id: indexedId, start: 50, end: 57 }] });
    if (path.endsWith('/analyze/tasks') && init?.method === 'POST') {
      counts.review++; const body = JSON.parse(String(init.body)), marker = '\nCandidate data: ';
      reviews = JSON.parse(body.prompt.slice(body.prompt.lastIndexOf(marker) + marker.length)).map(review);
      return Response.json({ task_id: taskId });
    }
    if (path.endsWith(`/analyze/tasks/${taskId}`)) { counts.poll++; return counts.poll % 2 ? Response.json({ status: 'processing' }) : Response.json({ status: 'ready', result: { data: JSON.stringify({ reviews }) } }); }
    throw new Error(`Unexpected test endpoint: ${path}`);
  });
  return { root, store, labs, pipeline: new HighlightPipeline(store, () => labs), counts };
}
test('seven persisted stages resume provider tasks, isolate owners and invalidate downstream outputs', async () => {
  const f = await fixture();
  try {
    let job = await f.pipeline.create('owner-a', input(), new File(['synthetic bytes'], 'fixture.mp4'));
    assert.equal(job.steps[0].state, 'ready');
    assert.equal(f.counts.upload, 1);
    await assert.rejects(() => f.pipeline.run('owner-a', job.id, 4), /previous step/);
    for (let attempt = 0; attempt < 15 && job.steps[1].state !== 'ready'; attempt++) {
      // Construct a new service instance to model a page refresh or process restart.
      const resumed = new HighlightPipeline(f.store, () => f.labs);
      job = await resumed.run('owner-a', job.id, 2);
    }
    assert.equal(job.steps[1].state, 'ready'); assert.equal(f.counts.indexing, 1); assert.equal(f.counts.review, 1); assert.equal(f.counts.poll, 2);
    for (let step = 3; step <= 7; step++) job = await f.pipeline.run('owner-a', job.id, step as StepNumber);
    assert.ok(job.steps.every(step => step.state === 'ready'));
    const story = (await f.store.artifact<StoryDraft>('owner-a', job.id, 7)).data;
    assert.equal(story.contract_status, 'awaiting_team_contract'); assert.equal(story.timebase, 'recording_seconds'); assert.equal(story.clips.length, 2);
    assert.ok(story.total_duration_seconds <= 60); assert.equal(story.downstream.final_render_status, 'not_started');
    assert.equal(JSON.stringify(story).includes('synthetic-test-key'), false);
    await assert.rejects(() => f.store.job('owner-b', job.id), /unavailable/);
    assert.equal((await f.store.list('owner-a')).length, 1); assert.equal((await f.store.list('owner-b')).length, 0);
    job = await f.pipeline.run('owner-a', job.id, 3, true);
    assert.equal(job.steps[2].revision, 2); assert.ok(job.steps.slice(3).every(step => step.state === 'stale'));
    await assert.rejects(() => f.pipeline.run('owner-a', job.id, 7), /previous step/);
    assert.equal(f.counts.review, 1);
    const replayed = await f.pipeline.run('owner-a', job.id, 2, true);
    assert.equal(replayed.steps[1].state, 'working'); assert.equal(f.counts.indexing, 1);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});
test('failed uploads are durable errors and can be retried with the selected file', async () => {
  const f = await fixture();
  try {
    let job = await f.pipeline.create('owner', input()); assert.equal(job.steps[0].state, 'error');
    job = await f.pipeline.run('owner', job.id, 1, true, new File(['fixture'], 'fixture.mp4')); assert.equal(job.steps[0].state, 'ready');
  } finally { await rm(f.root, { recursive: true, force: true }); }
});
test('local media is removed after success and failure under the same processing root', async () => {
  let succeeded = '', failed = '';
  await withProcessingTemp(async folder => { succeeded = folder; assert.equal(join(folder, '..'), processingTempRoot()); await writeFile(join(folder, 'video.mp4'), 'synthetic'); });
  await assert.rejects(() => withProcessingTemp(async folder => { failed = folder; await writeFile(join(folder, 'segment.bin'), 'synthetic'); throw new Error('fixture failure'); }), /fixture failure/);
  await assert.rejects(() => readdir(succeeded), { code: 'ENOENT' }); await assert.rejects(() => readdir(failed), { code: 'ENOENT' });
});
test('job lock prevents concurrent mutations and never accepts path traversal', async () => {
  const f = await fixture();
  try {
    const job = await f.store.create('owner', input()); let unlock!: () => void;
    const first = f.store.locked('owner', job.id, () => new Promise<void>(resolve => { unlock = resolve; }));
    while (!unlock) await new Promise(resolve => setTimeout(resolve, 5));
    await assert.rejects(() => f.store.locked('owner', job.id, async () => {}), /already processing/); unlock(); await first;
    await assert.rejects(() => f.store.job('owner', '../other-owner'), /Invalid pipeline job/);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});
test('HLS manifests preserve sequence and UTC, resolve variants, and reject unsafe formats', () => {
  const parsed = parseHls('#EXTM3U\n#EXT-X-MEDIA-SEQUENCE:90\n#EXT-X-PROGRAM-DATE-TIME:2026-10-22T18:00:00Z\n#EXTINF:6,\na.ts\n#EXTINF:6,\nb.ts', 'https://media.example.org/live/index.m3u8');
  assert.equal(parsed.segments[0].sequence, 90); assert.equal(parsed.segments[1].utc, '2026-10-22T18:00:06.000Z'); assert.equal(parsed.segments[0].url, 'https://media.example.org/live/a.ts');
  assert.equal(parseHls('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000\n720p.m3u8', 'https://media.example.org/index.m3u8').variant, 'https://media.example.org/720p.m3u8');
  assert.throws(() => parseHls('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="http://localhost/key"', 'https://media.example.org/live'), /Encrypted/);
  assert.throws(() => parseHls('#EXTM3U\n#EXT-X-BYTERANGE:10@0\n#EXTINF:6,\na.ts', 'https://media.example.org/live'), /byte-range/);
  for (const ip of ['127.0.0.1','10.0.1.12','169.254.169.254','172.16.1.1','192.168.1.1','100.64.1.1','0.0.0.0','224.0.0.1','::1']) assert.equal(publicIPv4(ip), false);
  assert.equal(publicIPv4('8.8.8.8'), true);
});
test('story builder preserves source seconds and rejects duplicate, overlapping and over-budget clips', () => {
  const source: SourceOutput = { input: input(), source: { kind: 'upload', name: 'fixture.mp4', assetId }, duration: 100, temporaryFilesDeleted: true };
  const event: HighlightEvent = { id: 'a', label: 'Dunk', start: 10, end: 16, confidence: 0, importance: 0, context: 0, audio: 0, reaction: 0, preference: 0 };
  const clip: HighlightClip = { ...event, score: .8, clipStart: 10, clipEnd: 16 };
  assert.equal(buildStoryDraft('job', source, [clip]).clips[0].timeline_in_seconds, 0);
  assert.throws(() => buildStoryDraft('job', source, [clip, clip]), /duplicate/);
  assert.throws(() => buildStoryDraft('job', source, [clip, { ...clip, id: 'b', clipStart: 15, clipEnd: 20 }]), /overlap/);
  assert.throws(() => buildStoryDraft('job', source, [{ ...clip, clipStart: -1 }]), /unsafe/);
  assert.throws(() => buildStoryDraft('job', { ...source, input: { ...source.input, target: 3 } }, [clip]), /exceeds/);
});
test('pipeline input cannot inject asset IDs, paths or evidence from another match', () => {
  const raw = input(); raw.source.assetId = assetId;
  assert.equal(parsePipelineInput(raw).source.assetId, undefined);
  assert.throws(() => parsePipelineInput({ ...raw, fusion: { ...raw.fusion, matchId: 'other' } }), /this match/);
  assert.throws(() => parsePipelineInput({ ...raw, queries: [] }), /eight queries/);
  assert.throws(() => parsePipelineInput({ ...raw, target: 301 }), /300/);
});
test('organizer mapping reuses the actual indexed asset instead of re-uploading ScorePlay media', async () => {
  const f = await fixture(), previousAllowed = process.env.SCOREPLAY_ALLOWED_USER_IDS;
  try {
    process.env.SCOREPLAY_ALLOWED_USER_IDS = 'mapped-owner';
    const service = new HighlightPipeline(f.store, () => f.labs, () => new ScorePlayClient('synthetic', async () => Response.json({ ID: 123, name: 'Synthetic mapped fixture', type: 'video', duration: 100 })), async () => ({ twelvelabsVideoId: indexedId, assetId, matchedBy: 'metadata', duration: 100 }));
    const source = { ...input(), source: { kind: 'scoreplay' as const, name: 'Synthetic mapped fixture', mediaId: '123' } };
    let job = await service.create('mapped-owner', source); assert.equal(job.steps[0].state, 'ready');
    const saved = await f.store.artifact<SourceOutput>('mapped-owner', job.id, 1);
    assert.equal(saved.data.source.assetId, assetId); assert.equal(saved.data.source.indexedAssetId, indexedId);
    job = await service.run('mapped-owner', job.id, 2);
    assert.equal(f.counts.upload, 0); assert.equal(f.counts.indexing, 0);
    const denied = await service.create('unrelated-owner', source); assert.equal(denied.steps[0].state, 'error');
  } finally {
    if (previousAllowed === undefined) delete process.env.SCOREPLAY_ALLOWED_USER_IDS; else process.env.SCOREPLAY_ALLOWED_USER_IDS = previousAllowed;
    await rm(f.root, { recursive: true, force: true });
  }
});
test('unsafe HLS URLs are rejected before a file or network connection can be opened', async () => {
  for (const url of ['http://cdn.example.org/video.ts', 'https://cdn.example.org:444/video.ts', 'https://user:password@cdn.example.org/video.ts', 'https://unlisted.example.org/video.ts']) {
    await assert.rejects(() => downloadTo(url, 'never-created-test-file', 100, ['cdn.example.org']), /not allowed/);
  }
});
test('abandoned working states turn into a visible resumable error', async () => {
  const f = await fixture();
  try {
    const job = await f.store.create('owner', input()); job.steps[0].state = 'working'; job.steps[0].updatedAt = new Date(Date.now() - 21 * 60000).toISOString(); await f.store.save('owner', job);
    const read = await f.store.job('owner', job.id); assert.equal(read.steps[0].state, 'error'); assert.match(read.steps[0].message, /Retry/);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});
test('real FFmpeg remuxes a synthetic HLS window using local files only and cleanup removes its video', async () => {
  const previous = process.env.HLS_ALLOWED_HOSTS; process.env.HLS_ALLOWED_HOSTS = 'synthetic.example.org'; let used = '';
  try {
    await withProcessingTemp(async folder => {
      used = folder;
      await runMedia(['-nostdin', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=360x360:rate=10', '-t', '12', '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-g', '10', '-f', 'hls', '-hls_time', '4', '-hls_list_size', '0', '-hls_segment_filename', join(folder, 'source-%03d.ts'), join(folder, 'source.m3u8')], 20000);
      const captured = await captureHls('https://synthetic.example.org/source.m3u8', 30, folder, undefined, async (url, destination) => {
        const source = join(folder, basename(new URL(url).pathname)); await copyFile(source, destination); return (await stat(destination)).size;
      });
      assert.equal(captured.duration, 12); assert.ok((await stat(captured.path)).size > 100); assert.equal(captured.mediaSequence, 0);
    });
    await assert.rejects(() => readdir(used), { code: 'ENOENT' });
  } finally { if (previous === undefined) delete process.env.HLS_ALLOWED_HOSTS; else process.env.HLS_ALLOWED_HOSTS = previous; }
});
