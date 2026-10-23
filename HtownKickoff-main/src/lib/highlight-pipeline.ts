import { openAsBlob } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { stat } from 'node:fs/promises';
import { TwelveLabsClient, TwelveLabsError, validVideoId } from './twelvelabs';
import { ScorePlayClient, ScorePlayError, scorePlayAllowed, type ScorePlayMedia } from './scoreplay';
import { scorePlayMapping, type MediaMapping } from './scoreplay-mapping';
import { PipelineError, PipelineStore } from './pipeline-store';
import { captureHls } from './pipeline-media';
import { withProcessingTemp } from './processing-temp';
import { reviewInput, validateJevReviews } from './jev';
import { reviewShortlist, optimizeHighlights } from './highlight-optimizer';
import { candidateChunks } from './rolling-highlights';
import { fuseEvents, fusedScore, parseAnchors, parseAudience, parsePosts, parseStats, type FusionInputs } from './event-fusion';
import { priorityWeights } from './highlight-preferences';
import { buildStoryDraft } from './story-builder';
import { type Artifact, type PipelineInput, type PipelineJob, type SourceOutput, type StepNumber, type UnderstoodOutput } from './pipeline-types';
import type { HighlightClip, HighlightEvent } from './highlight-plan';

const number = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const text = (v: unknown, max: number): v is string => typeof v === 'string' && !!v.trim() && v.length <= max;
export function parsePipelineInput(value: unknown): PipelineInput {
  try { return parseInput(value); }
  catch (error) { if (error instanceof PipelineError) throw error; throw new PipelineError(error instanceof Error ? error.message : 'Invalid pipeline input.'); }
}
function parseInput(value: unknown): PipelineInput {
  const input = value as PipelineInput;
  if (!input || !text(input.matchId, 100) || !text(input.title, 200) || !['Soccer', 'Basketball'].includes(input.sport) || !number(input.duration, 0, 14400) || !number(input.target, 1, 300) || !number(input.before, 0, 30) || !number(input.after, 0, 30) || !Array.isArray(input.queries) || !input.queries.length || input.queries.length > 8 || input.queries.some(q => !text(q, 200))) throw new PipelineError('Choose a match, sport, up to eight queries, and a target of 1–300 seconds.');
  priorityWeights(input.scoringPriority);
  const source = input.source;
  if (!source || !['upload', 'scoreplay', 'hls'].includes(source.kind) || !text(source.name, 200)) throw new PipelineError('Choose an upload, ScorePlay recording or live HLS source.');
  if (source.kind === 'scoreplay' && !/^[1-9][0-9]{0,15}$/.test(source.mediaId || '')) throw new PipelineError('Choose a valid ScorePlay media ID.');
  if (source.kind === 'hls' && (!number(source.captureSeconds, 10, 120) || source.hlsUrl && !text(source.hlsUrl, 4096))) throw new PipelineError('Capture a live window of 10–120 seconds.');
  const f = input.fusion || {};
  if (f.matchId && f.matchId !== input.matchId) throw new PipelineError('Evidence must belong to this match.');
  const fusion: FusionInputs = { matchId: input.matchId, stats: parseStats(f.stats || []), posts: parsePosts(f.posts || []), anchors: parseAnchors(f.anchors || []), videoUtc: f.videoUtc || '', reactionDelay: f.reactionDelay ?? 15, tolerance: f.tolerance ?? 10, ...(f.audience ? { audience: parseAudience(f.audience) } : {}) };
  fuseEvents([], fusion, priorityWeights(input.scoringPriority));
  // Explicitly select fields: clients cannot inject provider IDs, paths or checkpoints.
  return { matchId: input.matchId, title: input.title, sport: input.sport, duration: input.duration, target: input.target, queries: input.queries.map(q => q.trim()), before: input.before, after: input.after, scoringPriority: input.scoringPriority,
    source: { kind: source.kind, name: source.name, ...(source.kind === 'scoreplay' ? { mediaId: source.mediaId } : {}), ...(source.kind === 'hls' ? { hlsUrl: source.hlsUrl, captureSeconds: source.captureSeconds } : {}) }, fusion };
}
type Checkpoint = { assetId: string; indexId: string; indexedAssetId?: string; duration: number; reviewNonce?: string; events?: HighlightEvent[]; chunks?: { events: HighlightEvent[]; task?: string; done?: boolean }[] };
type Unified = UnderstoodOutput & { database: { event_id: string; match_id: string; source_id: string; start_seconds: number; end_seconds: number; event: HighlightEvent }[] };
type Ranked = Unified & { ranking: { event_id: string; estimated_score: number | null; scores: unknown; effective_weights: unknown; contributions: unknown; evidence_coverage: number }[] };
type Candidates = Ranked & { clips: HighlightClip[] };
export class HighlightPipeline {
  constructor(public store = new PipelineStore(), private labsFactory = (index: string) => {
    if (!process.env.TWELVELABS_API_KEY || !validVideoId(index)) throw new PipelineError('TwelveLabs requires a server API key and index ID.', 503);
    return new TwelveLabsClient(process.env.TWELVELABS_API_KEY, index);
  }, private scorePlayFactory = () => {
    if (!process.env.SCOREPLAY_API_KEY) throw new PipelineError('ScorePlay is not configured on the server.', 503);
    return new ScorePlayClient(process.env.SCOREPLAY_API_KEY);
  }, private mappingResolve = (media: ScorePlayMedia): Promise<MediaMapping> => scorePlayMapping().resolve(media)) {}
  async create(owner: string, input: PipelineInput, video?: File, signal?: AbortSignal) {
    const job = await this.store.create(owner, input);
    // Return a durable failed job too, so a failed source can be retried visibly.
    return this.run(owner, job.id, 1, false, video, signal);
  }
  async run(owner: string, id: string, step: StepNumber, rerun = false, video?: File, signal?: AbortSignal) {
    return this.store.locked(owner, id, async () => {
      const job = await this.store.job(owner, id), state = job.steps[step - 1];
      if (state.state === 'ready' && !rerun) return job;
      if (step > 1 && job.steps[step - 2].state !== 'ready') throw new PipelineError('Run the previous step successfully before this step.', 409);
      if (state.state !== 'working' || rerun) {
        await this.store.invalidate(owner, job, step);
        state.startedAt = new Date().toISOString();
        if (rerun) {
          const old = step === 2 ? await this.store.checkpoint<Checkpoint>(owner, id, 2) : null;
          await this.store.write(owner, id, `checkpoint-${step}.json`, old ? { assetId: old.assetId, indexId: old.indexId, indexedAssetId: old.indexedAssetId, duration: old.duration } : null);
        }
      }
      state.state = 'working'; state.updatedAt = new Date().toISOString(); state.message = `Working on ${state.name.toLowerCase()}.`; await this.store.save(owner, job);
      try {
        const data = step === 1 ? await this.source(owner, id, video, signal) : await this.advance(owner, job, step);
        if (data !== undefined) {
          const revision = state.revision + 1;
          const artifact: Artifact = { schema_version: 'matchwatch.pipeline.v1', job_id: id, step, revision, input_revision: step === 1 ? 0 : job.steps[step - 2].revision, created_at: new Date().toISOString(), data };
          await this.store.write(owner, id, `step-${step}.json`, artifact);
          state.revision = revision; state.state = 'ready'; state.message = step === 7 ? 'Draft story saved. Waiting for the team’s exact editor contract.' : 'Output saved. This step can be rerun independently.';
        }
      } catch (error) {
        state.state = 'error'; state.message = error instanceof PipelineError || error instanceof TwelveLabsError || error instanceof ScorePlayError ? error.message : 'This step failed. Retry using its saved input.';
        // Never log URLs, keys, signed download links, request bodies or provider payloads.
        console.error(JSON.stringify({ component: 'highlight-pipeline', job: id, step, error_type: error instanceof Error ? error.name : 'unknown' }));
      }
      state.updatedAt = new Date().toISOString(); await this.store.save(owner, job); return job;
    });
  }
  private async source(owner: string, id: string, video?: File, signal?: AbortSignal): Promise<SourceOutput> {
    const input = await this.store.input(owner, id), source = { ...input.source };
    source.indexId ||= process.env.TWELVELABS_INDEX_ID || '';
    if (source.kind === 'scoreplay') {
      if (!scorePlayAllowed(owner)) throw new PipelineError('ScorePlay access is not enabled for your account.', 403);
      const media = await this.scorePlayFactory().media(source.mediaId!), mapping = await this.mappingResolve(media);
      source.indexedAssetId = mapping.twelvelabsVideoId; source.assetId = mapping.assetId;
      input.duration = mapping.duration || input.duration;
    } else if (!source.assetId && source.kind === 'hls') {
      const url = source.hlsUrl || process.env.HIGHLIGHTS_HLS_URL;
      if (!url) throw new PipelineError('Enter the organizer HLS URL or set HIGHLIGHTS_HLS_URL on the server.');
      const deadline = AbortSignal.any([signal || new AbortController().signal, AbortSignal.timeout(240000)]);
      await withProcessingTemp(async folder => {
        const capture = await captureHls(url, source.captureSeconds!, folder, deadline);
        if ((await stat(capture.path)).size > 200 * 1024 * 1024) throw new PipelineError('The captured MP4 exceeds the 200 MB direct-upload limit.');
        source.assetId = await this.labsFactory(source.indexId!).upload(new File([await openAsBlob(capture.path, { type: 'video/mp4' })], 'live-capture.mp4', { type: 'video/mp4' }), deadline);
        input.duration = capture.duration; source.programDateTime = capture.programDateTime; source.mediaSequence = capture.mediaSequence;
      });
      if (source.programDateTime) input.fusion.videoUtc = source.programDateTime;
    } else if (!source.assetId) {
      if (!video || video.size <= 0 || video.size > 200 * 1024 * 1024) throw new PipelineError('Choose the original video again to retry the upload (maximum 200 MB).');
      source.assetId = await this.labsFactory(source.indexId).upload(video, signal);
    }
    input.source = source; await this.store.write(owner, id, 'input.json', input);
    return { input, source, duration: input.duration, temporaryFilesDeleted: true };
  }
  private async advance(owner: string, job: PipelineJob, step: StepNumber): Promise<unknown | undefined> {
    const previous = await this.store.artifact<UnderstoodOutput>(owner, job.id, step - 1 as StepNumber), data = previous.data;
    if (previous.revision !== job.steps[step - 2].revision) throw new PipelineError('The saved input changed. Retry after rerunning the previous step.', 409);
    if (step === 2) return this.understand(owner, job, data);
    const weights = priorityWeights(data.input.scoringPriority);
    if (step === 3) return { ...data, events: fuseEvents(data.events, data.input.fusion, weights) };
    if (step === 4) return { ...data, database: data.events.map(event => ({ event_id: event.id, match_id: data.input.matchId, source_id: data.source.mediaId || data.source.assetId!, start_seconds: event.start, end_seconds: event.end, event })) } satisfies Unified;
    if (step === 5) {
      const unified = data as Unified;
      return { ...unified, ranking: unified.database.map(({ event }) => { const score = fusedScore(event.viral!); return { event_id: event.id, estimated_score: score.score, scores: event.viral!.values, effective_weights: score.effectiveWeights, contributions: score.contributions, evidence_coverage: score.coverage }; }).sort((a, b) => (b.estimated_score ?? -1) - (a.estimated_score ?? -1) || a.event_id.localeCompare(b.event_id)) } satisfies Ranked;
    }
    if (step === 6) {
      const ranked = data as Ranked;
      const byId = new Map(ranked.database.map(row => [row.event_id, row.event]));
      const eligible = ranked.ranking.filter(row => row.estimated_score !== null && row.estimated_score > 0).flatMap(row => byId.get(row.event_id) ? [byId.get(row.event_id)!] : []);
      return { ...ranked, clips: optimizeHighlights(eligible, data.duration, data.input.target, data.input.before, data.input.after) };
    }
    return buildStoryDraft(job.id, data, (data as Candidates).clips);
  }
  private async understand(owner: string, job: PipelineJob, source: SourceOutput): Promise<UnderstoodOutput | undefined> {
    let checkpoint = await this.store.checkpoint<Checkpoint>(owner, job.id, 2);
    checkpoint ||= { assetId: source.source.assetId!, indexId: source.source.indexId!, indexedAssetId: source.source.indexedAssetId, duration: source.duration };
    checkpoint.reviewNonce ||= randomUUID();
    const labs = this.labsFactory(checkpoint.indexId);
    const pending = async (message: string) => {
      if (Date.now() - Date.parse(job.steps[1].startedAt!) > 20 * 60000) throw new PipelineError('Video understanding exceeded 20 minutes. Retry to resume the saved provider tasks.', 504);
      job.steps[1].message = message; await this.store.write(owner, job.id, 'checkpoint-2.json', checkpoint); return undefined;
    };
    const asset = await labs.asset(checkpoint.assetId);
    if (['failed', 'canceled'].includes(asset.status || '')) throw new PipelineError('TwelveLabs could not process this recording.');
    if (asset.status !== 'ready') return pending(`Processing uploaded footage: ${asset.status || 'processing'}.`);
    if (!checkpoint.indexedAssetId) { checkpoint.indexedAssetId = await labs.indexAsset(checkpoint.assetId); return pending('Indexing the recording in TwelveLabs.'); }
    const indexed = await labs.indexedAsset(checkpoint.indexedAssetId);
    if (['failed', 'canceled'].includes(indexed.status || '')) throw new PipelineError('TwelveLabs indexing failed. Check the source and model configuration.');
    if (indexed.status !== 'ready') return pending(`Indexing footage: ${indexed.status || 'processing'}.`);
    checkpoint.duration = indexed.system_metadata?.duration || asset.system_metadata?.duration || checkpoint.duration;
    if (!number(checkpoint.duration, 1, 14400)) throw new PipelineError('The provider did not return a valid recording duration.');
    if (!checkpoint.events) {
      const events: HighlightEvent[] = [];
      for (let index = 0; index < source.input.queries.length; index += 2) {
        const results = await Promise.all(source.input.queries.slice(index, index + 2).map(async query => ({ query, matches: await labs.search(checkpoint!.indexedAssetId!, query) })));
        for (const { query, matches } of results) for (const match of matches) {
          const end = Math.min(match.end!, checkpoint.duration);
          const eventId = createHash('sha256').update(`${checkpoint.assetId}|${query}|${match.start}|${end}`).digest('hex').slice(0, 32);
          if (end > match.start!) events.push({ id: eventId, label: query, start: match.start!, end, confidence: 0, importance: 0, context: 0, audio: 0, reaction: 0, preference: 0 });
        }
      }
      checkpoint.events = events;
      checkpoint.chunks = candidateChunks(reviewShortlist(events, checkpoint.duration), checkpoint.duration).map(chunk => ({ events: chunk.events }));
      return pending(events.length ? 'Found candidate moments. Preparing evidence review.' : 'Search finished with no matching moments.');
    }
    const chunk = checkpoint.chunks?.find(chunk => !chunk.done);
    if (chunk) {
      if (!chunk.task) {
        const key = createHash('sha256').update(`${job.id}|${checkpoint.reviewNonce}|${chunk.events.map(event => event.id).join(',')}`).digest('hex');
        chunk.task = await labs.review(checkpoint.assetId, reviewInput(chunk.events, checkpoint.duration), checkpoint.duration, key);
        return pending('Jev is reviewing the candidate video evidence.');
      }
      const review = await labs.reviewStatus(chunk.task);
      if (review.error || ['failed', 'canceled'].includes(review.status || '')) throw new PipelineError('Jev evidence review failed. Retry or use another recording.', 502);
      if (review.status !== 'ready') return pending(`Jev evidence review: ${review.status || 'processing'}.`);
      const reviews = validateJevReviews(review.reviews, reviewInput(chunk.events, checkpoint.duration), checkpoint.duration);
      chunk.events = chunk.events.map(event => ({ ...event, jev: reviews.find(review => review.candidate_id === event.id) })); chunk.done = true;
      return pending(`Reviewed ${checkpoint.chunks!.filter(chunk => chunk.done).length} of ${checkpoint.chunks!.length} video windows.`);
    }
    const events = checkpoint.chunks?.flatMap(chunk => chunk.events) || [];
    return { ...source, duration: checkpoint.duration, input: { ...source.input, duration: checkpoint.duration }, events };
  }
}
