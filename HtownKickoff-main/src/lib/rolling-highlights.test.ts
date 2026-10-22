import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyReviewedChunk, candidateChunks, emptyRollingState } from './rolling-highlights';
import type { HighlightEvent } from './highlight-plan';
const options = { duration: 900, target: 20, before: 0, after: 0 };
function event(id: string, start: number, score: number, review = true): HighlightEvent {
  return { id, label: id, start, end: start + 20, confidence: 0, importance: score, context: score, audio: score, reaction: score, preference: score,
    ...(review ? { jev: { candidate_id: id, event: id, importance_estimate: score, excitement_estimate: score, watchability_estimate: score, match_context: null, duplicate_of: null, suggested_start: start, suggested_end: start + 20, recommend_include: true, reason: 'Visible verified play.', needs_review: false } } : {}) };
}
const chunk = (id: string, events: HighlightEvent[]) => ({ id, start: events[0].start, end: events.at(-1)!.end, events });

test('a later chunk replaces the weaker proposal and quantifies the improvement', () => {
  const first = applyReviewedChunk(emptyRollingState(), chunk('one', [event('early', 0, 0.3)]), options);
  const next = applyReviewedChunk(first, chunk('two', [event('later', 400, 0.9)]), options);
  assert.deepEqual(next.selected.map(c => c.id), ['later']);
  assert.deepEqual(next.history[1].removed, ['early']); assert.deepEqual(next.history[1].added, ['later']);
  assert.ok(Math.abs(next.history[1].delta - 0.6) < 1e-9);
  assert.equal(next.decisions.find(d => d.id === 'early')?.selected, false);
});

test('weak later chunks cannot displace stronger evidence and retries do not duplicate candidates', () => {
  const first = applyReviewedChunk(emptyRollingState(), chunk('one', [event('best', 0, 0.9)]), options);
  const weak = chunk('two', [event('weak', 400, 0.2)]);
  const next = applyReviewedChunk(applyReviewedChunk(first, weak, options), weak, options);
  assert.deepEqual(next.selected.map(c => c.id), ['best']);
  assert.equal(next.history.at(-1)?.considered, 2); assert.equal(next.history.at(-1)?.delta, 0);
});

test('out-of-order chunk completion produces the same best reel', () => {
  const inputs = [chunk('one', [event('a', 0, 0.4)]), chunk('two', [event('b', 300, 0.9)]), chunk('three', [event('c', 600, 0.7)])];
  const forward = inputs.reduce((state, item) => applyReviewedChunk(state, item, options), emptyRollingState());
  const backward = [...inputs].reverse().reduce((state, item) => applyReviewedChunk(state, item, options), emptyRollingState());
  assert.deepEqual(forward.selected.map(c => c.id), backward.selected.map(c => c.id));
  assert.deepEqual(forward.selected.map(c => c.id), ['b']);
});

test('uncertain evidence is retained with a reason and never automatically selected', () => {
  const unsure = event('uncertain', 0, 0.99); unsure.jev!.needs_review = true;
  const next = applyReviewedChunk(emptyRollingState(), chunk('one', [unsure]), options);
  assert.equal(next.selected.length, 0); assert.match(next.decisions[0].reason, /producer review/);
  assert.throws(() => applyReviewedChunk(emptyRollingState(), chunk('raw', [event('unverified', 0, 1, false)]), options));
});

test('whole clips stay within budget and chronological windows retain absolute timestamps', () => {
  const events = [event('a', 0, 0.9), event('b', 300, 0.8), event('c', 600, 0.7)];
  const chunks = candidateChunks(events, 900);
  assert.deepEqual(chunks.map(c => c.start), [0, 300, 600]);
  let state = emptyRollingState();
  for (const input of chunks) state = applyReviewedChunk(state, input, { ...options, target: 40 });
  assert.equal(state.selected.length, 2); assert.ok(state.history.at(-1)!.seconds <= 40);
  assert.deepEqual(state.selected.map(c => c.id), ['a', 'b']);
  assert.equal(candidateChunks([event('late', 14370, 0.8)], 14400)[0].start, 9600);
  assert.throws(() => candidateChunks(events, 14401));
});
