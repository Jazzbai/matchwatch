import { NextRequest, NextResponse } from 'next/server';
import { recentGames } from '../../../../lib/recent-games';
import { youtubeSports, type YoutubeSport } from '../../../../lib/stream-youtube';
import { snapshotGames } from '../../../../lib/stream-snapshot';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const sport = request.nextUrl.searchParams.get('sport') || 'Soccer';
  if (sport !== 'All' && !youtubeSports.includes(sport as YoutubeSport)) return NextResponse.json({ error: 'Unsupported sport.' }, { status: 400 });
  try { return NextResponse.json(await recentGames(sport as YoutubeSport | 'All')); }
  catch {
    const snapshot = snapshotGames(sport);
    if (snapshot) return NextResponse.json(snapshot);
    return NextResponse.json({ error: 'The real results feed could not load. Please retry; sample games are never substituted.' }, { status: 503 });
  }
}
