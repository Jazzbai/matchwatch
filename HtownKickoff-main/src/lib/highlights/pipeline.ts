import { randomUUID } from 'node:crypto';
import { openAsBlob } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fuseEvents } from './event-fusion';
import { parsePreferences, type JobInput, type SourceRequest } from './input';
import { toLibraryVideo } from './library';
import { eventVideoTime } from './match-stats';
import { captureHls } from './media';
import { buildKeyMoments, type KeyMomentsOutput } from './output';
import { rankEvents } from './ranking';
import { renderHighlight } from './render';
import { assetRights, rightsPolicyFromEnv, type RightsPolicy } from './rights';
import { selectMoments } from './selection';
import { searchX, trendingHashtags } from './social-signals';
import { JobStore, PipelineError } from './store';
import { TwelveLabsError, twelveLabsFromEnv, type TwelveLabsClient } from './twelvelabs';
import type {
  AnalyzedEvent, CandidateMoment, HighlightPreferences, Job, MatchInput, MatchSource, RankedEvent, ScoredEvent, Selection, SocialData, UnifiedEvent,
} from './types';
import { advanceUnderstanding, UnderstandingError, type UnderstandingState } from './video-understanding';
import { analyzeEvent } from './viral-analysis';
import { scoreEvent } from './viral-score';

// Runs the ten diagram steps in order. Each request advances a job as far as it can
// within a time budget; step 4 waits on TwelveLabs, so the browser polls until done.

type StoredSource = { kind: 'library'; indexedAssetId: string } | Exclude<SourceRequest, { kind: 'library' }>;
type StoredInput = { match: MatchInput; preferences: HighlightPreferences; source: StoredSource };
type StepResult = { data: unknown; summary: string };
export type Dependencies = {
  store: JobStore;
  labs: () => TwelveLabsClient;
  xToken: () => string | undefined;
  rights: () => RightsPolicy;
  capture: typeof captureHls;
};

const TIME_BUDGET_MS = 25_000;
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

export class HighlightPipeline {
  constructor(private deps: Dependencies = {
    store: new JobStore(),
    labs: twelveLabsFromEnv,
    xToken: () => process.env.X_BEARER_TOKEN || undefined,
    rights: rightsPolicyFromEnv,
    capture: captureHls,
  }) {}

  get store() { return this.deps.store; }

  /** Creates a job. Uploads happen inside this request because the file is only available now. */
  async create(owner: string, input: JobInput, indexedAssetId: string | null, video?: File, signal?: AbortSignal): Promise<Job> {
    const source: StoredSource = input.source.kind === 'library' ? { kind: 'library', indexedAssetId: indexedAssetId! } : input.source;
    const job = await this.store.create(owner, input.match.title, { match: input.match, preferences: input.preferences, source } satisfies StoredInput);
    if (source.kind === 'upload') {
      if (!video || video.size === 0 || video.size > MAX_UPLOAD_BYTES) throw new PipelineError('Choose a video file of up to 200 MB.');
      await this.runStep(owner, job, 1, async () => {
        const assetId = await this.deps.labs().uploadAsset(video, signal);
        const uploaded: MatchSource = { kind: 'upload', name: source.name, assetId, duration: 0 };
        return { data: uploaded, summary: `${source.name} uploaded to TwelveLabs.` };
      });
    }
    return this.advance(owner, job.id, signal);
  }

  /** Runs pending steps until one has to wait for the provider, or the time budget is spent. */
  advance(owner: string, id: string, signal?: AbortSignal): Promise<Job> {
    return this.store.locked(owner, id, async () => {
      const job = await this.store.job(owner, id);
      const started = Date.now();
      for (const status of job.steps) {
        if (status.state === 'ready') continue;
        if (Date.now() - started > TIME_BUDGET_MS) break;
        const finished = await this.runStep(owner, job, status.step, () => this.execute(owner, job, status.step, signal));
        if (!finished) break;
      }
      return job;
    });
  }

  /** Re-scores saved analysis with new preferences (steps 5–10) without new provider calls. */
  rescore(owner: string, id: string, preferences: unknown): Promise<Job> {
    return this.store.locked(owner, id, async () => {
      const job = await this.store.job(owner, id);
      if (job.steps[3].state !== 'ready') throw new PipelineError('Wait until the video analysis is complete.', 409);
      const input = await this.store.read<StoredInput>(owner, id, 'input.json');
      const next = parsePreferences(preferences as Record<string, unknown>);
      input.preferences = { ...next, sport: input.preferences.sport, queries: input.preferences.queries };
      await this.store.write(owner, id, 'input.json', input);
      for (const status of job.steps.slice(4)) await this.runStep(owner, job, status.step, () => this.execute(owner, job, status.step));
      return job;
    });
  }

  output(owner: string, id: string) {
    return this.store.read<KeyMomentsOutput>(owner, id, 'step-10.json');
  }

