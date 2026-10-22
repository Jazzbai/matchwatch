export type ScorePlayFilters = { leagueId?: string; seasonId?: string; matchId?: string; year?: string; from?: string; to?: string; order?: string };
export class ScorePlayFilterError extends Error {}
export function filterId(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const id = Number(value);
  if (!/^[1-9][0-9]*$/.test(value) || !Number.isSafeInteger(id)) throw new ScorePlayFilterError('Choose a valid ScorePlay collection or season.');
  return id;
}
export function scorePlayDateRange(filters: ScorePlayFilters) {
  function day(value: string | undefined, last: boolean) {
    if (!value) return undefined;
    const date = new Date(`${value}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new ScorePlayFilterError('Choose a valid calendar date.');
    if (date.getTime() < 0) throw new ScorePlayFilterError('Choose a date from 1970 onward.');
    return date.getTime() / 1000 + (last ? 86399 : 0);
  }
  let start = day(filters.from, false), end = day(filters.to, true);
  if (filters.year) {
    if (!/^\d{4}$/.test(filters.year) || Number(filters.year) < 1970 || Number(filters.year) > 2100) throw new ScorePlayFilterError('Choose a year from 1970 to 2100.');
    const yearStart = Date.UTC(Number(filters.year), 0, 1) / 1000, yearEnd = Date.UTC(Number(filters.year) + 1, 0, 1) / 1000 - 1;
    start = Math.max(start ?? yearStart, yearStart); end = Math.min(end ?? yearEnd, yearEnd);
  }
  if (start !== undefined && end !== undefined && start > end) throw new ScorePlayFilterError('The selected year and dates do not overlap.');
  return { ...(start !== undefined ? { start_date: start } : {}), ...(end !== undefined ? { end_date: end } : {}) };
}
