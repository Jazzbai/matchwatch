import { NextRequest, NextResponse } from 'next/server';
import { findYoutubeVideos, youtubeSports, type YoutubeKind, type YoutubeSport, type YoutubeVideo } from '../../../../lib/stream-youtube';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const cache = new Map<string, { until: number; videos: YoutubeVideo[] }>();
const pending = new Map<string, Promise<YoutubeVideo[]>>();
const failures = new Map<string, number>();
export async function GET(request: NextRequest) {
  const sport = request.nextUrl.searchParams.get('sport') || 'Basketball';
  const kind = request.nextUrl.searchParams.get('kind') || 'recaps';
  if (!youtubeSports.includes(sport as YoutubeSport) || !['recaps', 'past'].includes(kind)) {
    return NextResponse.json({ error: 'Choose a supported sport and video category.' }, { status: 400 });
  }
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) return NextResponse.json({ configured: false, videos: [], error: 'YouTube is ready to connect. Add YOUTUBE_API_KEY to the server environment, then restart the app.' }, { status: 503 });
  const bucket = `${sport}:${kind}`;
  const saved = cache.get(bucket);
  if (saved && saved.until > Date.now()) return NextResponse.json({ configured: true, videos: saved.videos });
  if ((failures.get(bucket) || 0) > Date.now()) return NextResponse.json({ configured: true, videos: [], error: 'YouTube is temporarily unavailable. Try again in a minute.' }, { status: 503 });
  try {
    let task = pending.get(bucket);
    if (!task) {
      task = findYoutubeVideos(key, sport as YoutubeSport, kind as YoutubeKind);
      pending.set(bucket, task);
    }
    const videos = await task;
    cache.set(bucket, { videos, until: Date.now() + 3600000 });
    return NextResponse.json({ configured: true, videos });
  } catch (error) {
    failures.set(bucket, Date.now() + 60000);
    const message = error instanceof Error && error.message === 'YOUTUBE_ACCESS'
      ? 'YouTube rejected the request. Check API activation, key restrictions, and remaining quota in Google Cloud.'
      : 'YouTube could not load videos right now. Try again shortly.';
    return NextResponse.json({ configured: true, videos: [], error: message }, { status: 503 });
  } finally { pending.delete(bucket); }
}
