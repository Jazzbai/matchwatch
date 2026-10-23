import { NextRequest } from 'next/server';
import { requestOwner, reserve, videoFromTicket } from '../../../../lib/highlights/access';
import { failure, reply } from '../../../../lib/highlights/http';
import { parseJobInput } from '../../../../lib/highlights/input';
import { HighlightPipeline } from '../../../../lib/highlights/pipeline';
import { PipelineError } from '../../../../lib/highlights/store';
import type { MatchSource, SocialData } from '../../../../lib/highlights/types';

export const runtime = 'nodejs';
export const maxDuration = 300;
const pipeline = new HighlightPipeline();
const MAX_BODY_BYTES = 210 * 1024 * 1024;

/**
 * GET                      → saved jobs for this account
 * GET ?jobId=…             → job status plus results once available
 * GET ?jobId=…&step=N      → one step's saved output as JSON
 */
export async function GET(request: NextRequest) {
  try {
    const owner = await requestOwner(request);
    const params = request.nextUrl.searchParams, id = params.get('jobId');
    if (!id) return reply({ jobs: await pipeline.store.list(owner) });
    const job = await pipeline.store.job(owner, id);
    const step = params.get('step');
    if (step) {
      const number = Number(step);
      if (!Number.isInteger(number) || number < 1 || number > 10) throw new PipelineError('Choose a step from 1 to 10.');
      const data = await pipeline.store.locked(owner, id, async () => {
        const current = await pipeline.store.job(owner, id);
        if (current.steps.slice(0, number).some(status => status.state !== 'ready')) throw new PipelineError('This step has no current output yet.', 409);
        return pipeline.store.read(owner, id, `step-${number}.json`);
      });
      return new Response(JSON.stringify(data, null, 2), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Content-Disposition': `attachment; filename="matchwatch-${id}-step-${number}.json"` },
      });
    }
    const ready = (n: number) => job.steps[n - 1].state === 'ready';
    const [source, social, output] = await Promise.all([
      ready(1) ? pipeline.store.read<MatchSource>(owner, id, 'step-1.json') : null,
      ready(3) ? pipeline.store.read<SocialData & { hashtags?: unknown }>(owner, id, 'step-3.json') : null,
      ready(10) ? pipeline.output(owner, id) : null,
    ]);
    return reply({
      job,
      source: source && { name: source.name, kind: source.kind, duration: source.duration, playbackUrl: source.playbackUrl ?? null, scoreplay: source.scoreplay ?? null },
      social: social && { status: social.status, posts: social.posts.length, reason: 'reason' in social ? social.reason : null, hashtags: social.hashtags ?? [] },
      output,
    });
  } catch (error) {
    return failure(error);
  }
}

/**
 * POST multipart { input, video? }          → create a job (step 1 uploads the video)
 * POST JSON { jobId }                        → advance the job; poll while a step is working
 * POST JSON { jobId, preferences }           → re-score saved analysis (steps 5–10)
 */
export async function POST(request: NextRequest) {
  try {
    const owner = await requestOwner(request);
    if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) return reply({ error: 'Upload a video smaller than 200 MB.' }, 413);
    if (request.headers.get('content-type')?.includes('multipart/form-data')) {
      reserve(owner, 'create');
      const form = await request.formData();
      const input = parseJobInput(JSON.parse(String(form.get('input') || 'null')));
      const video = form.get('video');
      const indexedAssetId = input.source.kind === 'library' || input.source.kind === 'scoreplay' ? videoFromTicket(input.source.ticket, owner) : null;
      return reply({ job: await pipeline.create(owner, input, indexedAssetId, video instanceof File ? video : undefined, request.signal) }, 201);
    }
    reserve(owner, 'request');
    const body = await request.json();
    if (typeof body?.jobId !== 'string') throw new PipelineError('Provide a jobId.');
    const job = body.preferences ? await pipeline.rescore(owner, body.jobId, body.preferences) : await pipeline.advance(owner, body.jobId, request.signal);
    return reply({ job });
  } catch (error) {
    return failure(error);
  }
}
