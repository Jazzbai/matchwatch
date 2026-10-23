import { factorKeys, type AnalyzedEvent, type ScoredEvent, type Weights } from './types';

// Diagram step 7: ViralScore = wS·S + wT·T + wE·E + wC·C + wA·A + wQ·Q.
// When a signal is unavailable, the remaining weights are renormalized:
//   ViralScore = Σ(wᵢ·scoreᵢ for available i) / Σ(wᵢ for available i)

export const MAX_QUALITY_WEIGHT = 0.05;

export function validateWeights(weights: Weights): Weights {
  for (const key of factorKeys) {
    const weight = weights?.[key];
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0 || weight > 1) throw new Error('Each weight must be between 0 and 1.');
  }
  if (weights.quality > MAX_QUALITY_WEIGHT) throw new Error(`The quality & diversity weight is limited to ${MAX_QUALITY_WEIGHT}.`);
  if (factorKeys.every(key => weights[key] === 0)) throw new Error('At least one weight must be above zero.');
  return { ...weights };
}

export function scoreEvent(event: AnalyzedEvent, weights: Weights): ScoredEvent {
  const total = factorKeys.reduce((sum, key) => sum + weights[key], 0);
  const available = factorKeys.filter(key => event.factors[key] !== null && weights[key] > 0);
  const availableWeight = available.reduce((sum, key) => sum + weights[key], 0);
  const effectiveWeights = {} as Weights, contributions = {} as Weights;
  for (const key of factorKeys) {
    effectiveWeights[key] = available.includes(key) ? weights[key] / availableWeight : 0;
    contributions[key] = effectiveWeights[key] * (event.factors[key] ?? 0);
  }
  return {
    ...event,
    viralScore: availableWeight ? factorKeys.reduce((sum, key) => sum + contributions[key], 0) : null,
    effectiveWeights,
    contributions,
    confidence: total ? availableWeight / total : 0,
    missingSignals: factorKeys.filter(key => event.factors[key] === null),
  };
}
