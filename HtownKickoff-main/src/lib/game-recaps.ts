import type { RecentGame } from './recent-games';
import type { YoutubeVideo } from './stream-youtube';
export type RecapResult = { status: 'matched' | 'not_found' | 'unavailable'; video?: YoutubeVideo; reason?: string; checkedAt?: string };
export function availableInUS(restriction?: { allowed?: string[]; blocked?: string[] }) {
  if (restriction?.blocked?.includes('US')) return false;
  if (restriction?.allowed !== undefined && !restriction.allowed.includes('US')) return false;
  return true;
}
function normalized(text: string) { return text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
export function matchesGame(game: RecentGame, title: string, description: string, publishedAt: string, kind: string): boolean {
  const heading = ` ${normalized(title)} `;
  const teamMatch = (terms: string[]) => terms.some((term) => { const clean = normalized(term).replace(/\b(fc|cf|afc|sc)\b/g, '').replace(/\s+/g, ' ').trim(); return clean.length >= 4 && heading.includes(` ${clean} `); });
  if (!teamMatch(game.homeTerms) || !teamMatch(game.awayTerms)) return false;
  if (/\b(prediction|simulation|gameplay|watchalong|reaction|nba 2k|fc 26|fc 25|madden|highlights concept)\b/i.test(title)) return false;
  if (kind === 'recaps' && !/highlight|recap/i.test(title)) return false;
  if (kind === 'past' && (!/full (game|match)|complete (game|match)|full replay/i.test(title) || /highlights|recap/i.test(title))) return false;
  const start = Date.parse(game.date); const upload = Date.parse(publishedAt);
  if (!Number.isFinite(upload) || upload < start || upload > start + 4 * 86400000) return false;
  // Require an explicit game date; upload time alone cannot distinguish repeated matchups.
  const content = ` ${normalized(`${title} ${description}`)} `;
  for (const zone of ['UTC', 'America/Chicago']) {
    const date = new Date(start);
    const parts = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: zone }).formatToParts(date);
    const number = (part: string) => Number(parts.find((p) => p.type === part)?.value);
    const year = number('year'); const m = number('month'); const day = number('day');
    const month = date.toLocaleString('en-US', { month: 'long', timeZone: zone }); const short = month.slice(0, 3);
    const formats = [`${year}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`, `${m}/${day}/${year}`, `${String(m).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`, `${month} ${day}, ${year}`, `${short} ${day}, ${year}`, `${day} ${month} ${year}`, `${day} ${short} ${year}`];
    if (formats.some((value) => content.includes(` ${normalized(value)} `))) return true;
  }
  // Many official league highlights omit the date. Permit upload-time matching only
  // for a unique pairing in this week; repeat matchups still require an explicit date.
  const raw = `${title} ${description}`;
  const hasDate = /\b20\d{2}[-/]\d{1,2}[-/]\d{1,2}\b|\b\d{1,2}[/.]\d{1,2}[/.](?:20)?\d{2}\b|\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}\b/i.test(raw);
  const years = title.match(/\b20\d{2}\b/g) || [];
  const currentYear = String(new Date(start).getUTCFullYear());
  return Boolean(game.uniquePairing && !hasDate && years.every((year) => year === currentYear) && upload >= start + 3600000 && upload <= start + 48 * 3600000);
}
const cache = new Map<string, { until: number; result: RecapResult }>();
const pending = new Map<string, Promise<RecapResult>>();
const publisherHandles = ['NBA', 'WNBA', 'MLB', 'NFL', 'MLS', 'premierleague', 'LaLiga', 'bundesliga', 'seriea', 'Ligue1', 'UEFA', 'realmadrid', 'FCBarcelona', 'NBCSports', 'CBSSportsGolazo', 'SkySportsFootball', 'ESPNFC', 'LigaBBVAMX', 'TUDNUSA', 'beINSPORTSUSA', 'ESPN', 'CFBonFOX'];
let publisherIds: { until: number; ids: Set<string> } | undefined;
let uploadPlaylists: string[] = [];
let publisherTask: Promise<Set<string>> | undefined;
async function trustedPublishers(key: string, fetcher: typeof fetch) {
  if (publisherIds && publisherIds.until > Date.now()) return publisherIds.ids;
  if (publisherTask) return publisherTask;
  publisherTask = (async () => {
    const ids = new Set<string>();
    await Promise.all(publisherHandles.map(async (handle) => {
      const params = new URLSearchParams({ part: 'id,contentDetails', forHandle: handle, key });
      try {
        const r = await fetcher(`https://www.googleapis.com/youtube/v3/channels?${params}`, { signal: AbortSignal.timeout(12000), cache: 'no-store' });
        if (!r.ok) return;
        const d = await r.json() as { items?: Array<{ id: string; contentDetails?: { relatedPlaylists?: { uploads?: string } } }> };
        for (const item of d.items || []) { ids.add(item.id); const playlist = item.contentDetails?.relatedPlaylists?.uploads; if (playlist) uploadPlaylists.push(playlist); }
      } catch { /* Unknown publishers are never implicitly trusted. */ }
    }));
    if (!ids.size) throw new Error('PUBLISHERS_UNAVAILABLE');
    publisherIds = { ids, until: Date.now() + 86400000 }; return ids;
  })();
  try { return await publisherTask; } finally { publisherTask = undefined; }
}
type Candidate = { id: { videoId: string }; snippet: { title: string; description: string; publishedAt: string; channelTitle: string; channelId: string } };
let weekIndex: { until: number; items: Candidate[] } | undefined;
let weekTask: Promise<Candidate[]> | undefined;
async function weeklyUploads(key: string, fetcher: typeof fetch): Promise<Candidate[]> {
  if (weekIndex && weekIndex.until > Date.now()) return weekIndex.items;
  if (weekTask) return weekTask;
  weekTask = (async () => {
    await trustedPublishers(key, fetcher);
    const videos = new Map<string, Candidate>(); const cutoff = Date.now() - 11 * 86400000;
    let successes = 0; let failures = 0;
    await Promise.all([...new Set(uploadPlaylists)].map(async (playlistId) => {
      let pageToken = '';
      for (let page = 0; page < 4; page++) {
        try {
          const params = new URLSearchParams({ part: 'snippet,contentDetails', playlistId, maxResults: '50', key }); if (pageToken) params.set('pageToken', pageToken);
          const r = await fetcher(`https://www.googleapis.com/youtube/v3/playlistItems?${params}`, { signal: AbortSignal.timeout(12000), cache: 'no-store' });
          if (!r.ok) throw new Error('UPLOADS_UNAVAILABLE');
          const data = await r.json() as { nextPageToken?: string; items?: Array<{ snippet: Candidate['snippet'] & { resourceId?: { videoId: string } }; contentDetails?: { videoId: string; videoPublishedAt: string } }> };
          successes++; let older = false;
          for (const item of data.items || []) {
            const publishedAt = item.contentDetails?.videoPublishedAt || item.snippet.publishedAt;
            if (Date.parse(publishedAt) < cutoff) { older = true; continue; }
            const videoId = item.contentDetails?.videoId || item.snippet.resourceId?.videoId;
            if (videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId)) videos.set(videoId, { id: { videoId }, snippet: { ...item.snippet, publishedAt } });
          }
          if (older || !data.nextPageToken) break; pageToken = data.nextPageToken;
        } catch { failures++; break; }
      }
    }));
    if (failures && !successes) throw new Error('UPLOADS_UNAVAILABLE');
    const items = [...videos.values()]; weekIndex = { items, until: Date.now() + (failures ? 60000 : 6 * 3600000) }; return items;
  })();
  try { return await weekTask; } finally { weekTask = undefined; }
}
export async function gameRecap(game: RecentGame, kind: 'recaps' | 'past', key: string, fetcher: typeof fetch = fetch): Promise<RecapResult> {
  const bucket = `US:${game.id}:${game.date}:${kind}`; const hit = cache.get(bucket); if (hit && hit.until > Date.now()) return hit.result;
  const existing = pending.get(bucket); if (existing) return existing;
  const task = (async (): Promise<RecapResult> => {
    try {
      const trusted = await trustedPublishers(key, fetcher);
      const uploads = await weeklyUploads(key, fetcher);
      const candidates = uploads.filter((item) => trusted.has(item.snippet.channelId) && matchesGame(game, item.snippet.title, item.snippet.description, item.snippet.publishedAt, kind)).slice(0, 10);
      if (!candidates.length) return { status: 'not_found', reason: 'No date-matched video from an allowlisted sports publisher was found.' };
      const detailsParams = new URLSearchParams({ part: 'snippet,status,contentDetails', id: candidates.map((c) => c.id!.videoId).join(','), key });
      const detailsResponse = await fetcher(`https://www.googleapis.com/youtube/v3/videos?${detailsParams}`, { signal: AbortSignal.timeout(12000), cache: 'no-store' });
      if (!detailsResponse.ok) return { status: 'unavailable', reason: 'Video details could not be checked.' };
      const details = await detailsResponse.json() as { items?: Array<{ id: string; snippet: Candidate['snippet']; status?: { embeddable: boolean; privacyStatus: string }; contentDetails?: { duration: string; regionRestriction?: { allowed?: string[]; blocked?: string[] } } }> };
      const match = details.items?.find((item) => {
        const duration = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(item.contentDetails?.duration || '');
        const seconds = duration ? Number(duration[1] || 0) * 3600 + Number(duration[2] || 0) * 60 + Number(duration[3] || 0) : 0;
        return (kind !== 'past' || seconds >= 1800) && item.status?.privacyStatus === 'public' && availableInUS(item.contentDetails?.regionRestriction) && trusted.has(item.snippet.channelId) && matchesGame(game, item.snippet.title, item.snippet.description, item.snippet.publishedAt, kind);
      });
      if (!match?.snippet || !match.id) return { status: 'not_found', reason: 'No matching publisher video eligible for US viewing was found.' };
      return { status: 'matched', video: { id: match.id, title: match.snippet.title.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"'), channel: match.snippet.channelTitle, thumbnail: `https://i.ytimg.com/vi/${match.id}/hqdefault.jpg`, publishedAt: match.snippet.publishedAt } };
    } catch { return { status: 'unavailable', reason: 'YouTube lookup failed. Try again later.' }; }
  })();
  pending.set(bucket, task);
  try { const result = await task; if (cache.size > 2000) cache.clear(); cache.set(bucket, { result, until: Date.now() + (result.status === 'unavailable' ? 60000 : 6 * 3600000) }); return result; }
  finally { pending.delete(bucket); }
}
