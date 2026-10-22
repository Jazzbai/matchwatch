import { test } from 'node:test';
import assert from 'node:assert/strict';
import { optimizeHighlights, reviewShortlist } from './highlight-optimizer';
import type { HighlightEvent } from './highlight-plan';
const event = (id: string, start: number, end: number, score: number): HighlightEvent => ({ id, label: id, start, end, confidence: 0, importance: score, context: score, audio: score, reaction: score, preference: score });

test('a stronger later moment replaces the weaker first choice regardless of arrival order', () => {
  const first = event('first', 0, 20, 0.4), better = event('better', 30, 50, 0.9);
  assert.deepEqual(optimizeHighlights([first], 60, 20, 0, 0).map(c => c.id), ['first']);
  for (const input of [[first, better], [better, first]]) assert.deepEqual(optimizeHighlights(input, 60, 20, 0, 0).map(c => c.id), ['better']);
});
test('the best combination can replace a higher-scoring single overlapping clip', () => {
  const input = [event('long', 0, 60, 0.95), event('first-play', 0, 25, 0.8), event('second-play', 30, 55, 0.8)];
  assert.deepEqual(optimizeHighlights(input, 90, 60, 0, 0).map(c => c.id), ['first-play', 'second-play']);
});
test('fractional timing stays inside the budget and selected clips never overlap', () => {
  const input = [event('a', 0, 10.2, 0.9), event('b', 8, 18, 0.8), event('c', 20, 30.2, 0.9)];
  const selected = optimizeHighlights(input, 60, 20.4, 0, 0);
  assert.ok(selected.reduce((sum, c) => sum + c.clipEnd - c.clipStart, 0) <= 20.4);
  assert.equal(selected.length, 1, 'rounded-up costs must not overshoot a fractional budget');
  assert.deepEqual(optimizeHighlights([event('x', 0, 10, 1), event('y', 5, 15, 0.9)], 30, 30, 0, 0).map(c => c.id), ['x']);
});
test('AI shortlist removes repeated detections and covers the recording rather than only its start', () => {
  const input = Array.from({ length: 40 }, (_, i) => event(`play-${i}`, i * 20, i * 20 + 5, 0.8));
  input.push(event('repeat', 0.5, 5, 0.9));
  const shortlist = reviewShortlist(input, 900);
  assert.equal(shortlist.length, 20);
  assert.equal(shortlist[0].id, 'play-0');
  assert.equal(shortlist.at(-1)?.id, 'play-39');
  assert.ok(!shortlist.some(e => e.id === 'repeat'));
});
