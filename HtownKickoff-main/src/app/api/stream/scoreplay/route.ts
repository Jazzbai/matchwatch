import { NextRequest, NextResponse } from 'next/server';
import { requestOwner as highlightOwner, AccessError as HighlightAccessError, reserve, videoTicket } from '../../../../lib/highlights/access';
import { ScorePlayClient, ScorePlayError, scorePlayAllowed, requireScorePlayExternalProcessing } from '../../../../lib/scoreplay';
import { ScorePlayFilterError, type ScorePlayFilters } from '../../../../lib/scoreplay-filters';
import { scorePlayMapping } from '../../../../lib/scoreplay-mapping';
import { TwelveLabsError } from '../../../../lib/highlights/twelvelabs';

export const runtime = 'nodejs';
export const maxDuration = 240;
const reserveOperation = (owner: string) => reserve(owner, 'request');
function failure(error: unknown) {
  if (error instanceof TwelveLabsError) return NextResponse.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'no-store' } });
  if (error instanceof ScorePlayFilterError) return NextResponse.json({ error: error.message }, { status: 400 });
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
    const { owner, client } = await access(request); reserveOperation(owner);
    const params = request.nextUrl.searchParams;
    if (params.get('action') === 'mapping') {
      const report = await scorePlayMapping().diagnostics(params.get('refresh') === 'true');
      const mappings = Object.fromEntries(Object.entries(report.mappings).map(([id, mapping]) => [id, { twelvelabsVideoId: mapping.twelvelabsVideoId, matchedBy: mapping.matchedBy, metadataKey: mapping.metadataKey, duration: mapping.duration }]));
      return NextResponse.json({ ...report, mappings }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (params.get('action') === 'filters') return NextResponse.json(await client.filterOptions(params.get('leagueId') || undefined), { headers: { 'Cache-Control': 'no-store' } });
    const filters: ScorePlayFilters = Object.fromEntries(['leagueId', 'seasonId', 'matchId', 'year', 'from', 'to', 'order'].map(key => [key, params.get(key) || undefined]));
    return NextResponse.json(await client.searchPage(params.get('q') || '', filters, Number(params.get('page') || 1)), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  let release: (() => void) | undefined;
  try {
    const { owner, client } = await access(request); release = reserveOperation(owner);
    const id = request.nextUrl.searchParams.get('mediaId') || '';
    if (request.nextUrl.searchParams.get('mode') === 'source') {
      const media = await client.media(id), mapping = await scorePlayMapping().resolve(media);
      const preview = [media.proxy_medium, media.streaming_url, mapping.previewUrl].find(value => typeof value === 'string' && value.startsWith('https://')) || '';
      return NextResponse.json({ name: media.name, duration: mapping.duration, url: preview, bytes: 0, mediaId: id, matchedBy: mapping.matchedBy, canExport: false,
        assetTicket: videoTicket(mapping.assetId, owner), indexedTicket: videoTicket(mapping.twelvelabsVideoId, owner),
        ticket: videoTicket(mapping.twelvelabsVideoId, owner) }, { headers: { 'Cache-Control': 'no-store' } });
    }
    requireScorePlayExternalProcessing();
    const file = await client.download(id, request.signal);
    return new Response(file.bytes, { headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(file.bytes.byteLength), 'Content-Disposition': `attachment; filename="${file.name}"`, 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
  finally { release?.(); }
}
