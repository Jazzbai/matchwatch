import { optimizeHighlights } from './highlight-optimizer';
import { eventScore, type HighlightClip, type HighlightEvent } from './highlight-plan';

export type ReviewChunk = { id: string; start: number; end: number; events: HighlightEvent[] };
export type RollingStep = { chunkId: string; start: number; end: number; considered: number; selected: number; seconds: number; utility: number; delta: number; added: string[]; removed: string[] };
export type RollingState = { chunks: ReviewChunk[]; selected: HighlightClip[]; history: RollingStep[]; decisions: { id: string; label: string; score: number; reason: string; selected: boolean }[] };
export type RollingOptions = { duration: number; target: number; before: number; after: number };
export function emptyRollingState(): RollingState { return { chunks: [], selected: [], history: [], decisions: [] }; }

/** Bounded prototype: five-minute windows, enlarged to keep at most three model calls. */
export function candidateChunks(events: HighlightEvent[], duration: number): ReviewChunk[] {
  if (!Number.isFinite(duration) || duration <= 0 || duration > 14400) throw new Error('Choose a recording up to four hours long.');
  const width = Math.max(300, Math.ceil(duration / 3));
  const groups = new Map<number, HighlightEvent[]>();
  for (const event of events) {
    if (!Number.isFinite(event.start) || !Number.isFinite(event.end) || event.start < 0 || event.end <= event.start || event.end > duration) throw new Error('Chunk candidates must use valid absolute video timestamps.');
    const position = Math.floor(event.start / width);
    groups.set(position, [...(groups.get(position) || []), event]);
  }
  return [...groups.entries()].sort(([a], [b]) => a - b).map(([position, candidates]) => ({
    id: `window-${position}`, start: position * width, end: Math.min(duration, (position + 1) * width), events: candidates.sort((a, b) => a.start - b.start),
  }));
}

/** Every new chunk competes with the complete retained candidate pool, not only its predecessor. */
export function applyReviewedChunk(state: RollingState, chunk: ReviewChunk, options: RollingOptions): RollingState {
  if (!chunk.id || chunk.events.some(e => !e.jev && !e.reviewOverride)) throw new Error('Only reviewed moments can enter automatic chunk selection.');
  const chunks = [...state.chunks.filter(c => c.id !== chunk.id), chunk].sort((a, b) => a.start - b.start);
  const byId = new Map<string, HighlightEvent>();
  for (const c of chunks) for (const event of c.events) byId.set(event.id, event);
  if (byId.size > 80) throw new Error('The prototype supports up to 80 retained candidates per recording.');
  const events = [...byId.values()];
  const selected = optimizeHighlights(events, options.duration, options.target, options.before, options.after);
  const chosen = new Set(selected.map(c => c.id)), previous = new Set(state.selected.map(c => c.id));
  const utility = selected.reduce((sum, c) => sum + c.score, 0), prior = state.selected.reduce((sum, c) => sum + c.score, 0);
  const step = { chunkId: chunk.id, start: chunk.start, end: chunk.end, considered: events.length, selected: selected.length,
    seconds: selected.reduce((sum, c) => sum + c.clipEnd - c.clipStart, 0), utility, delta: utility - prior,
    added: [...chosen].filter(id => !previous.has(id)), removed: [...previous].filter(id => !chosen.has(id)) };
  const decisions = events.map(event => {
    let reason = 'A stronger combination fits the time budget.';
    if (chosen.has(event.id)) reason = 'Selected in the strongest complete-clip combination.';
    else if (!event.reviewOverride && event.jev?.needs_review) reason = 'Evidence needs producer review; excluded automatically.';
    else if (!event.reviewOverride && event.jev?.duplicate_of) reason = `Duplicate of ${event.jev.duplicate_of}.`;
    else if (!event.reviewOverride && !event.jev?.recommend_include) reason = event.jev?.reason || 'AI did not recommend inclusion.';
    else {
      const start = event.jev && !event.reviewOverride ? event.jev.suggested_start : Math.max(0, event.start - options.before);
      const end = event.jev && !event.reviewOverride ? event.jev.suggested_end : Math.min(options.duration, event.end + options.after);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > options.duration) reason = 'Clip boundaries are invalid.';
      else if (end - start > options.target) reason = 'The complete moment exceeds the reel budget.';
      else if (selected.some(c => start < c.clipEnd && end > c.clipStart)) reason = 'Overlaps a selected moment; stronger combination retained.';
    }
    return { id: event.id, label: event.label, score: eventScore(event), reason, selected: chosen.has(event.id) };
  });
  return { chunks, selected, history: [...state.history, step].slice(-100), decisions };
}
