import { defaultSignalWeights, fuseEvents, fusedScore, type FusionInputs } from './event-fusion';
import { type HighlightEvent } from './highlight-plan';
import { optimizeHighlights } from './highlight-optimizer';

/** Fixed maximum-cardinality five-moment selection, sorted by score and deterministic ties. */
export function rankViralMoments(events: HighlightEvent[], input: FusionInputs, duration: number, budget = 60) {
  const fused = fuseEvents(events, input, defaultSignalWeights);
  const distinct = [...new Map(fused.map(event => [event.id, event])).values()];
  const chosen = optimizeHighlights(distinct.filter(event => event.jev && !event.reviewOverride), duration, Math.min(budget, 60), 0, 0)
    .sort((a, b) => b.score - a.score || a.clipStart - b.clipStart || a.id.localeCompare(b.id));
  const seconds = chosen.reduce((sum, event) => sum + event.clipEnd - event.clipStart, 0);
  return { moments: chosen.map(event => {
    const result = fusedScore(event.viral!);
    return { event_id: event.id, event: event.label, timestamp: { start: event.clipStart, end: event.clipEnd }, scores: event.viral!.values, viral_score: result.score,
      effective_weights: result.effectiveWeights, contributions: result.contributions,
      confidence: { evidence_coverage: result.coverage, calibrated_probability: null },
      explanation: `${event.jev!.reason} ${event.viral!.reasons.join(' ')}`,
      evidence: { statistics_ids: event.viral!.statsIds, post_ids: event.viral!.postIds } };
  }), weights: defaultSignalWeights, estimated: true, total_seconds: seconds };
}
