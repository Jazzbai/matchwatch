import { NextRequest } from 'next/server';
import { requestOwner, reserve, studioEnabled } from '../../../../lib/highlights/access';
import { failure, reply } from '../../../../lib/highlights/http';
import { runFfmpeg } from '../../../../lib/highlights/media';
import { HighlightPipeline } from '../../../../lib/highlights/pipeline';
import { isProviderId } from '../../../../lib/highlights/twelvelabs';

export const runtime = 'nodejs';
export const maxDuration = 300;
const pipeline = new HighlightPipeline();

/** Service status; also the deployment health check. */
export async function GET() {
  let renderReady = true;
  try { await runFfmpeg(['-version'], 10_000); } catch { renderReady = false; }
  const enabled = studioEnabled();
  return reply({
    analysisReady: enabled && !!process.env.TWELVELABS_API_KEY && isProviderId(process.env.TWELVELABS_INDEX_ID),
    renderReady: enabled && renderReady,
    socialReady: !!process.env.X_BEARER_TOKEN,
    requiresLogin: process.env.NODE_ENV !== 'development',
  });
}

/** Renders the selected moments of a finished job into one MP4. */
export async function POST(request: NextRequest) {
  let release: (() => void) | undefined;
  try {
    const owner = await requestOwner(request);
    const body = await request.json();
    if (typeof body?.jobId !== 'string') return reply({ error: 'Provide a jobId.' }, 400);
    release = reserve(owner, 'render');
    const video = await pipeline.render(owner, body.jobId, request.signal);
    return new Response(new Uint8Array(video), {
      headers: { 'Content-Type': 'video/mp4', 'Content-Disposition': 'attachment; filename="matchwatch-highlight.mp4"', 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return failure(error);
  } finally {
    release?.();
  }
}
