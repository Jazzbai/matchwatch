import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankViralMoments } from './viral-ranking';
import { defaultSignalWeights, fusedScore, parseAudience, audienceRelevance, discussionDisagreement, parsePosts, socialSpike, type FusionInputs } from './event-fusion';
import { parseJevReviews, jevPrompt, type JevReview } from './jev';
import type { HighlightEvent } from './highlight-plan';
const input: FusionInputs = { matchId: 'game', stats: [], posts: [], anchors: [], videoUtc: '2026-10-22T18:00:00Z', reactionDelay: 0, tolerance: 0 };
function event(id: string, start: number): HighlightEvent {
  return { id, label: 'Dunk', start, end: start + 5, confidence: 0, importance: 0, context: 0, audio: 0, reaction: 0, preference: 0,
    jev: { candidate_id: id, event: 'Dunk', importance_estimate: 0.8, excitement_estimate: 1, watchability_estimate: 1, emotional_intensity: { score: 0.6, evidence: `Visible celebration at ${start} seconds.` }, controversy_surprise: { score: null, evidence: 'No supported judgment.' }, match_context: null, duplicate_of: null, suggested_start: start, suggested_end: start + 5, recommend_include: true, reason: 'Verified dunk.', needs_review: false } };
}
test('five fixed weights redistribute only known factors and contributions sum to score', () => {
  assert.equal(Object.values(defaultSignalWeights).reduce((a, b) => a + b), 1);
  const result = fusedScore({ values: { sports: 0.8, social: null, emotion: 0.6, controversy: null, audience: null }, weights: defaultSignalWeights, statsIds: [], postIds: [], reasons: [] });
  assert.ok(Math.abs(result.score! - 0.72) < 1e-10);
  assert.equal(result.coverage, 0.5); assert.equal(result.effectiveWeights.sports, 0.6);
  assert.ok(Math.abs(Object.values(result.contributions).reduce((a, b) => a + b) - result.score!) < 1e-10);
});
test('ranking returns five deterministic non-overlapping moments with evidence, not fabricated confidence', () => {
  const events = Array.from({ length: 8 }, (_, i) => event(`clip${i}`, i * 10));
  events.push(event('overlap', 1));
  const result = rankViralMoments(events, input, 100);
  assert.equal(result.moments.length, 5); assert.ok(result.total_seconds <= 60);
  for (const moment of result.moments) { assert.equal(moment.confidence.calibrated_probability, null); assert.equal(moment.scores.audience, null); }
  for (const a of result.moments) for (const b of result.moments) if (a !== b) assert.ok(a.timestamp.end <= b.timestamp.start || b.timestamp.end <= a.timestamp.start);
  assert.deepEqual(result, rankViralMoments([...events].reverse(), input, 100));
});
test('unsafe, duplicate, unknown and unreviewed candidates cannot enter automatic top five', () => {
  const good = event('good', 0), duplicate = event('duplicate', 20), uncertain = event('uncertain', 40);
  duplicate.jev!.duplicate_of = 'good'; uncertain.jev!.needs_review = true;
  const noReview = { ...event('none', 60), jev: undefined };
  assert.deepEqual(rankViralMoments([good, duplicate, uncertain, noReview], input, 100).moments.map(m => m.event_id), ['good']);
  assert.equal(rankViralMoments([{ ...good, jev: { ...good.jev!, importance_estimate: null, emotional_intensity: undefined } }], input, 100).moments.length, 0);
});
test('audience uses sourced event identity and known preferences; absent metadata stays unknown', () => {
  const context = parseAudience({ matchId: 'game', preferredEntities: ['team'], events: [{ eventId: 'a', entityIds: ['team'], popularity: 0.8, source: 'Official roster metrics' }] });
  assert.equal(audienceRelevance('a', context), 0.9); assert.equal(audienceRelevance('b', context), null); assert.equal(audienceRelevance('a', context, 'other-game'), null);
  assert.throws(() => parseAudience({ ...context, events: [{ ...context.events[0], popularity: 2 }] }));
  assert.throws(() => parseAudience({ ...context, events: [{ ...context.events[0], source: '' }] }));
});
test('opposing discussion requires both viewpoints and does not infer controversy from likes', () => {
  const posts = parsePosts(['correct call', 'right call', 'wrong call', 'bad call'].map((text, i) => ({ id: `${i}`, matchId: 'game', postedAt: input.videoUtc, likes: 100, replies: 50, reposts: 0, text })));
  assert.equal(discussionDisagreement(posts), 1);
  assert.equal(discussionDisagreement(posts.slice(0, 2)), null);
  assert.equal(discussionDisagreement(posts.map(p => ({ ...p, text: 'A dunk!' }))), null);
});
test('engagement spike needs preceding baseline, ignores other matches', () => {
  const posts = parsePosts([5, 15, 25, 35, 45, 52, 53, 54, 55, 56, 57, 58, 59].map((second, i) => ({ id: `${i}`, matchId: 'game', postedAt: new Date(Date.parse(input.videoUtc) + second * 1000).toISOString(), likes: 0, replies: 0, reposts: 0 })));
  assert.ok(socialSpike({ start: 50, end: 60 }, { ...input, posts })! > 0.8);
  assert.equal(socialSpike({ start: 50, end: 60 }, { ...input, posts: posts.map(p => ({ ...p, matchId: 'other' })) }), null);
});
test('LLM signal validation rejects unsupported scores and requires evidence', () => {
  const review = event('a', 10).jev!;
  assert.throws(() => parseJevReviews({ reviews: [{ ...review, emotional_intensity: { score: 2, evidence: 'x' } }] }));
  assert.throws(() => parseJevReviews({ reviews: [{ ...review, controversy_surprise: { score: 0.9, evidence: '' } }] }));
  assert.equal(parseJevReviews({ reviews: [review] }).length, 1);
  assert.match(jevPrompt([{ id: 'a', label: 'Dunk', start: 10, end: 15 }]), /not a guarantee/);
  void (review as JevReview);
});
