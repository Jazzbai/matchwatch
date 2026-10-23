import { configuredKeys } from '../../../../lib/highlights/api/auth';
import { json } from '../../../../lib/highlights/api/http';
import { isProviderId } from '../../../../lib/highlights/twelvelabs';

export const runtime = 'nodejs';

/** Unauthenticated liveness check; reports configuration flags only, never secrets. */
export function GET() {
  return json({
    status: 'ok',
    api_enabled: configuredKeys().length > 0,
    video_analysis_configured: !!process.env.TWELVELABS_API_KEY && isProviderId(process.env.TWELVELABS_INDEX_ID),
    scoreplay_catalog_configured: !!process.env.SCOREPLAY_API_KEY,
    webhook_signing: !!process.env.HIGHLIGHTS_WEBHOOK_SECRET,
    time: new Date().toISOString(),
  });
}
