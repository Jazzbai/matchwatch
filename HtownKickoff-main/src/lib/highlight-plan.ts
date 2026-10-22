import { jevUtility, type JevReview } from './jev';
import { fusedScore, type FusedAssessment } from './event-fusion';
export type HighlightEvent = {
  id: string; label: string; start: number; end: number;
  confidence: number; importance: number; context: number;
  audio: number; reaction: number; preference: number;
  jev?: JevReview;
  reviewOverride?: boolean;
  viral?: FusedAssessment;
};
export type HighlightClip = HighlightEvent & { score: number; clipStart: number; clipEnd: number };
export function eventScore(event: HighlightEvent) {
  if (event.viral && event.jev && !event.reviewOverride) return fusedScore(event.viral).score ?? 0;
  if (event.jev && !event.reviewOverride) return jevUtility(event.jev);
  return 0.4 * event.importance + 0.2 * event.context + 0.15 * event.audio + 0.15 * event.reaction + 0.1 * event.preference;
}
export function planHighlights(events: HighlightEvent[], duration: number, target: number, before = 5, after = 10): HighlightClip[] {
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(target) || target <= 0) return [];
  const ranked = events.filter(e => Number.isFinite(e.start) && Number.isFinite(e.end) && e.start >= 0 && e.end > e.start && e.end <= duration && (!e.jev || e.reviewOverride || (e.jev.recommend_include && !e.jev.needs_review && !e.jev.duplicate_of)))
    .map(e => ({ ...e, score: eventScore(e), clipStart: e.jev && !e.reviewOverride ? e.jev.suggested_start : Math.max(0, e.start - before), clipEnd: e.jev && !e.reviewOverride ? e.jev.suggested_end : Math.min(duration, e.end + after) }))
    .filter(e => Number.isFinite(e.clipStart) && Number.isFinite(e.clipEnd) && e.clipStart >= 0 && e.clipEnd > e.clipStart && e.clipEnd <= duration)
    .sort((a, b) => b.score - a.score || b.confidence - a.confidence || a.start - b.start);
  const selected: HighlightClip[] = [];
  let remaining = Math.min(target, duration);
  const labels = new Set<string>();
  // First pass includes the best of each event type; the second fills remaining time.
  for (const diversity of [true, false]) {
    for (const event of ranked) {
      if (remaining < 1 || selected.some(e => e.id === event.id) || (diversity && labels.has(event.label))) continue;
      if (selected.some(e => event.clipStart < e.clipEnd && event.clipEnd > e.clipStart)) continue;
      const length = Math.min(event.clipEnd - event.clipStart, remaining);
      // Preserve the complete reviewed cut, including its buildup and reaction.
      if (event.jev && !event.reviewOverride && length < event.clipEnd - event.clipStart) continue;
      if ((!event.jev || event.reviewOverride) && length < event.end - event.start) continue;
      const clipStart = event.jev && !event.reviewOverride ? event.clipStart : Math.max(event.clipStart, Math.min(event.start, event.end - length));
      selected.push({ ...event, clipStart, clipEnd: Math.min(duration, clipStart + length) });
      labels.add(event.label); remaining -= length;
    }
  }
  return selected.sort((a, b) => a.clipStart - b.clipStart);
}
