import type { HighlightClip } from './highlight-plan';
import type { SourceOutput, StoryDraft } from './pipeline-types';
import { PipelineError } from './pipeline-store';

export function buildStoryDraft(jobId: string, source: SourceOutput, clips: HighlightClip[]): StoryDraft {
  const ordered = [...clips].sort((a, b) => a.clipStart - b.clipStart || a.id.localeCompare(b.id));
  if (!ordered.length) throw new PipelineError('No complete, non-overlapping moment fits the story. Adjust the queries or target length.');
  const seen = new Set<string>(); let timeline = 0, previousEnd = 0;
  const sequence = ordered.map((clip, index) => {
    if (seen.has(clip.id) || !Number.isFinite(clip.clipStart) || !Number.isFinite(clip.clipEnd) || clip.clipStart < previousEnd || clip.clipEnd <= clip.clipStart || clip.clipEnd > source.duration || !Number.isFinite(clip.score) || clip.score < 0 || clip.score > 1) throw new PipelineError('Story contains a duplicate, invalid score, overlap or unsafe clip boundary.');
    seen.add(clip.id); previousEnd = clip.clipEnd;
    const start = timeline; timeline += clip.clipEnd - clip.clipStart;
    return { order: index + 1, event_id: clip.id, label: clip.label, in_seconds: clip.clipStart, out_seconds: clip.clipEnd, timeline_in_seconds: start, timeline_out_seconds: timeline, estimated_score: clip.score,
      reason: clip.jev?.reason || 'Selected from detected evidence using the configured scoring and duration rules.',
      evidence: { statistics_ids: clip.viral?.statsIds || [], post_ids: clip.viral?.postIds || [] } };
  });
  if (timeline > source.input.target + 1e-6) throw new PipelineError('The story exceeds its target duration.');
  return { schema_version: 'matchwatch.story.draft.v1', contract_status: 'awaiting_team_contract', job_id: jobId, match_id: source.input.matchId, title: source.input.title, sport: source.input.sport,
    timebase: 'recording_seconds', target_duration_seconds: source.input.target, total_duration_seconds: timeline,
    source: { type: source.source.kind, name: source.source.name, scoreplay_media_id: source.source.mediaId || null, twelvelabs_asset_id: source.source.assetId!, program_date_time: source.source.programDateTime || null, hls_media_sequence: source.source.mediaSequence ?? null },
    clips: sequence, downstream: { next_step: 8, human_editor_required: true, rights_review_status: 'not_checked', final_render_status: 'not_started' } };
}
