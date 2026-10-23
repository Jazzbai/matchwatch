import { NextRequest } from 'next/server';
import { apiOwner } from '../../../../../lib/highlights/api/auth';
import { apiFailure, jobView, json } from '../../../../../lib/highlights/api/http';
import { apiService } from '../../../../../lib/highlights/api/service';

export const runtime = 'nodejs';

/** Job status, progress and — once completed — the standardized highlights. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const owner = apiOwner(request);
    const { jobId } = await params;
    return json(jobView(await apiService().get(owner, jobId)));
  } catch (error) {
    return apiFailure(error);
  }
}
