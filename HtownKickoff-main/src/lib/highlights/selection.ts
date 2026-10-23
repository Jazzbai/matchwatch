import { eventLabel } from './catalog';
import { gapBetween } from './intervals';
import { containsProfanity } from './viral-analysis';
import type { HighlightPreferences, RankedEvent, RightsStatus, Selection } from './types';

// Diagram step 9: pick the highest-scoring, diverse moments automatically.
// Rules: event-type variety first, a minimum gap between clips, a total-length
// budget and a top-N limit. Every unselected moment records why it was skipped.

export function selectMoments(ranked: RankedEvent[], preferences: HighlightPreferences, rights: { status: RightsStatus; reason: string }): Selection {
  const byId = new Map(ranked.map(event => [event.eventId, event]));
  const skipReasons = new Map<string, string>();
  const eligible: RankedEvent[] = [];
  for (const event of ranked) {
    const reason = ineligibility(event, byId);
    if (reason) skipReasons.set(event.eventId, reason);
    else eligible.push(event);
  }

  const selected: RankedEvent[] = [];
  let total = 0;
  // Pass 1 takes the best moment of each event type; pass 2 fills the remaining budget.
  for (const requireNewType of [true, false]) {
    for (const event of eligible) {
      if (selected.includes(event)) continue;
      const length = event.clip.end - event.clip.start;
      const tooClose = selected.find(other => gapBetween(other.clip, event.clip) < preferences.minGapSeconds);
      let reason: string | null = null;
      if (tooClose) reason = `Less than ${preferences.minGapSeconds} s from selected moment #${tooClose.rank} (${eventLabel(tooClose.type)}).`;
      else if (selected.length >= preferences.maxMoments) reason = `The top ${preferences.maxMoments} moments are already selected.`;
      else if (total + length > preferences.targetSeconds + 1e-6) reason = `Does not fit the remaining ${Math.max(0, Math.round(preferences.targetSeconds - total))} s of the ${preferences.targetSeconds} s budget.`;
      else if (requireNewType && selected.some(other => other.type === event.type)) reason = 'Another moment of this type was selected first, for variety.';
      if (reason) { skipReasons.set(event.eventId, reason); continue; }
      selected.push(event);
      skipReasons.delete(event.eventId);
      total += length;
    }
  }

  return {
    rights,
    selected: selected.sort((a, b) => a.clip.start - b.clip.start),
    skipped: ranked.filter(event => !selected.includes(event)).map(event => ({ eventId: event.eventId, reason: skipReasons.get(event.eventId) ?? 'Not selected.' })),
    totalSeconds: total,
  };
}

function ineligibility(event: RankedEvent, byId: Map<string, RankedEvent>): string | null {
  if (event.duplicateOf) return `Duplicate of #${byId.get(event.duplicateOf)?.rank ?? '?'} (the same action).`;
  if (!event.review) return 'Not verified: the video review could not analyze this moment.';
  if (event.review.needsReview) return 'Not verified: the video review could not confirm this moment.';
  if (!event.viralScore) return 'No scoring evidence is available.';
  if (containsProfanity(event.transcription)) return 'Compliance: profanity in the commentary.';
  return null;
}
