import { randomUUID } from 'node:crypto';
import { parseAnchors, parseMatchEvents } from './match-stats';
import { PipelineError } from './store';
import { eventTypes, type EventType, type HighlightPreferences, type MatchInput, type Weights } from './types';
import { validateWeights } from './viral-score';

export type SourceRequest =
  | { kind: 'library'; ticket: string }
  | { kind: 'scoreplay'; mediaId: string; ticket: string }
  | { kind: 'upload'; name: string }
  | { kind: 'hls'; hlsUrl?: string; captureSeconds: number };
export type JobInput = { match: MatchInput; preferences: HighlightPreferences; source: SourceRequest };

type Raw = Record<string, unknown>;
const object = (value: unknown): Raw => (value && typeof value === 'object' && !Array.isArray(value) ? value as Raw : {});
const text = (value: unknown, limit: number): value is string => typeof value === 'string' && !!value.trim() && value.length <= limit;
const optional = (value: unknown, limit: number) => (text(value, limit) ? value.trim() : undefined);
const number = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const isEventType = (value: unknown): value is EventType => eventTypes.includes(value as EventType);

/** Copies only known fields, so clients cannot inject provider IDs, paths or saved state. */
export function parseJobInput(value: unknown): JobInput {
  try {
    const raw = object(value);
    return { match: parseMatch(object(raw.match)), preferences: parsePreferences(raw.preferences), source: parseSource(object(raw.source)) };
  } catch (error) {
    if (error instanceof PipelineError) throw error;
    throw new PipelineError(error instanceof Error ? error.message : 'Invalid highlight request.');
  }
}

export function parsePreferences(value: unknown): HighlightPreferences {
  const raw = object(value);
  if (raw.sport !== 'Soccer' && raw.sport !== 'Basketball') throw new Error('Choose a sport.');
  if (!number(raw.targetSeconds, 10, 300) || !number(raw.maxMoments, 1, 10) || !number(raw.minGapSeconds, 0, 60)) {
    throw new Error('Choose a length of 10–300 seconds, 1–10 moments and a gap of 0–60 seconds.');
  }
  const queries = Array.isArray(raw.queries) ? raw.queries.map(object) : [];
  const beforeSeconds = raw.beforeSeconds ?? 5, afterSeconds = raw.afterSeconds ?? 10;
  if (!number(beforeSeconds, 0, 30) || !number(afterSeconds, 0, 30)) throw new Error('Clip padding must be between 0 and 30 seconds.');
  if (!queries.length || queries.length > 8 || queries.some(query => !isEventType(query.type) || !text(query.text, 200))) throw new Error('Choose one to eight moment types to search for.');
  const stars = Array.isArray(raw.starPlayers) ? raw.starPlayers : [];
  if (stars.length > 10 || stars.some(player => !text(player, 80))) throw new Error('List at most ten star players.');
  return {
    sport: raw.sport,
    targetSeconds: raw.targetSeconds,
    maxMoments: raw.maxMoments,
    minGapSeconds: raw.minGapSeconds,
    beforeSeconds,
    afterSeconds,
    weights: validateWeights(raw.weights as Weights),
    queries: queries.map(query => ({ type: query.type as EventType, text: (query.text as string).trim() })),
    favoriteTeam: optional(raw.favoriteTeam, 80),
    starPlayers: stars.map(player => (player as string).trim()),
  };
}

function parseMatch(raw: Raw): MatchInput {
  if (!text(raw.title, 200)) throw new Error('Give the match a name.');
  const start = raw.videoStartUtc;
  if (start !== undefined && start !== '' && (!text(start, 40) || !/(Z|[+-]\d{2}:\d{2})$/.test(start) || !Number.isFinite(Date.parse(start)))) {
    throw new Error('The recording start time needs a timezone, e.g. 2026-10-25T16:30:00Z.');
  }
  const delay = raw.reactionDelaySeconds ?? 20;
  if (!number(delay, 0, 600)) throw new Error('Set a fan reaction delay of 0–600 seconds.');
  const social = object(raw.social);
  return {
    matchId: optional(raw.matchId, 100) ?? randomUUID(),
    title: raw.title.trim(),
    homeTeam: optional(raw.homeTeam, 80),
    awayTeam: optional(raw.awayTeam, 80),
    videoStartUtc: optional(start, 40),
    reactionDelaySeconds: delay,
    events: parseMatchEvents(raw.events ?? []),
    anchors: parseAnchors(raw.anchors ?? []),
    social: { enabled: social.enabled === true, query: optional(social.query, 512) },
    rightsDeclared: raw.rightsDeclared === true,
  };
}

function parseSource(raw: Raw): SourceRequest {
  if (raw.kind === 'scoreplay' && typeof raw.mediaId === 'string' && /^[1-9][0-9]{0,15}$/.test(raw.mediaId) && text(raw.ticket, 200)) return { kind: 'scoreplay', mediaId: raw.mediaId, ticket: raw.ticket };
  if (raw.kind === 'library' && text(raw.ticket, 200)) return { kind: 'library', ticket: raw.ticket };
  if (raw.kind === 'upload' && text(raw.name, 200)) return { kind: 'upload', name: raw.name.trim() };
  if (raw.kind === 'hls' && number(raw.captureSeconds, 10, 120) && (raw.hlsUrl === undefined || text(raw.hlsUrl, 4096))) {
    return { kind: 'hls', hlsUrl: raw.hlsUrl, captureSeconds: raw.captureSeconds };
  }
  throw new Error('Choose a library video, an upload or a live HLS feed.');
}
