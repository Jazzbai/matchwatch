import { NextRequest, NextResponse } from 'next/server';
import { highlightOwner, HighlightAccessError, reserveOperation } from '../../../../lib/highlight-access';
import { ScorePlayClient, ScorePlayError, scorePlayAllowed } from '../../../../lib/scoreplay';

export const runtime = 'nodejs';
export const maxDuration = 240;
function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof ScorePlayError || error instanceof HighlightAccessError ? error.message : 'ScorePlay request failed. Try again shortly.' }, { status: error instanceof ScorePlayError || error instanceof HighlightAccessError ? error.status : 502, headers: { 'Cache-Control': 'no-store' } });
}
async function access(request: NextRequest) {
  const owner = await highlightOwner(request);
  if (!scorePlayAllowed(owner)) throw new HighlightAccessError('ScorePlay access has not been enabled for your MatchWatch account.', 403);
  const key = process.env.SCOREPLAY_API_KEY;
  if (!key) throw new ScorePlayError('ScorePlay is not connected on this server yet.', 503);
  return { owner, client: new ScorePlayClient(key) };
}
export async function GET(request: NextRequest) {
  try {
    const { owner, client } = await access(request); reserveOperation(owner, 'search');
    return NextResponse.json({ media: await client.search(request.nextUrl.searchParams.get('q') || '') }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  let release: (() => void) | undefined;
  try {
    const { owner, client } = await access(request); release = reserveOperation(owner, 'scoreplay-import');
    const id = request.nextUrl.searchParams.get('mediaId') || '';
    const file = await client.download(id, request.signal);
    return new Response(file.bytes, { headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(file.bytes.byteLength), 'Content-Disposition': `attachment; filename="${file.name}"`, 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
  finally { release?.(); }
}
