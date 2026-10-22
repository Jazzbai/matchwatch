import { parsePosts } from './event-fusion';
export class XSearchError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function searchX(token: string, input: { query: string; matchId: string; start: string; end: string }, transport: typeof fetch = fetch) {
  const { query, matchId, start, end } = input;
  if (typeof query !== 'string' || !query.trim() || query.length > 512 || typeof matchId !== 'string' || !matchId.trim() || matchId.length > 100) throw new XSearchError('Enter a match ID and a search query of at most 512 characters.', 400);
  const date = (v: unknown) => typeof v === 'string' && /(Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
  if (!date(start) || !date(end) || Date.parse(start) >= Date.parse(end) || Date.parse(end) - Date.parse(start) > 6 * 3600000) throw new XSearchError('Enter explicit UTC dates covering at most six hours.', 400);
  const url = new URL('https://api.x.com/2/tweets/search/recent');
  url.search = new URLSearchParams({ query: query.trim(), start_time: new Date(start).toISOString(), end_time: new Date(end).toISOString(), max_results: '100', 'tweet.fields': 'created_at,public_metrics' }).toString();
  const response = await transport(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new XSearchError(response.status === 429 ? 'X rate limit reached. Try again later.' : response.status === 401 || response.status === 403 ? 'Check the server X Bearer Token and search permissions.' : 'X search failed. Check API access and requested dates.', response.status === 429 ? 429 : 502);
  const data = await response.json();
  if (!data || data.errors?.length || data.data !== undefined && !Array.isArray(data.data) || data.data?.length > 100) throw new XSearchError('X returned incomplete or invalid results. Check access or narrow the query.', 502);
  const posts = parsePosts((data.data || []).map((post: { id: string; created_at: string; text: string; public_metrics?: Record<string, number> }) => ({ id: post.id, matchId: matchId.trim(), postedAt: post.created_at, text: post.text, likes: post.public_metrics?.like_count, replies: post.public_metrics?.reply_count, reposts: post.public_metrics?.retweet_count ?? post.public_metrics?.repost_count })));
  return { posts, truncated: !!data.meta?.next_token };
}
