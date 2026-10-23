import { fusedScore, type SignalValues, type SignalWeights } from './event-fusion';
import type { HighlightClip, HighlightEvent } from './highlight-plan';
import type { StoryDraft, UnderstoodOutput } from './pipeline-types';
import { PipelineError } from './pipeline-store';

// Compatible with src/lib/rundown/types.ts at SamGu-NRX/spurs-hackathon@5866cb9.
// Rundown Segment.assetId identifies ScorePlay media, not a TwelveLabs asset.
export type RundownSegment = { assetId: string; videoId?: string; start: number; end: number; note?: string };
export type RundownMoment = {
  id: string; kind: 'goal' | 'chance' | 'celebration' | 'crowd' | 'away-end' | 'silence' | 'bench' | 'coach' | 'card' | 'confrontation' | 'skill' | 'sponsor' | 'press' | 'other';
  title: string; primary: RundownSegment; angles: RundownSegment[];
  signals: { source: 'footage' | 'match-log' | 'fans' | 'archive'; label: string; query?: string; ref?: string; strength: number }[];
  score: number;
};
export type RankedMoment = {
  rank: number; event_id: string; event_type: string; start_seconds: number; end_seconds: number;
  viral_score: number | null; scores: SignalValues | null; effective_weights: SignalWeights | null; contributions: SignalWeights | null;
  confidence: { evidence_coverage: number; calibrated_probability: null };
  explanation: string; selected: boolean; skip_reason: string | null;
  evidence: { statistics_ids: string[]; post_ids: string[] };
};
export type KeyMomentsHandoff = {
  schema_version: 'matchwatch.key-moments.v1'; job_id: string; match_id: string;
  flowchart_steps: { step: 8 | 9 | 10; name: string; state: 'ready' }[];
  source: StoryDraft['source'] & { twelvelabs_indexed_asset_id: string | null; duration_seconds: number };
  target_duration_seconds: number; total_duration_seconds: number; score_is_estimate: true;
  ranking: RankedMoment[];
  selected: (RankedMoment & { order: number; timeline_in_seconds: number; timeline_out_seconds: number })[];
  skipped: { event_id: string; reason: string }[];
  selection: { max_clips: 5; distinct_event_types: number; combined_editorial_score: number; overlap_allowed: false };
  rundown: { compatible: true; moments: RundownMoment[] } | { compatible: false; reason: string; moments: [] };
  rights_review_status: 'not_checked'; final_render_status: 'not_started';
};

function unsafe(event: HighlightEvent, duration: number) {
  const review = event.jev;
  if (!Number.isFinite(event.start) || !Number.isFinite(event.end) || event.start < 0 || event.end <= event.start || event.end > duration) return 'Invalid source timestamps.';
  if (!review || event.reviewOverride) return 'No verified AI review is available.';
  if (review.duplicate_of) return `Duplicate of ${review.duplicate_of}.`;
  if (review.needs_review) return 'Evidence is uncertain; excluded from automatic selection.';
  if (!review.recommend_include) return 'The video review did not recommend this moment.';
  if (!Number.isFinite(review.suggested_start) || !Number.isFinite(review.suggested_end) || review.suggested_start < 0 || review.suggested_end <= review.suggested_start || review.suggested_end > duration) return 'Reviewed clip boundaries are unsafe.';
  return null;
}
function kindOf(label: string): RundownMoment['kind'] {
  const labelWords = label.toLowerCase().replace(/[_-]+/g, ' ');
  for (const [kind, pattern] of [
    ['chance', /miss|chance|shot on target/], ['goal', /\bgoal\b/], ['celebration', /celebrat/], ['crowd', /crowd|fan reaction/],
    ['bench', /bench/], ['coach', /coach/], ['card', /\b(red|yellow) card\b/], ['confrontation', /confront|disagree|fight/],
    ['skill', /dunk|three.point|assist|block|skill/], ['sponsor', /sponsor/], ['press', /press conference|interview/],
  ] as const) if (pattern.test(labelWords)) return kind;
  return 'other';
}

