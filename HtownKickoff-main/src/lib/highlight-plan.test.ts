import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planHighlights, type HighlightEvent } from './highlight-plan';
function event(id: string, start: number, end: number, importance = 1, label = 'Goal'): HighlightEvent {
  return { id, start, end, importance, label, confidence: 0.9, context: 0.5, audio: 0, reaction: 0, preference: 0.5 };
}
test('padding stays inside the source, and the final order follows match time', () => {
  const plan = planHighlights([event('late', 90, 98), event('early', 2, 5, 0.5)], 100, 60);
  assert.deepEqual(plan.map(c => c.id), ['early', 'late']);
  assert.equal(plan[0].clipStart, 0); assert.equal(plan[1].clipEnd, 100);
});
test('overlapping detections produce only one clip, preferring the higher score', () => {
  const plan = planHighlights([event('low', 20, 25, 0.2), event('high', 22, 28)], 100, 60);
  assert.deepEqual(plan.map(c => c.id), ['high']);
});
test('target is respected and event boundaries survive trimmed padding', () => {
  const plan = planHighlights([event('goal', 20, 30)], 100, 12);
  assert.equal(plan.length, 1); assert.ok(plan[0].clipStart <= 20); assert.ok(plan[0].clipEnd >= 30);
  assert.equal(plan[0].clipEnd - plan[0].clipStart, 12);
  assert.equal(planHighlights([event('goal', 20, 40)], 100, 10).length, 0);
});
test('diversity includes another event type before filling with repeated types', () => {
  const plan = planHighlights([event('goal1', 10, 15), event('goal2', 40, 45, 0.9), event('crowd', 70, 75, 0.5, 'Celebration')], 100, 40);
  assert.deepEqual(plan.map(c => c.id), ['goal1', 'crowd']);
});
test('invalid ranges and invalid source durations are excluded', () => {
  assert.equal(planHighlights([event('bad', 20, 10), event('past', 90, 120), event('negative', -5, 5)], 100, 60).length, 0);
  assert.equal(planHighlights([event('valid', 10, 20)], NaN, 60).length, 0);
});
