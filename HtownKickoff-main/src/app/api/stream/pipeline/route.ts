import { NextRequest, NextResponse } from 'next/server';
import { highlightOwner, HighlightAccessError, reserveOperation } from '../../../../lib/highlight-access';
import { HighlightPipeline, parsePipelineInput } from '../../../../lib/highlight-pipeline';
import { PipelineError } from '../../../../lib/pipeline-store';
import { type StepNumber } from '../../../../lib/pipeline-types';
import type { StoryDraft, UnderstoodOutput } from '../../../../lib/pipeline-types';
import type { HighlightClip } from '../../../../lib/highlight-plan';
import { buildKeyMomentsHandoff } from '../../../../lib/rundown-handoff';

export const runtime = 'nodejs';
export const maxDuration = 300;
const pipeline = new HighlightPipeline();
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
function failure(error: unknown) {
  if (error instanceof PipelineError || error instanceof HighlightAccessError) return reply({ error: error.message }, error.status);
  if (error instanceof SyntaxError) return reply({ error: 'The pipeline request is not valid JSON.' }, 400);
  return reply({ error: 'The pipeline could not complete the request. Check server storage and retry.' }, 500);
}
function stepNumber(value: unknown): StepNumber {
  const step = Number(value);
  if (!Number.isInteger(step) || step < 1 || step > 7) throw new PipelineError('Choose a pipeline step from 1 to 7.');
  return step as StepNumber;
}
export async function GET(request: NextRequest) {
  try {
    const owner = await highlightOwner(request), id = request.nextUrl.searchParams.get('jobId');
    if (!id) return reply({ jobs: await pipeline.store.list(owner) });
    const job = await pipeline.store.job(owner, id), requestedStep = request.nextUrl.searchParams.get('step');
    if (!requestedStep) return reply({ job });
    const step = stepNumber(requestedStep);
    if (request.nextUrl.searchParams.get('format') === 'key-moments') {
      if (step !== 7) throw new PipelineError('The key moments handoff requires the saved story output.');
      return await pipeline.store.locked(owner, id, async () => {
        const current = await pipeline.store.job(owner, id);
        if (current.steps.some(item => item.state !== 'ready')) throw new PipelineError('Run the saved pipeline before opening the key moments handoff.', 409);
        const [story, candidates] = await Promise.all([pipeline.store.artifact<StoryDraft>(owner, id, 7), pipeline.store.artifact<UnderstoodOutput & { clips: HighlightClip[] }>(owner, id, 6)]);
        if (story.input_revision !== candidates.revision || story.revision !== current.steps[6].revision || candidates.revision !== current.steps[5].revision) throw new PipelineError('The handoff is outdated. Rerun the story builder.', 409);
        return new Response(JSON.stringify(buildKeyMomentsHandoff(story.data, candidates.data), null, 2), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Content-Disposition': `attachment; filename="matchwatch-${id}-key-moments.json"` } });
      });
    }
    if (job.steps[step - 1].state !== 'ready') throw new PipelineError('This step has no current output. Run it again after its input is ready.', 409);
    const artifact = await pipeline.store.artifact(owner, id, step);
    // Step 7's payload is the contract itself; no storage wrapper is added to the download.
    return new Response(JSON.stringify(step === 7 ? artifact.data : artifact, null, 2), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Content-Disposition': `attachment; filename="matchwatch-${id}-step-${step}${step === 7 ? '-DRAFT' : ''}.json"` } });
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  let release: (() => void) | undefined;
  try {
    const owner = await highlightOwner(request);
    if (Number(request.headers.get('content-length')) > 210 * 1024 * 1024) return reply({ error: 'Upload a video smaller than 200 MB.' }, 413);
    if (request.headers.get('content-type')?.includes('multipart/form-data')) {
      release = reserveOperation(owner, 'upload');
      const form = await request.formData(), raw = String(form.get('input') || '');
      const existingId = form.get('jobId'), file = form.get('video');
      if (typeof existingId === 'string') return reply({ job: await pipeline.run(owner, existingId, 1, true, file instanceof File ? file : undefined, request.signal) });
      if (raw.length > 2 * 1024 * 1024) throw new PipelineError('The input metadata is too large.');
      const input = parsePipelineInput(JSON.parse(raw));
      if (input.source.kind === 'upload' && !(file instanceof File)) throw new PipelineError('Choose a video file.');
      return reply({ job: await pipeline.create(owner, input, file instanceof File ? file : undefined, request.signal) }, 201);
    }
    const raw = await request.text(); if (raw.length > 4096) throw new PipelineError('The step request is too large.');
    const body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new PipelineError('Provide a pipeline step request object.');
    const step = stepNumber(body.step);
    if (typeof body.jobId !== 'string' || body.rerun !== undefined && typeof body.rerun !== 'boolean') throw new PipelineError('Provide a jobId, step and optional rerun boolean.');
    // Provider polling is resumable and free of repeated create calls. Charge only step starts.
    const current = await pipeline.store.job(owner, body.jobId);
    if (current.steps[step - 1].state !== 'working') release = reserveOperation(owner, step === 2 ? 'review' : 'request');
    return reply({ job: await pipeline.run(owner, body.jobId, step, body.rerun === true) });
  } catch (error) { return failure(error); }
  finally { release?.(); }
}
