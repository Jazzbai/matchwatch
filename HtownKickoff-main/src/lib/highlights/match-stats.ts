import { eventTypes, type ClockAnchor, type MatchEvent, type Sport } from './types';

// Diagram step 2 (official match events) and the temporal-alignment half of step 5.
// Video time and match time are separate domains: they are only linked through
// explicit kickoff anchors, never assumed to be equal.

const periodStartMinute: Record<Sport, number[]> = { Soccer: [0, 45, 90, 105], Basketball: [0, 12, 24, 36] };

const isPeriod = (value: unknown): value is MatchEvent['period'] => [1, 2, 3, 4].includes(value as number);
const inRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const optionalText = (value: unknown) => value === undefined || (typeof value === 'string' && value.length <= 100);

export function parseMatchEvents(value: unknown): MatchEvent[] {
  if (!Array.isArray(value) || value.length > 200) throw new Error('Provide at most 200 match events.');
  const ids = new Set<string>();
  return value.map(row => {
    const valid = row && typeof row.id === 'string' && /^[\w-]{1,64}$/.test(row.id) && !ids.has(row.id)
      && inRange(row.minute, 0, 150) && (row.second === undefined || inRange(row.second, 0, 59))
      && (row.stoppage === undefined || inRange(row.stoppage, 0, 30)) && isPeriod(row.period)
      && eventTypes.includes(row.type) && optionalText(row.team) && optionalText(row.player);
    if (!valid) throw new Error('Each match event needs a unique id, minute, period, event type and optional team and player.');
    ids.add(row.id);
    const event: MatchEvent = { id: row.id, minute: row.minute, period: row.period, type: row.type };
    if (row.second !== undefined) event.second = row.second;
    if (row.stoppage !== undefined) event.stoppage = row.stoppage;
    if (row.team?.trim()) event.team = row.team.trim();
    if (row.player?.trim()) event.player = row.player.trim();
    return event;
  });
}

export function parseAnchors(value: unknown): ClockAnchor[] {
  if (!Array.isArray(value) || value.length > 4) throw new Error('Provide at most one kickoff anchor per period.');
  const periods = new Set<number>();
  return value.map(row => {
    if (!row || !isPeriod(row.period) || periods.has(row.period) || !inRange(row.videoSeconds, 0, 14400)) throw new Error('Each kickoff anchor needs a period and the video second at which it starts.');
    periods.add(row.period);
    return { period: row.period, videoSeconds: row.videoSeconds };
  });
}

/** Video second of an official event, or null when its period has no kickoff anchor. */
export function eventVideoTime(event: MatchEvent, anchors: ClockAnchor[], sport: Sport): number | null {
  const anchor = anchors.find(item => item.period === event.period);
  if (!anchor) return null;
  const elapsedMinutes = event.minute - periodStartMinute[sport][event.period - 1] + (event.stoppage ?? 0);
  if (elapsedMinutes < 0) return null;
  return anchor.videoSeconds + elapsedMinutes * 60 + (event.second ?? 0);
}

/** Match clock ("65:03") for a video second, using the latest kickoff anchor before it. */
export function matchClock(videoSeconds: number, anchors: ClockAnchor[], sport: Sport): string | null {
  const anchor = [...anchors].sort((a, b) => b.videoSeconds - a.videoSeconds).find(item => item.videoSeconds <= videoSeconds);
  if (!anchor) return null;
  const elapsed = Math.floor(videoSeconds - anchor.videoSeconds + periodStartMinute[sport][anchor.period - 1] * 60);
  return `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
}

/** The official event of the same type closest to a video moment, within the tolerance. */
export function alignOfficialEvent(
  moment: { type: string; start: number; end: number },
  events: MatchEvent[], anchors: ClockAnchor[], sport: Sport, toleranceSeconds = 30,
): MatchEvent | null {
  let best: { event: MatchEvent; distance: number } | null = null;
  for (const event of events) {
    const time = eventVideoTime(event, anchors, sport);
    if (time === null || event.type !== moment.type) continue;
    const distance = time < moment.start ? moment.start - time : time > moment.end ? time - moment.end : 0;
    if (distance <= toleranceSeconds && (!best || distance < best.distance)) best = { event, distance };
  }
  return best?.event ?? null;
}
