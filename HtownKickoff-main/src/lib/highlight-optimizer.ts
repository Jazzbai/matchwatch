import { planHighlights, type HighlightEvent, type HighlightClip } from './highlight-plan';

/** Whole-clip budgeted interval selection. Half-second costs round upward. */
export function optimizeHighlights(events: HighlightEvent[], duration: number, target: number, before = 5, after = 10): HighlightClip[] {
  if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(duration) || duration <= 0) return [];
  const budget = Math.floor(Math.min(target, duration, 300) * 2);
  const clips = events.flatMap(event => planHighlights([event], duration, target, before, after))
    .filter(clip => clip.score > 0)
    .sort((a, b) => b.score - a.score || a.start - b.start || a.id.localeCompare(b.id))
    .slice(0, 80).sort((a, b) => a.clipEnd - b.clipEnd || a.clipStart - b.clipStart || a.id.localeCompare(b.id));
  const n = clips.length, maxClips = Math.min(5, n), width = budget + 1, layer = (maxClips + 1) * width;
  const values = new Float64Array((n + 1) * layer);
  const costs = clips.map(c => Math.ceil((c.clipEnd - c.clipStart) * 2 - 1e-8));
  const previous = clips.map((clip, index) => {
    let compatible = index - 1;
    while (compatible >= 0 && clips[compatible].clipEnd > clip.clipStart) compatible--;
    return compatible + 1;
  });
  for (let i = 1; i <= n; i++) for (let count = 1; count <= maxClips; count++) for (let seconds = 0; seconds <= budget; seconds++) {
    const skip = values[(i - 1) * layer + count * width + seconds];
    const take = seconds >= costs[i - 1] ? clips[i - 1].score + values[previous[i - 1] * layer + (count - 1) * width + seconds - costs[i - 1]] : -Infinity;
    values[i * layer + count * width + seconds] = Math.max(skip, take);
  }
  const selected: HighlightClip[] = [];
  let i = n, count = maxClips, seconds = budget;
  while (i > 0 && count > 0) {
    const current = values[i * layer + count * width + seconds];
    const skip = values[(i - 1) * layer + count * width + seconds];
    if (current > skip + 1e-9) {
      selected.push(clips[i - 1]); seconds -= costs[i - 1]; count--; i = previous[i - 1];
    } else i--;
  }
  return selected.sort((a, b) => a.clipStart - b.clipStart);
}

/** Spread a bounded AI review across the recording, merging overlapping detections. */
export function reviewShortlist(events: HighlightEvent[], duration: number, limit = 20) {
  const ordered = events.filter(e => Number.isFinite(e.start) && Number.isFinite(e.end) && e.start >= 0 && e.end > e.start && e.end <= duration)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const distinct: HighlightEvent[] = [];
  for (const event of ordered) {
    const same = distinct.find(e => Math.max(0, Math.min(e.end, event.end) - Math.max(e.start, event.start)) >= 0.6 * Math.min(e.end - e.start, event.end - event.start));
    if (!same) distinct.push(event);
  }
  if (distinct.length <= limit) return distinct;
  return Array.from({ length: limit }, (_, index) => distinct[Math.floor(index * (distinct.length - 1) / (limit - 1))]);
}
