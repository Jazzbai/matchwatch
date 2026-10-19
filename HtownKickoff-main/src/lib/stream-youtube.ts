export const youtubeSports = ['Basketball', 'Soccer', 'Baseball', 'Football'] as const;
export type YoutubeSport = typeof youtubeSports[number];
export type YoutubeKind = 'recaps' | 'past';
export type YoutubeVideo = { id: string; title: string; channel: string; thumbnail: string; publishedAt: string };
const league: Record<YoutubeSport, string> = { Basketball: 'NBA', Soccer: 'MLS soccer', Baseball: 'MLB', Football: 'NFL' };
export function youtubeQuery(sport: YoutubeSport, kind: YoutubeKind) {
  return `${league[sport]} ${kind === 'recaps' ? 'game highlights recap' : 'full game replay'} -simulation -gameplay -predictions`;
}
function text(value: string) {
  return value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}
export async function findYoutubeVideos(key: string, sport: YoutubeSport, kind: YoutubeKind, fetcher: typeof fetch = fetch): Promise<YoutubeVideo[]> {
  const params = new URLSearchParams({ part: 'snippet', type: 'video', q: youtubeQuery(sport, kind), maxResults: '12',
    videoEmbeddable: 'true', videoSyndicated: 'true', safeSearch: 'moderate', order: 'relevance', key });
  const response = await fetcher(`https://www.googleapis.com/youtube/v3/search?${params}`, { signal: AbortSignal.timeout(12000), cache: 'no-store' });
  if (!response.ok) throw new Error(response.status === 403 ? 'YOUTUBE_ACCESS' : 'YOUTUBE_UNAVAILABLE');
  const data = await response.json() as { items?: Array<{ id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string; publishedAt?: string } }> };
  if (!Array.isArray(data.items)) throw new Error('YOUTUBE_UNAVAILABLE');
  return data.items.flatMap((item) => {
    const id = item.id?.videoId;
    if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id) || !item.snippet?.title) return [];
    return [{ id, title: text(item.snippet.title), channel: text(item.snippet.channelTitle || 'YouTube'),
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, publishedAt: item.snippet.publishedAt || '' }];
  });
}
