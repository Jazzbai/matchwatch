// Synthetic fixtures for unit tests only. They are not real match or provider data.
import { defaultWeights } from './catalog';
import type { AnalyzedEvent, Factors, HighlightPreferences, RankedEvent, UnifiedEvent, VideoReview } from './types';
import { scoreEvent } from './viral-score';

export function review(overrides: Partial<VideoReview> = {}): VideoReview {
  return {
    eventType: 'goal', description: 'A goal is scored.', team: null, players: [],
    importance: 0.9, excitement: 0.8,
    emotionalIntensity: { score: 0.8, evidence: 'Players celebrate at 12s.' },
    controversySurprise: { score: 0.2, evidence: 'No dispute visible.' },
    watchability: 0.9, isReplay: false, duplicateOf: null,
    suggestedStart: 0, suggestedEnd: 10, boundariesVerified: true, needsReview: false, reason: 'Decisive goal.',
    ...overrides,
  };
}

export function unified(id: string, start: number, end: number, overrides: Partial<UnifiedEvent> = {}): UnifiedEvent {
  return {
    eventId: id, type: 'goal', label: 'Goal', matchId: 'match-1',
    video: { start, end }, clip: { start, end, fromModel: true }, matchTime: null,
    team: null, players: [], officialEventId: null, social: null,
    review: review({ suggestedStart: start, suggestedEnd: end }),
    ...overrides,
  };
}

/** A ranked event with explicit factors, for selection and output tests. */
export function ranked(id: string, rank: number, start: number, end: number, factors: Partial<Factors>, overrides: Partial<AnalyzedEvent> = {}): RankedEvent {
  const full: Factors = { sports: null, social: null, emotion: null, controversy: null, audience: null, quality: null, ...factors };
  const scored = scoreEvent({ ...unified(id, start, end), evidence: [], ...overrides, factors: full }, defaultWeights);
  return { ...scored, rank, duplicateOf: null };
}

export function preferences(overrides: Partial<HighlightPreferences> = {}): HighlightPreferences {
  return {
    sport: 'Soccer', targetSeconds: 60, maxMoments: 5, minGapSeconds: 5, weights: { ...defaultWeights },
    queries: [{ type: 'goal', text: 'Goal scored' }], starPlayers: [], ...overrides,
  };
}
