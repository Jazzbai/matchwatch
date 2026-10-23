import { overlapShare } from './intervals';
import type { RankedEvent, ScoredEvent } from './types';

// Diagram step 8: sort every detected event by viral score, then mark duplicates
// (the same action seen twice, overlapping windows, or a replay) so they never
// compete with the canonical moment.

const REPLAY_LOOKBACK_SECONDS = 120;

export function rankEvents(events: ScoredEvent[]): RankedEvent[] {
  const ordered = [...events].sort((a, b) =>
    (b.viralScore ?? -1) - (a.viralScore ?? -1) || b.confidence - a.confidence || a.video.start - b.video.start || a.eventId.localeCompare(b.eventId));
  const canonical: RankedEvent[] = [];
  return ordered.map((event, index) => {
    const ranked: RankedEvent = { ...event, rank: index + 1, duplicateOf: findDuplicate(event, canonical, events) };
    if (!ranked.duplicateOf) canonical.push(ranked);
    return ranked;
  });
}

function findDuplicate(event: ScoredEvent, canonical: RankedEvent[], all: ScoredEvent[]) {
  const named = event.review?.duplicateOf;
  if (named && all.some(other => other.eventId === named)) return named;
  const overlapping = canonical.find(other => overlapShare(other.clip, event.clip) >= 0.5);
  if (overlapping) return overlapping.eventId;
  if (event.review?.isReplay) {
    const original = canonical.find(other => other.type === event.type && other.video.start < event.video.start && event.video.start - other.video.start <= REPLAY_LOOKBACK_SECONDS);
    if (original) return original.eventId;
  }
  return null;
}
