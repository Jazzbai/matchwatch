import { NextResponse } from 'next/server';
import { AccessError } from '../access';
import { ApiRequestError } from './schema';
import type { ApiJobRecord } from './service';

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function apiFailure(error: unknown) {
  if (error instanceof AccessError || error instanceof ApiRequestError) return json({ error: error.message }, error.status);
  if (error instanceof SyntaxError) return json({ error: 'The request body is not valid JSON.' }, 400);
  console.error(JSON.stringify({ component: 'highlights-api', event: 'request_failed', error: error instanceof Error ? error.name : 'unknown' }));
  return json({ error: 'The request could not be completed.' }, 500);
}

/** Public view of a job; internal request details are not exposed. */
export function jobView(record: ApiJobRecord) {
  return {
    job_id: record.job_id,
    video_id: record.video_id,
    status: record.status,
    created_at: record.created_at,
    updated_at: record.updated_at,
    progress: record.progress,
    error: record.error,
    result: record.result,
    webhook: record.webhook && { state: record.webhook.state, delivery_id: record.webhook.delivery_id, attempts: record.webhook.attempts.length },
  };
}
