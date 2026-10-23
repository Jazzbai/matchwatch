import { randomUUID } from 'node:crypto';
import { defaultQueries, presetWeights, scoringPresets } from '../catalog';
import { parsePreferences } from '../input';
import type { KeyMomentsOutput } from '../output';
import type { HighlightPreferences, MatchInput, Sport } from '../types';
import { parseWebhookUrl, WebhookUrlError } from './webhook';

// Request validation and the standardized result shape of the integration API.

export class ApiRequestError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export type ProcessOptions = {
  sport?: Sport;
  title?: string;
  home_team?: string;
  away_team?: string;
  target_seconds?: number;
  max_moments?: number;
  priority?: string;
  favorite_team?: string;
  star_players?: string[];
};
export type ProcessRequest = { videoId: string; webhookUrl: string | null; match: Omit<MatchInput, 'title'> & { title?: string }; preferences: HighlightPreferences };

const optionalText = (value: unknown, field: string, limit: number) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || value.length > limit) throw new ApiRequestError(`${field} must be a string of at most ${limit} characters.`);
  return value.trim() || undefined;
};

export function parseProcessRequest(body: unknown): ProcessRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiRequestError('The request body must be a JSON object.');
  const raw = body as Record<string, unknown>;
  const videoId = typeof raw.video_id === 'number' ? String(raw.video_id) : raw.video_id;
  if (typeof videoId !== 'string' || !/^[1-9][0-9]{0,15}$/.test(videoId)) throw new ApiRequestError('video_id must be a ScorePlay media ID (digits only).');
  let webhookUrl: string | null = null;
  if (raw.webhook_url !== undefined && raw.webhook_url !== null) {
    try { webhookUrl = parseWebhookUrl(raw.webhook_url).href; }
    catch (error) { throw new ApiRequestError(error instanceof WebhookUrlError ? error.message : 'Invalid webhook_url.'); }
  }
  const options = (raw.options ?? {}) as ProcessOptions;
  if (typeof options !== 'object' || Array.isArray(options)) throw new ApiRequestError('options must be an object.');
  const sport: Sport = options.sport ?? 'Soccer';
  if (sport !== 'Soccer' && sport !== 'Basketball') throw new ApiRequestError('options.sport must be "Soccer" or "Basketball".');
  const priority = options.priority ?? 'balanced';
  if (!scoringPresets.some(preset => preset.id === priority)) throw new ApiRequestError(`options.priority must be one of: ${scoringPresets.map(preset => preset.id).join(', ')}.`);
  let preferences: HighlightPreferences;
  try {
    // Reuse the studio's validator so the API accepts exactly what the pipeline accepts.
    preferences = parsePreferences({
      sport, targetSeconds: options.target_seconds ?? 60, maxMoments: options.max_moments ?? 5, minGapSeconds: 5,
      weights: presetWeights(priority), queries: defaultQueries[sport],
      favoriteTeam: optionalText(options.favorite_team, 'options.favorite_team', 80), starPlayers: options.star_players ?? [],
    });
  } catch (error) {
    throw new ApiRequestError(`Invalid options: ${error instanceof Error ? error.message : 'check the values.'}`);
  }
  return {
    videoId, webhookUrl, preferences,
    match: {
      matchId: randomUUID(), title: optionalText(options.title, 'options.title', 200),
      homeTeam: optionalText(options.home_team, 'options.home_team', 80), awayTeam: optionalText(options.away_team, 'options.away_team', 80),
      reactionDelaySeconds: 20, events: [], anchors: [], social: { enabled: false }, rightsDeclared: false,
    },
  };
}

/**
 * Maps the pipeline's key-moments output to the API result. Every field comes from
 * the pipeline; `confidence` is evidence coverage (0–1), not a calibrated probability.
 */
export function standardizeResult(output: KeyMomentsOutput) {
  return {
    title: output.title,
    duration_seconds: output.source.duration_seconds,
    total_highlight_seconds: output.total_duration_seconds,
    rights_status: output.rights_status,
    publication: output.publication,
    social_data_status: output.social_data_status,
    highlights: output.selected_moments.map(moment => ({
      rank: moment.rank,
      start_time: moment.start_time_seconds,
      end_time: moment.end_time_seconds,
      event_type: moment.event_type,
      label: moment.label,
      // The key-moments file uses 0–100; the API reports 0–1 like the diagram.
      viral_score: moment.viral_score === null ? null : Math.round(moment.viral_score * 100) / 10_000,
      confidence: moment.confidence,
      description: moment.reason,
      match_time: moment.match_time,
      team: moment.team,
      players: moment.players,
      scores: moment.scores,
      missing_signals: moment.missing_signals,
    })),
    ranked_moments: output.ranking.length,
    key_moments: output,
  };
}
export type ApiResult = ReturnType<typeof standardizeResult>;
