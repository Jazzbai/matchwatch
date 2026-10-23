import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultWeights } from './catalog';
import { parseJobInput } from './input';
import { PipelineError } from './store';

const valid = {
  match: { title: 'Spurs v United', homeTeam: 'Spurs', events: [{ id: 'e1', period: 2, minute: 90, stoppage: 4, type: 'goal', player: 'Solanke' }], anchors: [{ period: 2, videoSeconds: 3000 }], social: { enabled: true }, assetId: 'injected' },
  preferences: { sport: 'Soccer', targetSeconds: 60, maxMoments: 5, minGapSeconds: 5, weights: defaultWeights, queries: [{ type: 'goal', text: 'Goal scored' }], starPlayers: ['Son'] },
  source: { kind: 'library', ticket: 'abc', indexedAssetId: 'injected' },
};

test('accepts a valid request and copies only known fields', () => {
  const input = parseJobInput(valid);
  assert.equal(input.match.title, 'Spurs v United');
  assert.equal(input.match.events[0].stoppage, 4);
  assert.equal(input.match.reactionDelaySeconds, 20);
  assert.equal(input.match.rightsDeclared, false);
  assert.ok(input.match.matchId);
  assert.deepEqual(input.source, { kind: 'library', ticket: 'abc' });
  assert.equal('assetId' in input.match, false);
});

test('rejects invalid preferences, timestamps and sources with a PipelineError', () => {
  for (const broken of [
    { ...valid, preferences: { ...valid.preferences, targetSeconds: 5000 } },
    { ...valid, preferences: { ...valid.preferences, queries: [] } },
    { ...valid, preferences: { ...valid.preferences, weights: { ...defaultWeights, quality: 0.5 } } },
    { ...valid, match: { ...valid.match, videoStartUtc: '2026-10-25 16:00' } },
    { ...valid, source: { kind: 'ftp' } },
    null,
  ]) assert.throws(() => parseJobInput(broken), PipelineError);
});
