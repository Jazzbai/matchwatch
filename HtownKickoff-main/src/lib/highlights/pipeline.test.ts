import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { defaultWeights } from './catalog';
import type { JobInput } from './input';
import { HighlightPipeline } from './pipeline';
import { JobStore, PipelineError } from './store';
import type { TwelveLabsClient } from './twelvelabs';
import type { Job } from './types';

// Synthetic provider: deterministic search hits and reviews, no network and no paid calls.
const INDEX = 'aaaaaaaaaaaaaaaaaaaaaaaa', INDEXED = 'bbbbbbbbbbbbbbbbbbbbbbbb', ASSET = 'cccccccccccccccccccccccc';
const hits: Record<string, { start: number; end: number }[]> = {
  'Goal scored': [{ start: 100, end: 108 }, { start: 400, end: 410 }],
  'Goalkeeper makes a save': [{ start: 250, end: 256 }],
};

function fakeLabs(options: { upload?: boolean } = {}) {
  let assetPolls = 0;
  const tasks = new Map<string, { ids: string[]; polls: number }>();
  const calls = { search: 0, analyses: 0 };
  const labs = {
    indexId: INDEX,
    calls,
    async uploadAsset() { return ASSET; },
    async asset() { assetPolls++; return { _id: ASSET, status: options.upload && assetPolls < 2 ? 'processing' : 'ready', hls: { manifest_url: 'https://cdn.example/upload.m3u8' } }; },
    async indexAsset() { return INDEXED; },
    async indexedAsset() {
      return { _id: INDEXED, asset_id: ASSET, status: 'ready', system_metadata: { duration: 600, filename: 'Spurs v United.mp4', width: 1920, height: 1080 },
        user_metadata: options.upload ? {} : { scoreplay_id: '130851978', scoreplay_event_id: '1536128' }, hls: { video_url: 'https://cdn.example/match.m3u8' } };
    },
    async search(_id: string, query: string) { calls.search++; return (hits[query] || []).map((hit, index) => ({ ...hit, rank: index + 1 })); },
    async createAnalysis(_asset: string, _prompt: string, schema: { properties: { reviews: { items: { properties: { candidate_id: { enum: string[] } } } } } }) {
      calls.analyses++;
      const id = String(tasks.size + 1).padStart(24, 'd');
      tasks.set(id, { ids: schema.properties.reviews.items.properties.candidate_id.enum, polls: 0 });
      return id;
    },
    async analysis(id: string) {
      const task = tasks.get(id)!;
      if (++task.polls < 2) return { status: 'processing' };
      return { status: 'ready', data: { reviews: task.ids.map((candidateId, index) => ({
        candidate_id: candidateId, event_type: index % 2 ? 'save' : 'goal', description: 'Synthetic', team: 'Spurs', players: [],
        importance: 0.9 - index * 0.1, excitement: 0.7, emotional_intensity: { score: 0.8, evidence: 'Synthetic celebration' },
        controversy_surprise: { score: 0.1, evidence: 'None' }, watchability: 0.9, is_replay: false, duplicate_of: null,
        suggested_start: -1, suggested_end: -1, needs_review: false, reason: 'Synthetic review',
      })) } };
    },
  };
  return labs;
}

const input = (source: JobInput['source']): JobInput => ({
  match: { matchId: 'match-1', title: 'Spurs v United', reactionDelaySeconds: 20, events: [], anchors: [], social: { enabled: true }, rightsDeclared: false },
  preferences: { sport: 'Soccer', targetSeconds: 60, maxMoments: 5, minGapSeconds: 5, weights: { ...defaultWeights },
    queries: [{ type: 'goal', text: 'Goal scored' }, { type: 'save', text: 'Goalkeeper makes a save' }], starPlayers: [] },
  source,
});

