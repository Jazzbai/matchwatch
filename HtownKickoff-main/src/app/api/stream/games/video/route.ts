import { NextRequest, NextResponse } from 'next/server';
import { recentGames } from '../../../../../lib/recent-games';
import { gameRecap } from '../../../../../lib/game-recaps';
import { youtubeSports, type YoutubeSport } from '../../../../../lib/stream-youtube';
import { snapshotGames, snapshotRecap } from '../../../../../lib/stream-snapshot';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const sport = request.nextUrl.searchParams.get('sport'); const id = request.nextUrl.searchParams.get('id'); const kind = request.nextUrl.searchParams.get('kind') || 'recaps';
  if (!youtubeSports.includes(sport as YoutubeSport) || !id || id.length > 80 || !['recaps', 'past'].includes(kind)) return NextResponse.json({ error: 'Invalid match lookup.' }, { status: 400 });
  const key = process.env.YOUTUBE_API_KEY?.trim();
  try {
    const feed = await recentGames(sport as YoutubeSport).catch(() => snapshotGames(sport!)); const game = feed?.games.find((g) => g.id === id);
    if (!game) return NextResponse.json({ error: 'Game not found in the last seven days.' }, { status: 404 });
    const saved = snapshotRecap(game, kind);
    if (!key) return NextResponse.json(saved || { status: 'not_found', reason: 'No checked US recap is saved for this game. Live lookup requires the server YouTube key.' });
    const live = await gameRecap(game, kind as 'recaps' | 'past', key);
    return NextResponse.json(live.status === 'unavailable' && saved ? saved : live);
  } catch { return NextResponse.json({ status: 'unavailable', reason: 'Video matching is temporarily unavailable.' }, { status: 503 }); }
}
