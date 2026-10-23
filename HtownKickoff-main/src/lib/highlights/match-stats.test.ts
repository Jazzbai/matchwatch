import assert from 'node:assert/strict';
import { test } from 'node:test';
import { alignOfficialEvent, eventVideoTime, matchClock, parseAnchors, parseMatchEvents } from './match-stats';

const anchors = parseAnchors([{ period: 1, videoSeconds: 120 }, { period: 2, videoSeconds: 3600 }]);

test('maps match time to video time through kickoff anchors, including stoppage time', () => {
  assert.equal(eventVideoTime({ id: 'a', period: 1, minute: 12, second: 5, type: 'goal' }, anchors, 'Soccer'), 120 + 12 * 60 + 5);
  assert.equal(eventVideoTime({ id: 'b', period: 2, minute: 65, type: 'red_card' }, anchors, 'Soccer'), 3600 + 20 * 60);
  assert.equal(eventVideoTime({ id: 'c', period: 2, minute: 90, stoppage: 4, type: 'goal' }, anchors, 'Soccer'), 3600 + 49 * 60);
  assert.equal(eventVideoTime({ id: 'd', period: 3, minute: 95, type: 'goal' }, anchors, 'Soccer'), null);
});

test('shows the match clock for a video second', () => {
  assert.equal(matchClock(60, anchors, 'Soccer'), null);
  assert.equal(matchClock(120 + 12 * 60 + 5, anchors, 'Soccer'), '12:05');
  assert.equal(matchClock(3600 + 20 * 60 + 3, anchors, 'Soccer'), '65:03');
});

test('aligns an official event of the same type within the tolerance only', () => {
  const events = parseMatchEvents([
    { id: 'goal', period: 2, minute: 65, type: 'goal', team: 'TOT', player: 'Son' },
    { id: 'card', period: 2, minute: 65, type: 'red_card' },
  ]);
  const at = 3600 + 20 * 60;
  assert.equal(alignOfficialEvent({ type: 'goal', start: at - 5, end: at + 5 }, events, anchors, 'Soccer')?.id, 'goal');
  assert.equal(alignOfficialEvent({ type: 'save', start: at - 5, end: at + 5 }, events, anchors, 'Soccer'), null);
  assert.equal(alignOfficialEvent({ type: 'goal', start: at + 100, end: at + 110 }, events, anchors, 'Soccer'), null);
});

test('rejects malformed events and anchors', () => {
  assert.throws(() => parseMatchEvents([{ id: 'x', period: 1, minute: -1, type: 'goal' }]));
  assert.throws(() => parseMatchEvents([{ id: 'x', period: 1, minute: 5, type: 'touchdown' }]));
  assert.throws(() => parseAnchors([{ period: 1, videoSeconds: 0 }, { period: 1, videoSeconds: 10 }]));
});