/** Flowchart 8–10: retain every ranked candidate and the selector's complete decision trail. */
export function buildKeyMomentsHandoff(story: StoryDraft, data: UnderstoodOutput & { clips: HighlightClip[] }): KeyMomentsHandoff {
  if (story.match_id !== data.input.matchId || story.source.twelvelabs_asset_id !== data.source.assetId || story.source.scoreplay_media_id !== (data.source.mediaId || null) || !Number.isFinite(data.duration) || data.duration <= 0) throw new PipelineError('The story and candidate source do not match.', 409);
  const events = new Map(data.events.map(event => [event.id, event]));
  if (data.events.some(event => !Number.isFinite(event.start) || !Number.isFinite(event.end) || event.start < 0 || event.end <= event.start || event.end > data.duration)) throw new PipelineError('A ranked event has invalid source timestamps.', 409);
  if (events.size !== data.events.length || story.clips.length > 5 || story.clips.length !== data.clips.length) throw new PipelineError('The handoff contains duplicate IDs or inconsistent selections.', 409);
  const clips = new Map(data.clips.map(clip => [clip.id, clip])), selectedIds = new Set(story.clips.map(clip => clip.event_id));
  if (clips.size !== data.clips.length || selectedIds.size !== story.clips.length) throw new PipelineError('The handoff contains duplicate selections.', 409);
  const ranking = data.events.map(event => {
    const score = event.viral ? fusedScore(event.viral) : null;
    const selected = selectedIds.has(event.id), invalid = unsafe(event, data.duration);
    let skipReason = invalid || (score?.score == null ? 'No sourced scoring criteria are available.' : score.score <= 0 ? 'The editorial score is zero.' : null);
    if (selected && skipReason) throw new PipelineError('The story selected an unverified or unscored moment.', 409);
    if (!selected && !skipReason) {
      const start = event.jev!.suggested_start, end = event.jev!.suggested_end;
      const overlap = data.clips.find(clip => start < clip.clipEnd && end > clip.clipStart);
      skipReason = overlap ? `Overlaps selected moment ${overlap.id}.` : 'Not part of the selected combination within the duration and five-clip limits.';
    }
    return { rank: 0, event_id: event.id, event_type: event.jev?.event || event.label, start_seconds: invalid ? event.start : event.jev!.suggested_start, end_seconds: invalid ? event.end : event.jev!.suggested_end,
      viral_score: score?.score ?? null, scores: event.viral?.values || null, effective_weights: score?.effectiveWeights || null, contributions: score?.contributions || null,
      confidence: { evidence_coverage: score?.coverage ?? 0, calibrated_probability: null }, explanation: [event.jev?.reason, ...(event.viral?.reasons || [])].filter(Boolean).join(' ') || 'No verified explanation is available.', selected, skip_reason: selected ? null : skipReason,
      evidence: { statistics_ids: event.viral?.statsIds || [], post_ids: event.viral?.postIds || [] } } satisfies RankedMoment;
  }).sort((a, b) => (b.viral_score ?? -1) - (a.viral_score ?? -1) || a.start_seconds - b.start_seconds || a.event_id.localeCompare(b.event_id)).map((row, index) => ({ ...row, rank: index + 1 }));
  let end = 0, timeline = 0;
  const selected = story.clips.map((clip, index) => {
    const row = ranking.find(row => row.event_id === clip.event_id), original = clips.get(clip.event_id);
    if (![clip.in_seconds, clip.out_seconds, clip.timeline_in_seconds, clip.timeline_out_seconds, clip.estimated_score].every(Number.isFinite) || clip.order !== index + 1 || !row || !original || !row.selected || clip.in_seconds < end || clip.out_seconds <= clip.in_seconds || clip.out_seconds > data.duration || Math.abs(clip.in_seconds - original.clipStart) > 1e-6 || Math.abs(clip.out_seconds - original.clipEnd) > 1e-6 || Math.abs(clip.estimated_score - (row.viral_score ?? -1)) > 1e-6) throw new PipelineError('Selected timestamps, scores or event IDs do not match the saved candidates.', 409);
    end = clip.out_seconds; const start = timeline; timeline += clip.out_seconds - clip.in_seconds;
    if (Math.abs(clip.timeline_in_seconds - start) > 1e-6 || Math.abs(clip.timeline_out_seconds - timeline) > 1e-6) throw new PipelineError('The story timeline is inconsistent.', 409);
    return { ...row, start_seconds: clip.in_seconds, end_seconds: clip.out_seconds, order: clip.order, timeline_in_seconds: start, timeline_out_seconds: timeline };
  });
  if (!selected.length || timeline > data.input.target + 1e-6 || Math.abs(timeline - story.total_duration_seconds) > 1e-6) throw new PipelineError('No valid selection fits this story budget.', 409);
  const mediaId = data.source.kind === 'scoreplay' ? data.source.mediaId : undefined;
  const rundown: KeyMomentsHandoff['rundown'] = mediaId ? { compatible: true, moments: selected.map(row => ({ id: row.event_id, kind: kindOf(row.event_type), title: row.event_type,
    primary: { assetId: mediaId, ...(data.source.indexedAssetId ? { videoId: data.source.indexedAssetId } : {}), start: row.start_seconds, end: row.end_seconds, note: row.explanation },
    angles: [], signals: [{ source: 'footage', label: row.explanation, strength: row.viral_score! }], score: row.viral_score! })) } : { compatible: false, reason: 'Rundown requires a ScorePlay media ID. This source remains available in the MatchWatch key moments output.', moments: [] };
  return { schema_version: 'matchwatch.key-moments.v1', job_id: story.job_id, match_id: story.match_id,
    flowchart_steps: [{ step: 8, name: 'Rank all moments', state: 'ready' }, { step: 9, name: 'Select top moments automatically', state: 'ready' }, { step: 10, name: 'Output key moments', state: 'ready' }],
    source: { ...story.source, twelvelabs_indexed_asset_id: data.source.indexedAssetId || null, duration_seconds: data.duration }, target_duration_seconds: data.input.target, total_duration_seconds: timeline, score_is_estimate: true,
    ranking, selected, skipped: ranking.filter(row => !row.selected).map(row => ({ event_id: row.event_id, reason: row.skip_reason! })),
    selection: { max_clips: 5, distinct_event_types: new Set(selected.map(row => row.event_type)).size, combined_editorial_score: selected.reduce((sum, row) => sum + row.viral_score!, 0), overlap_allowed: false },
    rundown, rights_review_status: 'not_checked', final_render_status: 'not_started' };
}
