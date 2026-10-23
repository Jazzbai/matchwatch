import { NextRequest } from 'next/server';
import { reserve } from '../../../../lib/highlights/access';
import { apiOwner } from '../../../../lib/highlights/api/auth';
import { apiFailure, json } from '../../../../lib/highlights/api/http';
import { parseProcessRequest } from '../../../../lib/highlights/api/schema';
import { apiService } from '../../../../lib/highlights/api/service';

export const runtime = 'nodejs';

/** Starts highlight processing for a ScorePlay video and returns immediately. */
export async function POST(request: NextRequest) {
  try {
    const owner = apiOwner(request);
    if (Number(request.headers.get('content-length')) > 64 * 1024) return json({ error: 'The request body is too large.' }, 413);
    const input = parseProcessRequest(await request.json());
    reserve(owner, 'create');
    const record = await apiService().submit(owner, input);
    return json({ job_id: record.job_id, video_id: record.video_id, status: record.status, status_url: `${request.nextUrl.pathname.replace(/\/process$/, '')}/jobs/${record.job_id}` }, 202);
  } catch (error) {
    return apiFailure(error);
  }
}