  /** Renders the selected moments; held while rights are not confirmed. */
  async render(owner: string, id: string, signal?: AbortSignal) {
    const job = await this.store.job(owner, id);
    if (job.steps.some(step => step.state !== 'ready')) throw new PipelineError('Finish the analysis before creating the video.', 409);
    const [source, selection] = await Promise.all([
      this.store.read<MatchSource>(owner, id, 'step-1.json'),
      this.store.read<Selection>(owner, id, 'step-9.json'),
    ]);
    if (selection.rights.status !== 'permitted') throw new PipelineError(`Video creation is on hold: ${selection.rights.reason}`, 409);
    if (!selection.selected.length) throw new PipelineError('No moments were selected.', 409);
    const folder = await mkdtemp(join(process.env.HIGHLIGHTS_TEMP_DIR || tmpdir(), 'matchwatch-render-'));
    try {
      return await renderHighlight(source.playbackUrl || '', selection.selected.map(event => event.clip), folder, signal);
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  /** Marks a step working, runs it, and records ready/error. Returns false while waiting. */
  private async runStep(owner: string, job: Job, step: number, work: () => Promise<StepResult | undefined>) {
    const status = job.steps[step - 1];
    status.state = 'working';
    status.updatedAt = new Date().toISOString();
    await this.store.save(owner, job);
    try {
      const result = await work();
      if (!result) return false;
      await this.store.write(owner, job.id, `step-${step}.json`, result.data);
      status.state = 'ready';
      status.message = result.summary;
      return true;
    } catch (error) {
      status.state = 'error';
      status.message = error instanceof PipelineError || error instanceof TwelveLabsError || error instanceof UnderstandingError
        ? error.message : 'This step failed. Resume to retry it.';
      // Never log keys, URLs or provider payloads.
      console.error(JSON.stringify({ component: 'highlight-pipeline', job: job.id, step, error: error instanceof Error ? error.name : 'unknown' }));
      return false;
    } finally {
      status.updatedAt = new Date().toISOString();
      await this.store.save(owner, job);
    }
  }

  /** Runs one step. Returns its output and a one-line summary, or undefined while waiting. */
  private async execute(owner: string, job: Job, step: number, signal?: AbortSignal): Promise<StepResult | undefined> {
    const read = <T>(n: number) => this.store.read<T>(owner, job.id, `step-${n}.json`);
    const input = await this.store.read<StoredInput>(owner, job.id, 'input.json');
    switch (step) {
      case 1: {
        const source = await this.resolveSource(owner, job, input, signal);
        return { data: source, summary: `${source.name} · ${Math.round(source.duration)} s${source.scoreplay ? ` · ScorePlay ${source.scoreplay.mediaId}` : ''}` };
      }
      case 2: {
        const aligned = this.alignMatchEvents(input);
        return { data: aligned, summary: aligned.events.length ? `${aligned.events.length} official events, ${aligned.aligned} aligned to the video.` : 'No official events supplied; continuing with video evidence.' };
      }
      case 3: {
        const social = await this.collectSocial(input, await read<MatchSource>(1));
        return { data: social, summary: social.status === 'available' ? `${social.posts.length} posts collected${social.truncated ? ' (first 100)' : ''}.` : social.reason };
      }
      case 4: {
        const understood = await this.understandVideo(owner, job, input);
        return understood && { data: understood, summary: understood.message };
      }
    }
    const [source, social, understood] = await Promise.all([read<MatchSource>(1), read<SocialData>(3), read<{ candidates: CandidateMoment[] }>(4)]);
    const { match, preferences } = input;
    switch (step) {
      case 5: {
        const events = fuseEvents(understood.candidates, match, preferences, social, source.duration);
        return { data: events, summary: `${events.length} unified events (${events.filter(event => event.officialEventId).length} matched to official stats, ${events.filter(event => event.social?.posts).length} with X reactions).` };
      }
      case 6: return { data: (await read<UnifiedEvent[]>(5)).map(event => analyzeEvent(event, preferences)), summary: 'Six viral signals analyzed for every event.' };
      case 7: return { data: (await read<AnalyzedEvent[]>(6)).map(event => scoreEvent(event, preferences.weights)), summary: 'Weighted viral scores calculated.' };
      case 8: {
        const ranked = rankEvents(await read<ScoredEvent[]>(7));
        return { data: ranked, summary: `${ranked.length} moments ranked; ${ranked.filter(event => event.duplicateOf).length} duplicates marked.` };
      }
      case 9: {
        const selection = selectMoments(await read<RankedEvent[]>(8), preferences, assetRights(source, match.rightsDeclared, this.deps.rights()));
        return { data: selection, summary: `${selection.selected.length} moments selected (${Math.round(selection.totalSeconds)} s). Rights: ${selection.rights.status.replace('_', ' ')}.` };
      }
      case 10: {
        const output = buildKeyMoments(job.id, match, source, preferences.weights, social, await read<RankedEvent[]>(8), await read<Selection>(9), preferences.targetSeconds);
        return { data: output, summary: output.publication === 'ready' ? 'Key moments ready for highlight generation.' : 'Key moments ready; publication on hold until rights are confirmed.' };
      }
    }
    throw new PipelineError('Unknown step.');
  }

  /** Step 1: identify the asset and its metadata (or capture the live window). */
  private async resolveSource(owner: string, job: Job, input: StoredInput, signal?: AbortSignal): Promise<MatchSource> {
    const source = input.source;
    if (source.kind === 'library') {
      const video = toLibraryVideo(await this.deps.labs().indexedAsset(source.indexedAssetId));
      if (!video) throw new PipelineError('This library video is not ready for analysis.', 409);
      return { kind: 'library', name: video.name, indexedAssetId: video.indexedAssetId, assetId: video.assetId, duration: video.duration,
        playbackUrl: video.playbackUrl ?? undefined, ...(video.scoreplay ? { scoreplay: video.scoreplay } : {}) };
    }
    if (source.kind === 'upload') throw new PipelineError('The upload did not finish. Start again with the video file.', 409);
    const url = source.hlsUrl || process.env.HIGHLIGHTS_HLS_URL;
    if (!url) throw new PipelineError('Enter the live HLS URL or set HIGHLIGHTS_HLS_URL on the server.');
    const folder = await mkdtemp(join(process.env.HIGHLIGHTS_TEMP_DIR || tmpdir(), 'matchwatch-capture-'));
    try {
      const deadline = AbortSignal.any([signal ?? new AbortController().signal, AbortSignal.timeout(240_000)]);
      const capture = await this.deps.capture(url, source.captureSeconds, folder, deadline);
      const file = new File([await openAsBlob(capture.path, { type: 'video/mp4' })], 'live-capture.mp4', { type: 'video/mp4' });
      const assetId = await this.deps.labs().uploadAsset(file, deadline);
      if (capture.programDateTime && !input.match.videoStartUtc) {
        input.match.videoStartUtc = capture.programDateTime;
        await this.store.write(owner, job.id, 'input.json', input);
      }
      return { kind: 'hls', name: 'Live feed', assetId, duration: capture.duration, captureSeconds: source.captureSeconds, programDateTime: capture.programDateTime };
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  /** Step 2: official events with their position on the video timeline. */
  private alignMatchEvents({ match, preferences }: StoredInput) {
    const events = match.events.map(event => {
      const videoSeconds = eventVideoTime(event, match.anchors, preferences.sport);
      return { ...event, videoSeconds, aligned: videoSeconds !== null };
    });
    return { events, anchors: match.anchors, aligned: events.filter(event => event.aligned).length };
  }

  /** Step 3: X posts for the match window. Missing access is recorded, never invented. */
  private async collectSocial({ match }: StoredInput, source: MatchSource): Promise<SocialData & { hashtags?: ReturnType<typeof trendingHashtags> }> {
    if (!match.social.enabled) return { status: 'not_requested', reason: 'Fan reactions from X were not requested.', posts: [] };
    const token = this.deps.xToken();
    if (!token) return { status: 'unavailable', reason: 'X access is not configured on this server (X_BEARER_TOKEN).', posts: [] };
    if (!match.videoStartUtc) return { status: 'unavailable', reason: 'Add the recording start time to align X posts with the video.', posts: [] };
    const start = Date.parse(match.videoStartUtc);
    const span = Math.min(6 * 3600, (source.duration || 3 * 3600) + match.reactionDelaySeconds + 120);
    const text = match.social.query || [match.homeTeam, match.awayTeam].filter(Boolean).join(' ') || match.title;
    const query = { text, start: new Date(start).toISOString(), end: new Date(start + span * 1000).toISOString() };
    try {
      const { posts, truncated } = await searchX(token, query);
      return { status: 'available', query, posts, truncated, hashtags: trendingHashtags(posts) };
    } catch (error) {
      return { status: 'unavailable', reason: error instanceof Error ? error.message : 'X search failed.', posts: [] };
    }
  }

  /** Step 4: one resumable tick of TwelveLabs indexing, search and review. */
  private async understandVideo(owner: string, job: Job, input: StoredInput) {
    const source = await this.store.read<MatchSource>(owner, job.id, 'step-1.json');
    const state = await this.store.readOptional<UnderstandingState>(owner, job.id, 'understanding.json')
      ?? { assetId: source.assetId!, indexedAssetId: source.indexedAssetId, duration: source.duration, nonce: randomUUID() };
    const labs = this.deps.labs();
    const teams = [input.match.homeTeam, input.match.awayTeam].filter((team): team is string => !!team);
    try {
      const tick = await advanceUnderstanding(labs, state, { queries: input.preferences.queries, sport: input.preferences.sport, teams });
      job.steps[3].message = tick.message;
      if (!tick.done) return undefined;
      if (source.kind !== 'library') {
        // Uploaded and captured videos get their duration and playback stream once indexed.
        const asset = await labs.asset(state.assetId);
        await this.store.write(owner, job.id, 'step-1.json', { ...source, indexedAssetId: state.indexedAssetId, duration: state.duration, playbackUrl: asset.hls?.manifest_url } satisfies MatchSource);
      }
      return { candidates: tick.candidates, message: tick.message };
    } finally {
      await this.store.write(owner, job.id, 'understanding.json', state);
    }
  }
}

