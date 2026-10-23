import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readdir, readFile, rename } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ScorePlayClient, ScorePlayError } from '../../scoreplay';
import { scorePlayMapping } from '../../scoreplay-mapping';
import { listLibrary } from '../library';
import { HighlightPipeline } from '../pipeline';
import { PipelineError } from '../store';
import { TwelveLabsError, twelveLabsFromEnv } from '../twelvelabs';
import { apiOwners } from './auth';
import { ApiRequestError, standardizeResult, type ApiResult, type ProcessRequest } from './schema';
import { deliverWebhook, publicAddress, WebhookUrlError, type DeliveryAttempt, type WebhookPayload } from './webhook';

// Integration API jobs. POST /process only validates and records a job; a bounded
// in-process worker then resolves the ScorePlay ID, drives the existing ten-step
// pipeline to completion and sends the webhook. Records live on disk, so status
// survives restarts and unfinished jobs are resumed.

export type ApiJobStatus = 'queued' | 'processing' | 'completed' | 'failed';
export type ApiJobRecord = {
  job_id: string;
  video_id: string;
  status: ApiJobStatus;
  created_at: string;
  updated_at: string;
  progress: { step: number; name: string; message: string } | null;
  error: string | null;
  result: ApiResult | null;
  webhook: { url: string; state: 'pending' | 'delivered' | 'failed'; delivery_id: string | null; attempts: DeliveryAttempt[] } | null;
  pipeline_job_id: string | null;
  request: Omit<ProcessRequest, 'webhookUrl'>;
};
export type ResolvedVideo = { indexedAssetId: string; name: string };
export type ServiceDependencies = {
  pipeline: HighlightPipeline;
  resolveVideo: (videoId: string) => Promise<ResolvedVideo>;
  deliver: typeof deliverWebhook;
  checkWebhookHost: (url: string) => Promise<unknown>;
  root: string;
  pollMs: number;
  timeoutMs: number;
  maxConcurrent: number;
  log: (entry: Record<string, unknown>) => void;
};

const isJobId = (id: string) => /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id);
const sleep = (ms: number) => new Promise(done => setTimeout(done, ms));

/** Finds the indexed TwelveLabs video for a ScorePlay media ID. */
export async function resolveScorePlayVideo(videoId: string): Promise<ResolvedVideo> {
  const labs = twelveLabsFromEnv();
  for (const refresh of [false, true]) {
    const match = (await listLibrary(labs, refresh)).find(video => video.scoreplay?.mediaId === videoId);
    if (match) return { indexedAssetId: match.indexedAssetId, name: match.name };
  }
  // Fall back to the ScorePlay catalog mapping when the server has ScorePlay access.
  if (process.env.SCOREPLAY_API_KEY) {
    const media = await new ScorePlayClient(process.env.SCOREPLAY_API_KEY).media(videoId);
    const mapping = await scorePlayMapping().resolve(media);
    return { indexedAssetId: mapping.twelvelabsVideoId, name: media.name };
  }
  throw new ApiRequestError(`No analyzed video with ScorePlay ID ${videoId} exists in the connected TwelveLabs index.`, 404);
}

export class HighlightApiService {
  private queue: { owner: string; id: string }[] = [];
  private queued = new Set<string>();
  private active = 0;

  constructor(private deps: ServiceDependencies) {}

  private folder(owner: string) {
    return join(resolve(this.deps.root), createHash('sha256').update(owner).digest('hex'));
  }

  private async save(owner: string, record: ApiJobRecord) {
    record.updated_at = new Date().toISOString();
    const folder = this.folder(owner), temp = join(folder, `${record.job_id}.${randomUUID()}.tmp`);
    await mkdir(folder, { recursive: true, mode: 0o700 });
    const file = await open(temp, 'wx', 0o600);
    try { await file.writeFile(JSON.stringify(record, null, 2)); } finally { await file.close(); }
    await rename(temp, join(folder, `${record.job_id}.json`));
  }

  async get(owner: string, id: string): Promise<ApiJobRecord> {
    if (!isJobId(id)) throw new ApiRequestError('Unknown job_id.', 404);
    try { return JSON.parse(await readFile(join(this.folder(owner), `${id}.json`), 'utf8')); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new ApiRequestError('Unknown job_id.', 404);
      throw error;
    }
  }

  /** Validates, records and queues a job; returns without waiting for processing. */
  async submit(owner: string, request: ProcessRequest): Promise<ApiJobRecord> {
    if (request.webhookUrl) {
      try { await this.deps.checkWebhookHost(request.webhookUrl); }
      catch (error) { throw new ApiRequestError(error instanceof WebhookUrlError ? error.message : 'webhook_url is not reachable.'); }
    }
    const now = new Date().toISOString();
    const { webhookUrl, ...rest } = request;
    const record: ApiJobRecord = {
      job_id: randomUUID(), video_id: request.videoId, status: 'queued', created_at: now, updated_at: now,
      progress: null, error: null, result: null, pipeline_job_id: null, request: rest,
      webhook: webhookUrl ? { url: webhookUrl, state: 'pending', delivery_id: null, attempts: [] } : null,
    };
    await this.save(owner, record);
    this.deps.log({ component: 'highlights-api', event: 'job_queued', job: record.job_id, video_id: record.video_id });
    this.enqueue(owner, record.job_id);
    return record;
  }

