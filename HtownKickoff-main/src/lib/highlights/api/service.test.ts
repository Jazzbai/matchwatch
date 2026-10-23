import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { HighlightPipeline } from '../pipeline';
import { JobStore } from '../store';
import type { TwelveLabsClient } from '../twelvelabs';
import { ApiRequestError, parseProcessRequest } from './schema';
import { HighlightApiService, type ResolvedVideo, type ServiceDependencies } from './service';
import type { deliverWebhook, WebhookPayload } from './webhook';

// Synthetic TwelveLabs provider: the real ten-step pipeline runs end to end without network calls.
const INDEX = 'aaaaaaaaaaaaaaaaaaaaaaaa', INDEXED = 'bbbbbbbbbbbbbbbbbbbbbbbb', ASSET = 'cccccccccccccccccccccccc';
function fakeLabs() {
  const tasks = new Map<string, string[]>();
  return {
    indexId: INDEX,
    async asset() { return { _id: ASSET, status: 'ready' }; },
    async indexedAsset() {
      return { _id: INDEXED, asset_id: ASSET, status: 'ready', system_metadata: { duration: 600, filename: 'Spurs v United.mp4' },
        user_metadata: { scoreplay_id: '130851978' }, hls: { video_url: 'https://cdn.example/match.m3u8' } };
    },
    async search(_id: string, query: string) { return query.startsWith('Goal scored') ? [{ start: 100, end: 108, rank: 1 }, { start: 400, end: 410, rank: 2 }] : []; },
    async createAnalysis(_asset: string, _prompt: string, schema: { properties: { reviews: { items: { properties: { candidate_id: { enum: string[] } } } } } }) {
      const id = String(tasks.size + 1).padStart(24, 'd');
      tasks.set(id, schema.properties.reviews.items.properties.candidate_id.enum);
      return id;
    },
    async analysis(id: string) {
      return { status: 'ready', data: { reviews: tasks.get(id)!.map(candidateId => ({
        candidate_id: candidateId, event_type: 'goal', description: 'Synthetic goal', team: 'Spurs', players: ['Solanke'],
        importance: 0.9, excitement: 0.8, emotional_intensity: { score: 0.8, evidence: 'Synthetic celebration' },
        controversy_surprise: { score: 0.1, evidence: 'None' }, watchability: 0.9, is_replay: false, duplicate_of: null,
        suggested_start: -1, suggested_end: -1, needs_review: false, reason: 'Synthetic review',
      })) } };
    },
  };
}

type Setup = { resolveVideo?: (id: string) => Promise<ResolvedVideo>; deliver?: typeof deliverWebhook; checkWebhookHost?: ServiceDependencies['checkWebhookHost'] };
type Make = (overrides?: Partial<ServiceDependencies>) => HighlightApiService;
async function withService(work: (service: HighlightApiService, sent: WebhookPayload[], make: Make) => Promise<void>, setup: Setup = {}) {
  const root = await mkdtemp(join(tmpdir(), 'highlights-api-test-'));
  const sent: WebhookPayload[] = [];
  const make: Make = (overrides = {}) => new HighlightApiService({
    pipeline: new HighlightPipeline({
      store: new JobStore(join(root, 'jobs')), labs: () => fakeLabs() as unknown as TwelveLabsClient, xToken: () => undefined,
      rights: () => ({ licensedIndexIds: [INDEX], licensedHls: false, indexId: INDEX }), capture: async () => { throw new Error('No capture in tests.'); },
    }),
    resolveVideo: setup.resolveVideo ?? (async () => ({ indexedAssetId: INDEXED, name: 'Spurs v United' })),
    deliver: setup.deliver ?? (async (_url, payload) => { sent.push(payload); return { delivered: true, attempts: [{ at: '', status: 200 }], deliveryId: 'delivery-1' }; }),
    checkWebhookHost: setup.checkWebhookHost ?? (async () => '93.184.216.34'),
    root: join(root, 'api-jobs'), pollMs: 1, timeoutMs: 60_000, maxConcurrent: 2, log: () => {},
    ...overrides,
  });
  try { await work(make(), sent, make); } finally { await rm(root, { recursive: true, force: true }); }
}
const request = (webhook = true) => parseProcessRequest({ video_id: '130851978', ...(webhook ? { webhook_url: 'https://hooks.example.com/x' } : {}) });

test('returns a queued job immediately, then completes it with the pipeline’s highlights and notifies the webhook', () => withService(async (service, sent) => {
  const record = await service.submit('api:owner', request());
  assert.equal(record.status, 'queued');
  await service.idle();
  const done = await service.get('api:owner', record.job_id);
  assert.equal(done.status, 'completed', done.error ?? '');
  assert.ok(done.result!.highlights.length >= 1);
  const [first] = done.result!.highlights;
  assert.equal(first.event_type, 'goal');
  assert.ok(first.viral_score! > 0 && first.viral_score! <= 1);
  assert.equal(done.result!.key_moments.source.scoreplay_media_id, '130851978');
  assert.equal(done.webhook!.state, 'delivered');
  assert.deepEqual(sent.map(payload => [payload.event, payload.job_id]), [['job.completed', record.job_id]]);
  await assert.rejects(() => service.get('api:someone-else', record.job_id), (error: unknown) => error instanceof ApiRequestError && error.status === 404);
}));

test('does not block the request while processing runs', () => {
  let release!: () => void;
  const gate = new Promise<void>(done => { release = done; });
  return withService(async service => {
    const record = await service.submit('api:owner', request(false));
    await new Promise(done => setTimeout(done, 20));
    assert.equal((await service.get('api:owner', record.job_id)).status, 'processing', 'the job waits in the background');
    release();
    await service.idle();
    assert.equal((await service.get('api:owner', record.job_id)).status, 'completed');
  }, { resolveVideo: async () => { await gate; return { indexedAssetId: INDEXED, name: 'Spurs v United' }; } });
});

test('records failures and sends a job.failed webhook', () => withService(async (service, sent) => {
  const record = await service.submit('api:owner', request());
  await service.idle();
  const failed = await service.get('api:owner', record.job_id);
  assert.equal(failed.status, 'failed');
  assert.match(failed.error!, /No analyzed video/);
  assert.deepEqual(sent.map(payload => payload.event), ['job.failed']);
}, { resolveVideo: async () => { throw new ApiRequestError('No analyzed video with ScorePlay ID 130851978.', 404); } }));

test('a failed webhook never erases a successful result', () => withService(async service => {
  const record = await service.submit('api:owner', request());
  await service.idle();
  const done = await service.get('api:owner', record.job_id);
  assert.equal(done.status, 'completed');
  assert.ok(done.result);
  assert.equal(done.webhook!.state, 'failed');
}, { deliver: async () => ({ delivered: false, attempts: [{ at: '', status: 500 }], deliveryId: 'delivery-1' }) }));

test('rejects webhook hosts that fail the address check at submission', () => withService(async service => {
  await assert.rejects(() => service.submit('api:owner', request()), ApiRequestError);
}, { checkWebhookHost: async () => { throw new Error('private address'); } }));

test('resumes unfinished jobs after a restart', () => withService(async (_unused, _sent, make) => {
  // The first process accepts the job, then stops before finishing it.
  const crashed = make({ resolveVideo: () => new Promise(() => {}) });
  const record = await crashed.submit('api:owner', request(false));
  // A new process finds the unfinished record on disk and completes it.
  const restarted = make();
  await restarted.resume(['api:owner']);
  await restarted.idle();
  assert.equal((await restarted.get('api:owner', record.job_id)).status, 'completed');
}));
