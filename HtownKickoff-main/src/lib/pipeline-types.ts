import type { FusionInputs } from './event-fusion';
import type { HighlightPriority } from './highlight-preferences';
import type { HighlightEvent } from './highlight-plan';

export const pipelineSteps = ['Input sources', 'Video understanding', 'Event fusion', 'Unified event database', 'Scoring & ranking', 'Highlight candidates', 'Story builder'] as const;
export type StepNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type PipelineState = 'pending' | 'working' | 'ready' | 'error' | 'stale';
export type PipelineStep = { step: StepNumber; name: string; state: PipelineState; revision: number; message: string; startedAt?: string; updatedAt: string };
export type PipelineJob = { id: string; title: string; createdAt: string; updatedAt: string; steps: PipelineStep[] };
export type PipelineSource = { kind: 'upload' | 'scoreplay' | 'hls'; name: string; mediaId?: string; hlsUrl?: string; captureSeconds?: number; assetId?: string; indexId?: string; indexedAssetId?: string; programDateTime?: string; mediaSequence?: number };
export type PipelineInput = { matchId: string; title: string; sport: 'Soccer' | 'Basketball'; duration: number; target: number; queries: string[]; before: number; after: number; scoringPriority: HighlightPriority; source: PipelineSource; fusion: FusionInputs };
export type SourceOutput = { input: PipelineInput; source: PipelineSource; duration: number; temporaryFilesDeleted: true };
export type UnderstoodOutput = SourceOutput & { events: HighlightEvent[] };
export type Artifact<T = unknown> = { schema_version: 'matchwatch.pipeline.v1'; job_id: string; step: StepNumber; revision: number; input_revision: number; created_at: string; data: T };

/** Draft only until the downstream team supplies and agrees its exact contract. */
export type StoryDraft = {
  schema_version: 'matchwatch.story.draft.v1'; contract_status: 'awaiting_team_contract'; job_id: string; match_id: string;
  title: string; sport: string; timebase: 'recording_seconds'; target_duration_seconds: number; total_duration_seconds: number;
  source: { type: PipelineSource['kind']; name: string; scoreplay_media_id: string | null; twelvelabs_asset_id: string; program_date_time: string | null; hls_media_sequence: number | null };
  clips: { order: number; event_id: string; label: string; in_seconds: number; out_seconds: number; timeline_in_seconds: number; timeline_out_seconds: number; estimated_score: number; reason: string; evidence: { statistics_ids: string[]; post_ids: string[] } }[];
  downstream: { next_step: 8; human_editor_required: true; rights_review_status: 'not_checked'; final_render_status: 'not_started' };
};
