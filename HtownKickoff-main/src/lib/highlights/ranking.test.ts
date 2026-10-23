import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rankEvents } from './ranking';
import { ranked, review } from './test-fixtures';

const strip = (event: ReturnType<typeof ranked>) => ({ ...event, rank: 0, duplicateOf: null });

test('sorts by viral score, with unscored moments last', () => {
  const result = rankEvents([
    strip(ranked('low', 0, 300, 310, { sports: 0.3 })),
    strip(ranked('none', 0, 400, 410, {})),
    strip(ranked('high', 0, 100, 110, { sports: 0.9 })),
  ]);
  assert.deepEqual(result.map(event => [event.eventId, event.rank]), [['high', 1], ['low', 2], ['none', 3]]);
});

test('marks overlapping windows, named duplicates and replays as duplicates of the canonical moment', () => {
  const result = rankEvents([
    strip(ranked('live', 0, 100, 112, { sports: 0.9 })),
    strip(ranked('overlap', 0, 102, 111, { sports: 0.5 }, { type: 'celebration' })),
    strip(ranked('named', 0, 500, 510, { sports: 0.4 }, { review: review({ duplicateOf: 'live' }) })),
    strip(ranked('replay', 0, 150, 160, { sports: 0.6 }, { review: review({ isReplay: true }) })),
    strip(ranked('later-goal', 0, 400, 410, { sports: 0.7 })),
  ]);
  const duplicates = Object.fromEntries(result.map(event => [event.eventId, event.duplicateOf]));
  assert.deepEqual(duplicates, { live: null, 'later-goal': null, replay: 'live', overlap: 'live', named: 'live' });
});
