import { NextResponse } from 'next/server';
import { AccessError } from './access';
import { PipelineError } from './store';
import { TwelveLabsError } from './twelvelabs';

export function reply(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

/** Maps known errors to their status; everything else becomes a generic 500. */
export function failure(error: unknown) {
  if (error instanceof AccessError || error instanceof PipelineError || error instanceof TwelveLabsError) return reply({ error: error.message }, error.status);
  if (error instanceof SyntaxError) return reply({ error: 'The request is not valid JSON.' }, 400);
  console.error(JSON.stringify({ component: 'highlights-api', error: error instanceof Error ? error.name : 'unknown' }));
  return reply({ error: 'The highlight service could not complete the request.' }, 500);
}