  /** Re-queues unfinished jobs and undelivered webhooks after a restart. */
  async resume(owners: string[]) {
    for (const owner of owners) {
      const files = await readdir(this.folder(owner)).catch(() => [] as string[]);
      for (const file of files.filter(name => name.endsWith('.json'))) {
        const record = await this.get(owner, file.slice(0, -5)).catch(() => null);
        if (record && (record.status === 'queued' || record.status === 'processing' || record.webhook?.state === 'pending')) this.enqueue(owner, record.job_id);
      }
    }
  }

  /** Resolves when every queued job has finished; used by tests. */
  async idle() {
    while (this.active || this.queue.length) await sleep(10);
  }

  private enqueue(owner: string, id: string) {
    const key = `${owner}|${id}`;
    if (this.queued.has(key)) return;
    this.queued.add(key);
    this.queue.push({ owner, id });
    this.pump();
  }

  private pump() {
    while (this.active < this.deps.maxConcurrent && this.queue.length) {
      const { owner, id } = this.queue.shift()!;
      this.active++;
      void this.run(owner, id)
        .catch(error => this.deps.log({ component: 'highlights-api', event: 'worker_error', job: id, error: error instanceof Error ? error.name : 'unknown' }))
        .finally(() => { this.active--; this.queued.delete(`${owner}|${id}`); this.pump(); });
    }
  }

  private async run(owner: string, id: string) {
    const record = await this.get(owner, id);
    if (record.status === 'queued' || record.status === 'processing') await this.process(owner, record);
    if (record.webhook?.state === 'pending') await this.notify(owner, record);
  }

  /** Drives the existing pipeline to completion. Failures are recorded, never thrown. */
  private async process(owner: string, record: ApiJobRecord) {
    const { pipeline } = this.deps;
    record.status = 'processing';
    await this.save(owner, record);
    try {
      if (!record.pipeline_job_id) {
        const video = await this.deps.resolveVideo(record.video_id);
        const { match, preferences } = record.request;
        const job = await pipeline.create(owner, { match: { ...match, title: match.title ?? video.name }, preferences, source: { kind: 'library', ticket: '' } }, video.indexedAssetId);
        record.pipeline_job_id = job.id;
        await this.save(owner, record);
      }
      const deadline = Date.parse(record.created_at) + this.deps.timeoutMs;
      for (;;) {
        const job = await pipeline.advance(owner, record.pipeline_job_id);
        const failed = job.steps.find(step => step.state === 'error');
        if (failed) throw new PipelineError(`Step ${failed.step} (${failed.name}) failed: ${failed.message}`, 502);
        if (job.steps.every(step => step.state === 'ready')) break;
        const current = job.steps.find(step => step.state !== 'ready')!;
        record.progress = { step: current.step, name: current.name, message: current.message };
        await this.save(owner, record);
        if (Date.now() > deadline) throw new PipelineError('Processing exceeded the time limit.', 504);
        await sleep(this.deps.pollMs);
      }
      record.result = standardizeResult(await pipeline.output(owner, record.pipeline_job_id));
      record.status = 'completed';
      record.progress = null;
      this.deps.log({ component: 'highlights-api', event: 'job_completed', job: record.job_id, highlights: record.result.highlights.length });
    } catch (error) {
      record.status = 'failed';
      const known = error instanceof PipelineError || error instanceof TwelveLabsError || error instanceof ScorePlayError || error instanceof ApiRequestError;
      record.error = known ? (error as Error).message : 'Processing failed unexpectedly.';
      this.deps.log({ component: 'highlights-api', event: 'job_failed', job: record.job_id, error: error instanceof Error ? error.name : 'unknown' });
    }
    await this.save(owner, record);
  }

  /** Webhook delivery is separate: its failure never changes the job's result. */
  private async notify(owner: string, record: ApiJobRecord) {
    const webhook = record.webhook!;
    const payload: WebhookPayload = record.status === 'completed'
      ? { event: 'job.completed', job_id: record.job_id, video_id: record.video_id, status: 'completed', result: record.result }
      : { event: 'job.failed', job_id: record.job_id, video_id: record.video_id, status: 'failed', error: record.error ?? 'Processing failed.' };
    const outcome = await this.deps.deliver(webhook.url, payload);
    record.webhook = { ...webhook, state: outcome.delivered ? 'delivered' : 'failed', delivery_id: outcome.deliveryId, attempts: [...webhook.attempts, ...outcome.attempts] };
    await this.save(owner, record);
  }
}

/** One service per server process, shared by every route module (and across dev reloads). */
export function apiService(): HighlightApiService {
  const holder = globalThis as typeof globalThis & { __highlightsApi?: HighlightApiService };
  if (!holder.__highlightsApi) {
    holder.__highlightsApi = new HighlightApiService({
      pipeline: new HighlightPipeline(),
      resolveVideo: resolveScorePlayVideo,
      deliver: deliverWebhook,
      checkWebhookHost: url => publicAddress(new URL(url)),
      root: join(process.env.HIGHLIGHTS_DATA_DIR || join(process.cwd(), '.data', 'highlight-pipeline'), 'api-jobs'),
      pollMs: 3000,
      timeoutMs: 30 * 60_000,
      maxConcurrent: Math.max(1, Number(process.env.HIGHLIGHTS_API_CONCURRENCY) || 2),
      log: entry => console.info(JSON.stringify(entry)),
    });
    void holder.__highlightsApi.resume(apiOwners());
  }
  return holder.__highlightsApi;
}
