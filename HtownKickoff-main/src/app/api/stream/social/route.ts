import { NextRequest, NextResponse } from 'next/server';
import { highlightOwner, HighlightAccessError, reserveOperation } from '../../../../lib/highlight-access';
import { searchX, XSearchError } from '../../../../lib/x-social';

export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  try {
    const owner = await highlightOwner(request);
    const allowed = (process.env.X_ALLOWED_USER_IDS || '').split(',').map(id => id.trim());
    if (owner !== 'local' && !allowed.includes(owner)) return reply({ error: 'X access has not been enabled for your account.' }, 403);
    const token = process.env.X_BEARER_TOKEN;
    if (!token) return reply({ error: 'Set X_BEARER_TOKEN on the server to connect X search.' }, 503);
    const body = await request.text();
    if (body.length > 4096) return reply({ error: 'Search settings are too large.' }, 400);
    const input = JSON.parse(body);
    reserveOperation(owner, 'x-search');
    return reply(await searchX(token, input));
  } catch (error) {
    if (error instanceof XSearchError) return reply({ error: error.message }, error.status);
    if (error instanceof HighlightAccessError) return reply({ error: error.message }, error.status);
    if (error instanceof SyntaxError) return reply({ error: 'Invalid search settings.' }, 400);
    return reply({ error: 'Could not load valid X engagement data. Try again shortly.' }, 502);
  }
}