async function withPipeline(labs: ReturnType<typeof fakeLabs>, licensed: boolean, work: (pipeline: HighlightPipeline) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), 'highlight-test-'));
  try {
    await work(new HighlightPipeline({
      store: new JobStore(root),
      labs: () => labs as unknown as TwelveLabsClient,
      xToken: () => undefined,
      rights: () => ({ licensedIndexIds: licensed ? [INDEX] : [], licensedHls: false, indexId: INDEX }),
      capture: async () => { throw new Error('No live capture in tests.'); },
    }));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function runToEnd(pipeline: HighlightPipeline, job: Job) {
  for (let round = 0; round < 10 && job.steps.some(step => step.state !== 'ready'); round++) {
    assert.ok(!job.steps.some(step => step.state === 'error'), JSON.stringify(job.steps.find(step => step.state === 'error')));
    job = await pipeline.advance('owner', job.id);
  }
  return job;
}

test('runs all ten steps for an already-indexed library video, resuming across polls', () => withPipeline(fakeLabs(), false, async pipeline => {
  let job = await pipeline.create('owner', input({ kind: 'library', ticket: 'unused' }), INDEXED);
  assert.deepEqual(job.steps.slice(0, 3).map(step => step.state), ['ready', 'ready', 'ready']);
  assert.equal(job.steps[3].state, 'working', 'step 4 waits for the provider');
  job = await runToEnd(pipeline, job);
  assert.ok(job.steps.every(step => step.state === 'ready'));
  assert.match(job.steps[2].message, /X access is not configured/);

  const output = await pipeline.output('owner', job.id);
  assert.equal(output.source.scoreplay_media_id, '130851978');
  assert.equal(output.social_data_status, 'unavailable');
  assert.equal(output.ranking.length, 3);
  assert.ok(output.selected_moments.length >= 2);
  // Every ranked row is either selected or carries a skip reason.
  assert.equal(output.ranking.filter(row => row.selected).length, output.selected_moments.length);
  assert.ok(output.ranking.every(row => row.selected === (row.skip_reason === null)));
  assert.ok(output.selected_moments.every(moment => moment.scores.social_trend_spike === null && moment.missing_signals.includes('social_trend_spike')));
  assert.equal(output.rights_status, 'pending_verification');
  assert.equal(output.publication, 'on_hold');
  assert.ok(output.rundown && output.rundown.length === output.selected_moments.length);
  await assert.rejects(() => pipeline.render('owner', job.id), (error: unknown) => error instanceof PipelineError && error.status === 409);
  await assert.rejects(() => pipeline.output('someone-else', job.id), PipelineError);
}));

test('re-scoring changes the selection without new provider calls', async () => {
  const labs = fakeLabs();
  await withPipeline(labs, true, async pipeline => {
    let job = await runToEnd(pipeline, await pipeline.create('owner', input({ kind: 'library', ticket: 'unused' }), INDEXED));
    const before = await pipeline.output('owner', job.id);
    assert.equal(before.publication, 'ready');
    const calls = { ...labs.calls };
    job = await pipeline.rescore('owner', job.id, { ...input({ kind: 'library', ticket: 'unused' }).preferences, maxMoments: 1 });
    const after = await pipeline.output('owner', job.id);
    assert.equal(after.selected_moments.length, 1);
    assert.equal(after.selected_moments[0].rank, 1);
    assert.ok(job.steps.every(step => step.state === 'ready'));
    assert.deepEqual(labs.calls, calls);
  });
});

test('an upload is indexed, then gains its playback stream for rendering', () => withPipeline(fakeLabs({ upload: true }), false, async pipeline => {
  const video = new File([new Uint8Array(1024)], 'match.mp4', { type: 'video/mp4' });
  let job = await pipeline.create('owner', { ...input({ kind: 'upload', name: 'match.mp4' }), match: { ...input({ kind: 'upload', name: 'x' }).match, rightsDeclared: true } }, null, video);
  assert.equal(job.steps[0].state, 'ready');
  job = await runToEnd(pipeline, job);
  const output = await pipeline.output('owner', job.id);
  assert.equal(output.rights_status, 'permitted');
  assert.equal(output.source.twelvelabs_indexed_asset_id, INDEXED);
  assert.equal(output.source.duration_seconds, 600);
}));

test('uploads without a file are rejected', () => withPipeline(fakeLabs({ upload: true }), false, async pipeline => {
  await assert.rejects(() => pipeline.create('owner', input({ kind: 'upload', name: 'match.mp4' }), null), PipelineError);
}));

test('a failed re-score invalidates old output and stops downstream steps', () => withPipeline(fakeLabs(), true, async pipeline => {
  const job = await runToEnd(pipeline, await pipeline.create('owner', input({ kind: 'library', ticket: 'unused' }), INDEXED));
  assert.ok((await pipeline.output('owner', job.id)).selected_moments.length);
  const write = pipeline.store.write.bind(pipeline.store);
  pipeline.store.write = async (owner, id, name, data) => {
    if (name === 'step-6.json') throw new PipelineError('Synthetic analysis failure.');
    await write(owner, id, name, data);
  };
  const updated = await pipeline.rescore('owner', job.id, input({ kind: 'library', ticket: 'unused' }).preferences);
  assert.equal(updated.steps[5].state, 'error');
  assert.ok(updated.steps.slice(6).every(step => step.state === 'pending'));
  await assert.rejects(() => pipeline.output('owner', job.id), (error: unknown) => error instanceof PipelineError && error.status === 409);
}));

test('concurrent output and rendering cannot read a job being modified', () => withPipeline(fakeLabs(), true, async pipeline => {
  const job = await runToEnd(pipeline, await pipeline.create('owner', input({ kind: 'library', ticket: 'unused' }), INDEXED));
  await pipeline.store.locked('owner', job.id, async () => {
    await assert.rejects(() => pipeline.output('owner', job.id), (error: unknown) => error instanceof PipelineError && error.status === 409);
    await assert.rejects(() => pipeline.render('owner', job.id), (error: unknown) => error instanceof PipelineError && error.status === 409);
  });
}));
