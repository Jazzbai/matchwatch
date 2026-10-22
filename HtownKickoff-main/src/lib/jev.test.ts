import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jevUtility, reviewInput, validateJevReviews, type JevReview } from './jev';
import { planHighlights, type HighlightEvent } from './highlight-plan';
import { optimizeHighlights } from './highlight-optimizer';
const candidates = [{ id: 'goal', label: 'Goal', start: 20, end: 25 }, { id: 'replay', label: 'Replay', start: 60, end: 65 }];
function review(id = 'goal', changes: Partial<JevReview> = {}): JevReview {
  return { candidate_id: id, event: 'goal', importance_estimate: 0.9, excitement_estimate: null, watchability_estimate: 0.8, match_context: null, duplicate_of: null, suggested_start: 15, suggested_end: 30, recommend_include: true, reason: 'Visible shot enters the goal.', needs_review: false, ...changes };
}
function event(id: string, jev: JevReview): HighlightEvent {
  return { ...candidates.find(c => c.id === id)!, confidence: 0, importance: 0.8, context: 0.5, audio: 0, reaction: 0, preference: 0.5, jev };
}
test('unknown evidence stays null and is excluded from the weighted denominator', () => {
  assert.ok(Math.abs(jevUtility(review()) - (0.9 * 0.5 + 0.8 * 0.2) / 0.7) < 1e-10);
  assert.equal(jevUtility(review('goal', { importance_estimate: null, watchability_estimate: null })), 0);
});
test('reviews must match all candidate IDs and contain finite, bounded evidence', () => {
  const good = [review(), review('replay', { suggested_start: 55, suggested_end: 70, duplicate_of: 'goal' })];
  assert.equal(validateJevReviews(good, candidates, 100).length, 2);
  for (const bad of [good.slice(0, 1), [review(), review()], [review('unknown'), good[1]], [review('goal', { importance_estimate: 2 }), good[1]], [review('goal', { suggested_end: Infinity }), good[1]], [review('goal', { suggested_start: 0, suggested_end: 99 }), good[1]], [review('goal', { duplicate_of: 'replay' }), good[1]]]) assert.throws(() => validateJevReviews(bad, candidates, 100));
});
test('candidate validation bounds paid analysis input', () => {
  assert.equal(reviewInput(candidates, 100).length, 2);
  assert.throws(() => reviewInput(Array(21).fill(candidates[0]), 100));
  assert.throws(() => reviewInput(candidates, 20));
  assert.throws(() => reviewInput([candidates[0], candidates[0]], 100));
});

test('a clearer later replay may replace the original, but duplicate cycles and self-links are rejected', () => {
  const reviews = [review('goal', { duplicate_of: 'replay', watchability_estimate: 0.3 }), review('replay', { suggested_start: 55, suggested_end: 70, watchability_estimate: 0.95 })];
  const checked = validateJevReviews(reviews, candidates, 100);
  assert.deepEqual(optimizeHighlights(checked.map(r => event(r.candidate_id, r)), 100, 60).map(c => c.id), ['replay']);
  assert.throws(() => validateJevReviews([review('goal', { duplicate_of: 'goal' }), reviews[1]], candidates, 100));
  assert.throws(() => validateJevReviews([reviews[0], { ...reviews[1], duplicate_of: 'goal' }], candidates, 100));
});
test('planner separates recommendation from selection and preserves reviewed boundaries', () => {
  const goal = event('goal', review());
  assert.equal(planHighlights([goal], 100, 10).length, 0);
  const plan = planHighlights([goal], 100, 60);
  assert.equal(plan[0].clipStart, 15); assert.equal(plan[0].clipEnd, 30);
  for (const changes of [{ needs_review: true }, { recommend_include: false }, { duplicate_of: 'other' }]) {
    const uncertain = event('goal', review('goal', changes));
    assert.equal(planHighlights([uncertain], 100, 60).length, 0);
    assert.equal(planHighlights([{ ...uncertain, reviewOverride: true }], 100, 60).length, 1);
  }
});
