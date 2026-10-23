import { eventLabel } from './catalog';
import type { FactorKey, MatchInput, MatchSource, RankedEvent, Selection, SocialData, Weights } from './types';

// Diagram step 10: key moments for highlight generation — timestamps, event type,
// viral score and reasons — in the workflow document's machine-readable format.

const scoreNames: Record<FactorKey, string> = {
  sports: 'sports_importance', social: 'social_trend_spike', emotion: 'emotional_intensity',
  controversy: 'controversy_surprise', audience: 'audience_relevance', quality: 'quality_diversity',
};
const readable: Record<FactorKey, string> = {
  sports: 'sports importance', social: 'social trend', emotion: 'emotion', controversy: 'controversy & surprise', audience: 'audience relevance', quality: 'quality',
};

export type KeyMoment = ReturnType<typeof keyMoment>;
export type KeyMomentsOutput = ReturnType<typeof buildKeyMoments>;

export function buildKeyMoments(jobId: string, input: MatchInput, source: MatchSource, weights: Weights, social: SocialData, ranked: RankedEvent[], selection: Selection, targetSeconds: number) {
  const socialStatus = social.status;
  const onHold = selection.rights.status !== 'permitted';
  const reasons = new Map(selection.skipped.map(item => [item.eventId, item.reason]));
  // Steps 8 and 9 are read back from separate files, so compare by ID, never by reference.
  const selectedIds = new Set(selection.selected.map(event => event.eventId));
  let timeline = 0;
  return {
    schema_version: 'matchwatch.key-moments.v2',
    scoring_version: 'v1',
    score_scale: '0-100',
    score_is_estimate: true,
    job_id: jobId,
    match_id: input.matchId,
    title: input.title,
    source: {
      kind: source.kind, name: source.name, duration_seconds: source.duration,
      scoreplay_media_id: source.scoreplay?.mediaId ?? null,
      twelvelabs_asset_id: source.assetId ?? null,
      twelvelabs_indexed_asset_id: source.indexedAssetId ?? null,
    },
    weights: Object.fromEntries(Object.entries(weights).map(([key, value]) => [scoreNames[key as FactorKey], value])),
    social_data_status: socialStatus,
    rights_status: selection.rights.status,
    rights_reason: selection.rights.reason,
    publication: onHold ? 'on_hold' : 'ready',
    target_duration_seconds: targetSeconds,
    total_duration_seconds: round(selection.totalSeconds),
    selected_moments: selection.selected.map((event, index) => {
      const moment = { order: index + 1, timeline_in_seconds: round(timeline), ...keyMoment(event, source, socialStatus, selection.rights.status) };
      timeline += event.clip.end - event.clip.start;
      return moment;
    }),
    ranking: ranked.map(event => ({
      rank: event.rank, event_id: event.eventId, event_type: event.type, label: event.label,
      start_time_seconds: round(event.clip.start), end_time_seconds: round(event.clip.end), match_time: event.matchTime,
      scores: namedScores(event), viral_score: toHundred(event.viralScore), confidence: round(event.confidence),
      selected: selectedIds.has(event.eventId), skip_reason: reasons.get(event.eventId) ?? null,
    })),
    rundown: source.scoreplay ? rundownMoments(selection.selected, source) : null,
    next_step: {
      highlight_video: onHold ? 'held_until_rights_are_confirmed' : 'available',
      human_review: 'optional',
    },
  };
}

function keyMoment(event: RankedEvent, source: MatchSource, socialStatus: SocialData['status'], rights: Selection['rights']['status']) {
  return {
    rank: event.rank,
    event_id: event.eventId,
    event_type: event.type,
    label: event.label,
    asset_id: source.scoreplay?.mediaId ?? source.assetId ?? null,
    start_time_seconds: round(event.clip.start),
    end_time_seconds: round(event.clip.end),
    match_time: event.matchTime,
    team: event.team,
    players: event.players,
    scores: namedScores(event),
    viral_score: toHundred(event.viralScore),
    confidence: round(event.confidence),
    missing_signals: event.missingSignals.map(key => scoreNames[key]),
    social_data_status: event.social ? socialStatus : socialStatus === 'available' ? 'not_aligned' : socialStatus,
    rights_status: rights,
    reason: explain(event),
    evidence: event.evidence.map(item => ({ signal: scoreNames[item.factor], source: item.source, value: round(item.value), note: item.note })),
  };
}

/** Human-readable reason: the model's observation plus the strongest scoring signals. */
export function explain(event: RankedEvent) {
  const strongest = (Object.keys(event.contributions) as FactorKey[])
    .filter(key => event.factors[key] !== null)
    .sort((a, b) => event.contributions[b] - event.contributions[a])
    .slice(0, 2)
    .map(key => `${readable[key]} ${event.factors[key]!.toFixed(2)}`);
  const observation = event.review?.reason || event.review?.description || `${eventLabel(event.type)} found by video search.`;
  return strongest.length ? `${observation} Strongest signals: ${strongest.join(', ')}.` : observation;
}

function namedScores(event: RankedEvent) {
  return Object.fromEntries((Object.keys(event.factors) as FactorKey[]).map(key => [scoreNames[key], event.factors[key] === null ? null : round(event.factors[key]!)]));
}

/** Moment shape used by the Rundown engine (assetId = ScorePlay media, videoId = TwelveLabs). */
function rundownMoments(events: RankedEvent[], source: MatchSource) {
  const kinds: Partial<Record<RankedEvent['type'], string>> = {
    goal: 'goal', big_chance: 'chance', shot: 'chance', save: 'chance', celebration: 'celebration', crowd_reaction: 'crowd',
    red_card: 'card', yellow_card: 'card', foul: 'confrontation', dunk: 'skill', three_pointer: 'skill', block: 'skill', assist: 'skill',
  };
  return events.map(event => ({
    id: event.eventId, kind: kinds[event.type] ?? 'other', title: event.label,
    primary: { assetId: source.scoreplay!.mediaId, ...(source.indexedAssetId ? { videoId: source.indexedAssetId } : {}), start: round(event.clip.start), end: round(event.clip.end), note: explain(event) },
    angles: [],
    signals: [{ source: 'footage', label: explain(event), strength: round(event.viralScore ?? 0) }],
    score: round(event.viralScore ?? 0),
  }));
}

const round = (value: number) => Math.round(value * 100) / 100;
const toHundred = (value: number | null) => (value === null ? null : round(value * 100));
