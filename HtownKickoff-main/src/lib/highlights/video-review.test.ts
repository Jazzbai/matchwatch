import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CandidateMoment } from './types';
import { parseReviews, reviewSchema, reviewWindows } from './video-review';

const candidate = (id: string, start: number, end: number): CandidateMoment => ({ id, type: 'goal', query: 'Goal scored', start, end, searchRank: 1 });
const window = { start: 90, end: 140 };

test('groups nearby candidates into short analysis windows', () => {
  const windows = reviewWindows([candidate('a', 100, 108), candidate('b', 120, 125), candidate('c', 900, 910)], 1000);
  assert.deepEqual(windows, [{ ids: ['a', 'b'], start: 90, end: 140 }, { ids: ['c'], start: 890, end: 925 }]);
});

test('constrains candidate IDs in the schema without unsupported array limits', () => {
  const schema = JSON.stringify(reviewSchema(['a', 'b']));
  assert.match(schema, /"enum":\["a","b"\]/);
  assert.doesNotMatch(schema, /minItems|maxItems/);
});

test('keeps valid fields, nulls invalid scores and falls back on unsafe boundaries', () => {
  const reviews = parseReviews({ reviews: [
    { candidate_id: 'a', event_type: 'goal', importance: 0.9, excitement: 8, emotional_intensity: { score: 0.7, evidence: 'Celebration' }, controversy_surprise: { score: null, evidence: '' }, watchability: 1, players: ['Solanke'], team: 'Spurs', is_replay: false, duplicate_of: null, suggested_start: 95, suggested_end: 115, needs_review: false, reason: 'Late equaliser' },
    { candidate_id: 'b', event_type: 'touchdown', importance: 0.5, suggested_start: 10, suggested_end: 500, duplicate_of: 'a', needs_review: false, reason: '' },
    { candidate_id: 'unknown', importance: 1 },
  ] }, [candidate('a', 100, 108), candidate('b', 120, 125)], window);
  const a = reviews.get('a')!, b = reviews.get('b')!;
  assert.equal(a.importance, 0.9);
  assert.equal(a.excitement, null, 'out-of-range score becomes unknown');
  assert.deepEqual([a.suggestedStart, a.suggestedEnd, a.boundariesVerified], [95, 115, true]);
  assert.equal(b.eventType, 'goal', 'unknown event type falls back to the searched type');
  assert.deepEqual([b.suggestedStart, b.suggestedEnd, b.boundariesVerified], [120, 125, false]);
  assert.equal(b.duplicateOf, 'a');
  assert.equal(reviews.has('unknown'), false);
});

test('missing needs_review is treated as unverified and duplicate chains are broken', () => {
  const reviews = parseReviews({ reviews: [
    { candidate_id: 'a', duplicate_of: 'b', suggested_start: 100, suggested_end: 108, reason: 'x' },
    { candidate_id: 'b', duplicate_of: 'a', suggested_start: 100, suggested_end: 108, reason: 'y' },
  ] }, [candidate('a', 100, 108), candidate('b', 101, 108)], window);
  assert.equal(reviews.get('a')!.needsReview, true);
  assert.equal(reviews.get('a')!.duplicateOf, null);
});
