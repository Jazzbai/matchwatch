import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectMoments } from './selection';
import { preferences, ranked, review } from './test-fixtures';

const permitted = { status: 'permitted' as const, reason: 'Licensed.' };

test('prefers event-type variety, then fills the remaining budget', () => {
  const events = [
    ranked('goal-1', 1, 100, 115, { sports: 1 }),
    ranked('goal-2', 2, 300, 315, { sports: 0.95 }),
    ranked('save-1', 3, 500, 515, { sports: 0.6 }, { type: 'save' }),
  ];
  const result = selectMoments(events, preferences({ targetSeconds: 45 }), permitted);
  assert.deepEqual(result.selected.map(event => event.eventId), ['goal-1', 'goal-2', 'save-1']);
  const tight = selectMoments(events, preferences({ targetSeconds: 30 }), permitted);
  assert.deepEqual(tight.selected.map(event => event.eventId), ['goal-1', 'save-1']);
  assert.match(tight.skipped.find(item => item.eventId === 'goal-2')!.reason, /budget/);
});

test('enforces the minimum gap between clips and the top-N limit', () => {
  const events = [
    ranked('a', 1, 100, 110, { sports: 1 }),
    ranked('b', 2, 112, 120, { sports: 0.9 }, { type: 'save' }),
    ranked('c', 3, 200, 210, { sports: 0.8 }, { type: 'shot' }),
    ranked('d', 4, 300, 310, { sports: 0.7 }, { type: 'foul' }),
  ];
  const result = selectMoments(events, preferences({ maxMoments: 2, minGapSeconds: 5 }), permitted);
  assert.deepEqual(result.selected.map(event => event.eventId), ['a', 'c']);
  assert.match(result.skipped.find(item => item.eventId === 'b')!.reason, /Less than 5 s/);
  assert.match(result.skipped.find(item => item.eventId === 'd')!.reason, /top 2/);
});

test('never selects duplicates, unverified moments, unscored moments or profanity', () => {
  const duplicate = { ...ranked('dup', 2, 400, 410, { sports: 0.9 }), duplicateOf: 'a' };
  const events = [
    ranked('a', 1, 100, 110, { sports: 1 }),
    duplicate,
    ranked('unverified', 3, 200, 210, { sports: 0.8 }, { review: review({ needsReview: true }) }),
    ranked('unscored', 4, 300, 310, {}),
    ranked('sweary', 5, 500, 510, { sports: 0.7 }, { transcription: 'what a shit decision' }),
  ];
  const result = selectMoments(events, preferences(), permitted);
  assert.deepEqual(result.selected.map(event => event.eventId), ['a']);
  const reasons = Object.fromEntries(result.skipped.map(item => [item.eventId, item.reason]));
  assert.match(reasons.dup, /Duplicate of #1/);
  assert.match(reasons.unverified, /Not verified/);
  assert.match(reasons.unscored, /No scoring evidence/);
  assert.match(reasons.sweary, /profanity/);
});

test('returns clips in playback order and carries the rights decision', () => {
  const events = [ranked('late', 1, 900, 910, { sports: 1 }), ranked('early', 2, 100, 110, { sports: 0.9 }, { type: 'save' })];
  const held = { status: 'pending_verification' as const, reason: 'No rights on record.' };
  const result = selectMoments(events, preferences(), held);
  assert.deepEqual(result.selected.map(event => event.eventId), ['early', 'late']);
  assert.equal(result.totalSeconds, 20);
  assert.equal(result.rights, held);
});
