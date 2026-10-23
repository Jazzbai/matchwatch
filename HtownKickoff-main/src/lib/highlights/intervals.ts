export type Interval = { start: number; end: number };

/** Overlap as a share of the shorter interval, 0–1. */
export function overlapShare(a: Interval, b: Interval) {
  const overlap = Math.min(a.end, b.end) - Math.max(a.start, b.start);
  return overlap > 0 ? overlap / Math.min(a.end - a.start, b.end - b.start) : 0;
}

/** Seconds between two intervals; negative when they overlap. */
export function gapBetween(a: Interval, b: Interval) {
  return Math.max(a.start, b.start) - Math.min(a.end, b.end);
}
