import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fuseEvents } from './event-fusion';
import { parsePreferences } from './input';
import { preferences, review } from './test-fixtures';
import type { MatchInput } from './types';

test('padding has compatible defaults, rejects unsafe values, and preserves custom search text', () => {
  const value = preferences({ queries: [{ type: 'goal', text: 'A last-minute goal' }] });
  const parsed = parsePreferences(value);
  assert.equal(parsed.beforeSeconds, 5);
  assert.equal(parsed.afterSeconds, 10);
  assert.equal(parsed.queries[0].text, 'A last-minute goal');
  for (const invalid of [-1, 31, NaN, '5']) assert.throws(() => parsePreferences({ ...value, beforeSeconds: invalid }));
});

test('fusion applies custom padding, clamps to the video, and retains verified AI boundaries', () => {
  const match: MatchInput = { matchId: 'test', title: 'Synthetic match', reactionDelaySeconds: 20, events: [], anchors: [], social: { enabled: false }, rightsDeclared: false };
  const candidate = { id: 'clip-1', type: 'goal' as const, query: 'Goal', start: 3, end: 8, searchRank: 1 };
  const prefs = preferences({ beforeSeconds: 8, afterSeconds: 30 });
  const social = { status: 'not_requested' as const, reason: 'Test', posts: [] as [] };
  assert.deepEqual(fuseEvents([candidate], match, prefs, social, 20)[0].clip, { start: 0, end: 20, fromModel: false });
  const verified = { ...candidate, review: review({ suggestedStart: 2, suggestedEnd: 9 }) };
  assert.deepEqual(fuseEvents([verified], match, prefs, social, 20)[0].clip, { start: 2, end: 9, fromModel: true });
});
