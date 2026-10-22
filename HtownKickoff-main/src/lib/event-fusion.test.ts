import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultSignalWeights, fuseEvents, fusedScore, parseAnchors, parsePosts, parseStats, statsVideoTime, type FusionInputs } from './event-fusion';
import { optimizeHighlights } from './highlight-optimizer';
import type { HighlightEvent } from './highlight-plan';
function event(id: string, start: number, score = 0.8): HighlightEvent {
  return { id, label: 'Dunk', start, end: start + 10, confidence: 0, importance: 0.8, context: 0, audio: 0, reaction: 0, preference: 0,
    jev: { candidate_id: id, event: 'Dunk', importance_estimate: score, excitement_estimate: score, watchability_estimate: score, match_context: null, duplicate_of: null, suggested_start: start, suggested_end: start + 10, recommend_include: true, reason: 'Visible verified dunk.', needs_review: false } };
}
const inputs: FusionInputs = { matchId: 'game', stats: [], posts: [], anchors: [], videoUtc: '', reactionDelay: 15, tolerance: 3 };

test('countdown and count-up periods align explicitly and unknown periods stay unaligned', () => {
  const anchors = parseAnchors([{ period: 'Q1', clockSeconds: 720, videoSeconds: 120, direction: 'down', duration: 720 }, { period: 'H2', clockSeconds: 2700, videoSeconds: 3600, direction: 'up', duration: 3000 }]);
  const stat = parseStats([{ id: 's', matchId: 'game', period: 'Q1', clockSeconds: 700, eventType: 'Dunk' }])[0];
  assert.equal(statsVideoTime(stat, anchors), 140);
  assert.equal(statsVideoTime({ ...stat, period: 'H2', clockSeconds: 2715 }, anchors), 3615);
  assert.equal(statsVideoTime({ ...stat, period: 'Q2' }, anchors), null);
  assert.equal(statsVideoTime({ ...stat, clockSeconds: 730 }, anchors), null);
});

test('fusion rejects other matches and incompatible event labels while keeping missing evidence null', () => {
  const stats = parseStats([{ id: 'valid', matchId: 'game', period: 'Q1', clockSeconds: 700, eventType: 'DUNK', importance: 0.9 }, { id: 'wrong-match', matchId: 'other', period: 'Q1', clockSeconds: 700, eventType: 'Dunk', controversy: 1 }, { id: 'wrong-action', matchId: 'game', period: 'Q1', clockSeconds: 700, eventType: 'Foul', audience: 1 }]);
  const anchors = parseAnchors([{ period: 'Q1', clockSeconds: 720, videoSeconds: 120, direction: 'down', duration: 720 }]);
  const fused = fuseEvents([event('a', 139)], { ...inputs, stats, anchors }, defaultSignalWeights)[0];
  assert.deepEqual(fused.viral?.statsIds, ['valid']);
  assert.equal(fused.viral?.values.sports, 0.9); assert.equal(fused.viral?.values.social, null);
  assert.equal(fused.viral?.values.controversy, null); assert.equal(fused.viral?.values.audience, null);
  assert.ok(fusedScore(fused.viral!).coverage < 1);
});

test('posts need a UTC anchor, exact match ID and reaction-delay correction', () => {
  const posts = parsePosts([{ id: 'valid', matchId: 'game', postedAt: '2026-10-22T18:02:35Z', likes: 20, replies: 2, reposts: 1 }, { id: 'other', matchId: 'other', postedAt: '2026-10-22T18:02:35Z', likes: 999, replies: 0, reposts: 0 }]);
  assert.equal(fuseEvents([event('a', 139)], { ...inputs, posts }, defaultSignalWeights)[0].viral?.values.social, null);
  const fused = fuseEvents([event('a', 139)], { ...inputs, posts, videoUtc: '2026-10-22T18:00:00Z' }, defaultSignalWeights)[0];
  assert.deepEqual(fused.viral?.postIds, ['valid']); assert.equal(fused.viral?.values.social, 1);
});

test('approved social weighting can change the best combination but cannot bypass uncertain-video checks', () => {
  const events = [event('early', 0, 0.8), event('later', 40, 0.6)];
  const posts = parsePosts([{ id: 'reaction', matchId: 'game', postedAt: '2026-10-22T18:00:55Z', likes: 50, replies: 10, reposts: 5 }]);
  const fused = fuseEvents(events, { ...inputs, posts, videoUtc: '2026-10-22T18:00:00Z' }, { sports: 0.1, social: 0.6, emotion: 0.2, quality: 0.1, controversy: 0, audience: 0 });
  assert.deepEqual(optimizeHighlights(events, 100, 10, 0, 0).map(c => c.id), ['early']);
  assert.deepEqual(optimizeHighlights(fused, 100, 10, 0, 0).map(c => c.id), ['later']);
  fused[1].jev!.needs_review = true;
  assert.deepEqual(optimizeHighlights(fused, 100, 10, 0, 0).map(c => c.id), ['early']);
});

test('snapshot validation rejects duplicate IDs, invalid metrics, ambiguous clocks and timezone-free posts', () => {
  const post = { id: 'p', matchId: 'game', postedAt: '2026-10-22T18:00:00Z', likes: 0, replies: 0, reposts: 0 };
  assert.throws(() => parsePosts([post, post]));
  assert.throws(() => parsePosts([{ ...post, likes: -1 }]));
  assert.throws(() => parsePosts([{ ...post, postedAt: '2026-10-22T18:00:00' }]));
  assert.throws(() => parseStats([{ id: 's', matchId: 'game', period: 'Q1', clockSeconds: 20, eventType: 'Dunk', importance: 2 }]));
  assert.throws(() => parseAnchors([{ period: 'Q1', clockSeconds: 720, videoSeconds: 0, direction: 'guess', duration: 720 }]));
});
