import type { HighlightEvent } from './highlight-plan';
export const signalKeys = ['sports', 'social', 'emotion', 'controversy', 'audience', 'quality'] as const;
export type SignalKey = typeof signalKeys[number];
export type SignalValues = Record<SignalKey, number | null>;
export type SignalWeights = Record<SignalKey, number>;
export const defaultSignalWeights: SignalWeights = { sports: 0.3, social: 0.25, emotion: 0.2, controversy: 0.15, audience: 0.05, quality: 0.05 };
export type FusedAssessment = { values: SignalValues; weights: SignalWeights; statsIds: string[]; postIds: string[]; reasons: string[] };
export type MatchStat = { id: string; matchId: string; period: string; clockSeconds: number; eventType: string; importance: number | null; controversy: number | null; audience: number | null };
export type SocialPost = { id: string; matchId: string; postedAt: string; likes: number; replies: number; reposts: number };
export type ClockAnchor = { period: string; clockSeconds: number; videoSeconds: number; direction: 'up' | 'down'; duration: number };
export type FusionInputs = { matchId: string; stats: MatchStat[]; posts: SocialPost[]; anchors: ClockAnchor[]; videoUtc: string; reactionDelay: number; tolerance: number };
const text = (value: unknown, limit: number) => typeof value === 'string' && !!value.trim() && value.length <= limit;
const unit = (value: unknown) => value === undefined || value === null || typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
export function parseStats(value: unknown): MatchStat[] {
  if (!Array.isArray(value) || value.length > 1000) throw new Error('Import an array of at most 1,000 match events.');
  const ids = new Set<string>();
  return value.map(row => {
    if (!row || !text(row.id, 100) || ids.has(row.id) || !text(row.matchId, 100) || !text(row.period, 40) || !text(row.eventType, 100) || !Number.isFinite(row.clockSeconds) || row.clockSeconds < 0 || row.clockSeconds > 14400 || !unit(row.importance) || !unit(row.controversy) || !unit(row.audience)) throw new Error('Invalid match event. Include unique id, matchId, period, clockSeconds, eventType and optional scores from 0 to 1.');
    ids.add(row.id);
    return { id: row.id, matchId: row.matchId, period: row.period, clockSeconds: row.clockSeconds, eventType: row.eventType, importance: row.importance ?? null, controversy: row.controversy ?? null, audience: row.audience ?? null };
  });
}
export function parsePosts(value: unknown): SocialPost[] {
  if (!Array.isArray(value) || value.length > 2000) throw new Error('Import an array of at most 2,000 social posts.');
  const ids = new Set<string>();
  return value.map(row => {
    const count = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= 1e10;
    if (!row || !text(row.id, 100) || ids.has(row.id) || !text(row.matchId, 100) || !text(row.postedAt, 60) || !/(Z|[+-]\d{2}:\d{2})$/.test(row.postedAt) || !Number.isFinite(Date.parse(row.postedAt)) || !count(row.likes) || !count(row.replies) || !count(row.reposts)) throw new Error('Invalid social post. Include unique id, matchId, postedAt with timezone, and non-negative integer likes, replies and reposts.');
    ids.add(row.id);
    return { id: row.id, matchId: row.matchId, postedAt: row.postedAt, likes: row.likes, replies: row.replies, reposts: row.reposts };
  });
}
export function parseAnchors(value: unknown): ClockAnchor[] {
  if (!Array.isArray(value) || value.length > 20) throw new Error('Provide at most 20 period clock anchors.');
  const periods = new Set<string>();
  return value.map(row => {
    if (!row || !text(row.period, 40) || periods.has(row.period) || !['up', 'down'].includes(row.direction) || !Number.isFinite(row.clockSeconds) || row.clockSeconds < 0 || row.clockSeconds > 14400 || !Number.isFinite(row.videoSeconds) || row.videoSeconds < 0 || row.videoSeconds > 14400 || !Number.isFinite(row.duration) || row.duration <= 0 || row.duration > 7200) throw new Error('Invalid clock anchor. Use one per period with clockSeconds, videoSeconds, direction (up/down), and duration in seconds.');
    periods.add(row.period); return { period: row.period, clockSeconds: row.clockSeconds, videoSeconds: row.videoSeconds, direction: row.direction, duration: row.duration };
  });
}
export function statsVideoTime(stat: MatchStat, anchors: ClockAnchor[]) {
  const anchor = anchors.find(a => a.period === stat.period);
  if (!anchor) return null;
  const offset = (stat.clockSeconds - anchor.clockSeconds) * (anchor.direction === 'down' ? -1 : 1);
  return offset >= 0 && offset <= anchor.duration ? anchor.videoSeconds + offset : null;
}
export function fusedScore(assessment: FusedAssessment) {
  let sum = 0, knownWeight = 0, totalWeight = 0;
  for (const key of signalKeys) {
    const weight = assessment.weights[key], value = assessment.values[key];
    if (!Number.isFinite(weight) || weight < 0 || weight > 1 || !unit(value)) throw new Error('Signal values and weights must be between 0 and 1.');
    totalWeight += weight;
    if (value !== null && value !== undefined) { knownWeight += weight; sum += value * weight; }
  }
  return { score: knownWeight ? sum / knownWeight : null, coverage: totalWeight ? knownWeight / totalWeight : 0 };
}
const normalize = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function fuseEvents(events: HighlightEvent[], input: FusionInputs, weights: SignalWeights): HighlightEvent[] {
  if (!text(input.matchId, 100) || !Number.isFinite(input.tolerance) || input.tolerance < 0 || input.tolerance > 60 || !Number.isFinite(input.reactionDelay) || input.reactionDelay < 0 || input.reactionDelay > 600) throw new Error('Set a match ID, alignment tolerance (0–60 seconds) and reaction delay (0–600 seconds).');
  const utc = input.videoUtc ? Date.parse(input.videoUtc) : NaN;
  if (input.videoUtc && (!Number.isFinite(utc) || !/(Z|[+-]\d{2}:\d{2})$/.test(input.videoUtc))) throw new Error('The UTC anchor needs an explicit timezone, such as 2026-10-22T18:00:00Z.');
  const contexts = events.map(event => {
    const stats = input.stats.filter(stat => {
      const time = statsVideoTime(stat, input.anchors);
      const actionMatches = normalize(stat.eventType) === normalize(event.label) || !!event.jev && normalize(stat.eventType) === normalize(event.jev.event);
      return stat.matchId === input.matchId && time !== null && time >= event.start - input.tolerance && time <= event.end + input.tolerance && actionMatches;
    });
    const posts = Number.isFinite(utc) ? input.posts.filter(post => {
      const time = (Date.parse(post.postedAt) - utc) / 1000 - input.reactionDelay;
      return post.matchId === input.matchId && time >= event.start - input.tolerance && time <= event.end + input.tolerance;
    }) : [];
    const engagement = posts.reduce((sum, post) => sum + 1 + Math.log1p(post.likes + 2 * post.replies + 3 * post.reposts), 0);
    return { event, stats, posts, engagement };
  });
  const maximum = Math.max(0, ...contexts.map(c => c.engagement));
  return contexts.map(({ event, stats, posts, engagement }) => {
    const average = (key: 'importance' | 'controversy' | 'audience') => {
      const values = stats.map(stat => stat[key]).filter((v): v is number => v !== null);
      return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
    };
    const reasons = ['Scores are editorial estimates; temporal association does not prove a post describes this play.'];
    if (!stats.length) reasons.push('No same-match, same-label stat was aligned to this moment.');
    if (!posts.length) reasons.push('No aligned posts in the imported sample; social trend remains unknown.');
    else reasons.push('Social score is relative engagement within this imported sample, not a population trend or sentiment estimate.');
    const viral: FusedAssessment = { values: { sports: average('importance') ?? event.jev?.importance_estimate ?? null,
      social: posts.length && maximum ? engagement / maximum : null, emotion: event.jev?.excitement_estimate ?? null,
      controversy: average('controversy'), audience: average('audience'), quality: event.jev?.watchability_estimate ?? null },
      weights: { ...weights }, statsIds: stats.map(s => s.id), postIds: posts.map(p => p.id), reasons };
    fusedScore(viral); return { ...event, viral };
  });
}
