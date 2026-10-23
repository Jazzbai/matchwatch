import assert from 'node:assert/strict';
import { test } from 'node:test';
import { measureSocialWindow, searchX, trendingHashtags } from './social-signals';
import type { SocialPost } from './types';

const zero = Date.parse('2026-10-25T16:00:00Z');
const post = (id: string, videoSecond: number, overrides: Partial<SocialPost> = {}): SocialPost => ({
  id, postedAt: new Date(zero + (videoSecond + 20) * 1000).toISOString(), text: 'match', likes: 1, replies: 0, reposts: 0, ...overrides,
});
const options = { videoStartUtc: '2026-10-25T16:00:00Z', reactionDelaySeconds: 20, keywords: ['goal'], entities: ['Solanke'] };

test('measures a post-volume spike against equal-width baseline windows', () => {
  const baseline = [0, 30, 60, 90, 120, 150].map((second, index) => post(`b${index}`, second));
  const burst = Array.from({ length: 12 }, (_, index) => post(`s${index}`, 400 + index, { text: 'GOAL Solanke!!', likes: 500 }));
  const window = measureSocialWindow({ start: 400, end: 410 }, [...baseline, ...burst], options);
  assert.equal(window.posts, 12);
  assert.ok(window.zScore! > 3, `z = ${window.zScore}`);
  assert.equal(window.engagementShare, 1);
  assert.equal(window.keywordShare, 1);
  assert.deepEqual(window.mentions, ['Solanke']);
  assert.equal(window.positive, 0);
});

test('reports no z-score without enough baseline windows', () => {
  const window = measureSocialWindow({ start: 400, end: 410 }, [post('a', 401), post('b', 402)], options);
  assert.equal(window.zScore, null);
  assert.equal(window.posts, 2);
});

test('finds trending hashtags', () => {
  assert.deepEqual(trendingHashtags([post('a', 0, { text: '#COYS #MUFC' }), post('b', 0, { text: '#coys' })]), [{ tag: '#coys', count: 2 }, { tag: '#mufc', count: 1 }]);
});

test('X search sends the bearer token and maps follower counts', async () => {
  const transport = (async (url: URL, init: RequestInit) => {
    assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer token');
    assert.equal(url.searchParams.get('expansions'), 'author_id');
    return Response.json({
      data: [{ id: '1', created_at: '2026-10-25T16:01:00Z', text: 'What a goal', author_id: 'u', public_metrics: { like_count: 5, reply_count: 1, retweet_count: 2 } }],
      includes: { users: [{ id: 'u', public_metrics: { followers_count: 250000 } }] },
    });
  }) as unknown as typeof fetch;
  const result = await searchX('token', { text: 'Spurs', start: '2026-10-25T16:00:00Z', end: '2026-10-25T18:00:00Z' }, transport);
  assert.deepEqual(result.posts[0], { id: '1', postedAt: '2026-10-25T16:01:00Z', text: 'What a goal', likes: 5, replies: 1, reposts: 2, authorFollowers: 250000 });
  await assert.rejects(() => searchX('token', { text: 'Spurs', start: '2026-10-25T16:00:00Z', end: '2026-10-26T16:00:00Z' }, transport));
});
