import type { SocialPost, SocialQuery, SocialWindow } from './types';

// Diagram step 3 (X API) and the social half of step 5. Signals are measured from
// post timestamps and public metrics; they describe this sample, not all of X.

export class SocialError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}

const INFLUENCER_FOLLOWERS = 100_000;
const positiveWords = /\b(what a|amazing|incredible|unbelievable|brilliant|class|beautiful|love|wow|legend|get in|yes+)\b/i;
const negativeWords = /\b(terrible|awful|disgrace|robbed|shocking|joke|wrong|never a|cheat|var\?|how is that|embarrassing)\b/i;

/** Recent search with author follower counts. Requires a server-side bearer token. */
export async function searchX(token: string, query: SocialQuery, transport: typeof fetch = fetch): Promise<{ posts: SocialPost[]; truncated: boolean }> {
  const start = Date.parse(query.start), end = Date.parse(query.end);
  if (!query.text.trim() || query.text.length > 512) throw new SocialError('Enter an X search of at most 512 characters.', 400);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end || end - start > 6 * 3600_000) throw new SocialError('The X search window must be a valid range of at most six hours.', 400);
  const url = new URL('https://api.x.com/2/tweets/search/recent');
  url.search = new URLSearchParams({
    query: query.text.trim(), start_time: new Date(start).toISOString(), end_time: new Date(Math.min(end, Date.now() - 10_000)).toISOString(),
    max_results: '100', 'tweet.fields': 'created_at,public_metrics,author_id', expansions: 'author_id', 'user.fields': 'public_metrics',
  }).toString();
  const response = await transport(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!response.ok) {
    const reason = response.status === 429 ? 'X rate limit reached.' : response.status === 401 || response.status === 403 ? 'X rejected the server credentials or search permissions.' : `X search failed (${response.status}).`;
    throw new SocialError(reason, response.status === 429 ? 429 : 502);
  }
  type Tweet = { id: string; created_at: string; text: string; author_id?: string; public_metrics?: Record<string, number> };
  type User = { id: string; public_metrics?: { followers_count?: number } };
  const data = await response.json() as { data?: Tweet[]; includes?: { users?: User[] }; meta?: { next_token?: string } };
  const followers = new Map((data.includes?.users || []).map(user => [user.id, user.public_metrics?.followers_count]));
  const posts = (data.data || []).map(tweet => ({
    id: tweet.id, postedAt: tweet.created_at, text: tweet.text,
    likes: tweet.public_metrics?.like_count ?? 0, replies: tweet.public_metrics?.reply_count ?? 0,
    reposts: tweet.public_metrics?.retweet_count ?? tweet.public_metrics?.repost_count ?? 0,
    authorFollowers: tweet.author_id ? followers.get(tweet.author_id) : undefined,
  }));
  return { posts, truncated: !!data.meta?.next_token };
}

const engagement = (post: SocialPost) => 1 + Math.log1p(post.likes + 2 * post.replies + 3 * post.reposts);

export type WindowOptions = {
  videoStartUtc: string;
  reactionDelaySeconds: number;
  keywords: string[];
  entities: string[];
};

/**
 * Measures fan response to one moment: posts are shifted by the reaction delay onto the
 * video timeline, then the moment's window is compared with equal-width baseline windows.
 */
export function measureSocialWindow(moment: { start: number; end: number }, posts: SocialPost[], options: WindowOptions): SocialWindow {
  const zero = Date.parse(options.videoStartUtc);
  const timed = posts.map(post => ({ post, time: (Date.parse(post.postedAt) - zero) / 1000 - options.reactionDelaySeconds }));
  const windowStart = moment.start - 5, width = Math.max(20, moment.end - moment.start + 25);
  const bins = new Map<number, { count: number; engagement: number }>();
  for (const { post, time } of timed) {
    const bin = Math.floor((time - windowStart) / width);
    const current = bins.get(bin) || { count: 0, engagement: 0 };
    bins.set(bin, { count: current.count + 1, engagement: current.engagement + engagement(post) });
  }
  const inWindow = timed.filter(({ time }) => time >= windowStart && time < windowStart + width).map(item => item.post);

  const indices = [...bins.keys()];
  const baseline: number[] = [];
  if (indices.length) for (let bin = Math.min(...indices); bin <= Math.max(...indices); bin++) if (bin !== 0) baseline.push(bins.get(bin)?.count ?? 0);
  let zScore: number | null = null;
  if (baseline.length >= 3) {
    const mean = baseline.reduce((sum, value) => sum + value, 0) / baseline.length;
    const variance = baseline.reduce((sum, value) => sum + (value - mean) ** 2, 0) / baseline.length;
    zScore = (inWindow.length - mean) / Math.max(1, Math.sqrt(variance), Math.sqrt(mean));
  }

  const busiest = Math.max(0, ...[...bins.values()].map(bin => bin.engagement));
  const windowEngagement = inWindow.reduce((sum, post) => sum + engagement(post), 0);
  const terms = [...options.keywords, ...options.entities].map(term => term.toLowerCase()).filter(Boolean);
  const relevant = inWindow.filter(post => terms.some(term => post.text.toLowerCase().includes(term)));
  return {
    posts: inWindow.length,
    engagement: windowEngagement,
    zScore,
    engagementShare: busiest ? windowEngagement / busiest : 0,
    keywordShare: inWindow.length ? relevant.length / inWindow.length : 0,
    positive: inWindow.filter(post => positiveWords.test(post.text)).length,
    negative: inWindow.filter(post => negativeWords.test(post.text)).length,
    influencerPosts: inWindow.filter(post => (post.authorFollowers ?? 0) >= INFLUENCER_FOLLOWERS).length,
    mentions: options.entities.filter(entity => inWindow.some(post => post.text.toLowerCase().includes(entity.toLowerCase()))),
    postIds: inWindow.map(post => post.id),
  };
}

/** Top hashtags across the sample (diagram: trending topics/hashtags). */
export function trendingHashtags(posts: SocialPost[], limit = 8) {
  const counts = new Map<string, number>();
  for (const post of posts) for (const tag of post.text.match(/#\w+/g) || []) counts.set(tag.toLowerCase(), (counts.get(tag.toLowerCase()) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([tag, count]) => ({ tag, count }));
}
