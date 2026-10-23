import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultWeights } from './catalog';
import { unified } from './test-fixtures';
import type { Factors } from './types';
import { scoreEvent, validateWeights } from './viral-score';

const event = (factors: Factors) => ({ ...unified('e1', 0, 10), factors, evidence: [] });

test('matches the workflow document example when all five original signals are present', () => {
  // The document's example: 0.95, 0.90, 0.85, 0.95, 0.80 → ViralScore 90.75 (quality not used).
  const scored = scoreEvent(event({ sports: 0.95, social: 0.9, emotion: 0.85, controversy: 0.95, audience: 0.8, quality: null }), { ...defaultWeights, quality: 0 });
  assert.equal(Math.round(scored.viralScore! * 10000) / 100, 90.75);
  assert.equal(scored.confidence, 1);
});

test('renormalizes over the available signals when one is missing', () => {
  const scored = scoreEvent(event({ sports: 1, social: null, emotion: 0.5, controversy: null, audience: null, quality: null }), defaultWeights);
  // (0.30·1 + 0.20·0.5) / (0.30 + 0.20) = 0.8
  assert.ok(Math.abs(scored.viralScore! - 0.8) < 1e-9);
  assert.ok(Math.abs(scored.effectiveWeights.sports - 0.6) < 1e-9);
  assert.equal(scored.effectiveWeights.social, 0);
  assert.deepEqual(scored.missingSignals, ['social', 'controversy', 'audience', 'quality']);
  assert.ok(Math.abs(scored.confidence - 0.5 / 1.05) < 1e-9);
});

test('a measured zero is kept, while no evidence at all gives no score', () => {
  const zero = scoreEvent(event({ sports: 0, social: 0, emotion: null, controversy: null, audience: null, quality: null }), defaultWeights);
  assert.equal(zero.viralScore, 0);
  const empty = scoreEvent(event({ sports: null, social: null, emotion: null, controversy: null, audience: null, quality: null }), defaultWeights);
  assert.equal(empty.viralScore, null);
  assert.equal(empty.confidence, 0);
});

test('weights are validated, with quality & diversity capped at 0.05', () => {
  assert.deepEqual(validateWeights(defaultWeights), defaultWeights);
  assert.throws(() => validateWeights({ ...defaultWeights, quality: 0.2 }));
  assert.throws(() => validateWeights({ ...defaultWeights, sports: -1 }));
  assert.throws(() => validateWeights({ sports: 0, social: 0, emotion: 0, controversy: 0, audience: 0, quality: 0 }));
});
