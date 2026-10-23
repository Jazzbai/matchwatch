import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildKeyMomentsHandoff } from './rundown-handoff';
import { buildStoryDraft } from './story-builder';
import { optimizeHighlights } from './highlight-optimizer';
import { defaultSignalWeights } from './event-fusion';
import { parsePipelineInput } from './highlight-pipeline';
import type { HighlightEvent } from './highlight-plan';
import type { SourceOutput } from './pipeline-types';

function event(id: string, start: number, end: number, score: number | null, label = 'Dunk'): HighlightEvent {
  return { id, label, start, end, confidence: 0, importance: 0, context: 0, audio: 0, reaction: 0, preference: 0,
    viral: { values: { sports: score, social: null, emotion: null, controversy: null, audience: null }, weights: defaultSignalWeights, statsIds: [], postIds: [], reasons: ['Synthetic evidence fixture.'] },
    jev: { candidate_id: id, event: label, importance_estimate: score, excitement_estimate: null, watchability_estimate: null, match_context: null, duplicate_of: null, suggested_start: start, suggested_end: end, recommend_include: true, reason: 'Synthetic reviewed moment.', needs_review: false } };
}
function fixture() {
  const input = parsePipelineInput({ matchId: 'synthetic-match', title: 'Synthetic handoff fixture', sport: 'Basketball', duration: 100, target: 20, queries: ['Dunk'], before: 0, after: 0, scoringPriority: 'balanced', source: { kind: 'scoreplay', name: 'synthetic.mp4', mediaId: '123' }, fusion: { matchId: 'synthetic-match' } });
  const source: SourceOutput = { input, source: { ...input.source, assetId: '111111111111111111111111', indexedAssetId: '222222222222222222222222' }, duration: 100, temporaryFilesDeleted: true };
  const duplicate = event('duplicate', 60, 65, .95); duplicate.jev!.duplicate_of = 'strong';
  const rejected = event('rejected', 80, 85, .8); rejected.jev!.recommend_include = false;
  const unreviewed = event('unreviewed', 90, 95, .85); delete unreviewed.jev;
  const events = [event('strong', 10, 20, .9), event('overlap', 12, 18, .6), event('other', 40, 48, .7, 'Crowd celebration'), duplicate, event('unknown', 70, 75, null), rejected, unreviewed];
  const clips = optimizeHighlights(events, source.duration, input.target, 0, 0);
  const data = { ...source, events, clips }, story = buildStoryDraft('synthetic-job', source, clips);
  return { data, story };
}

test('chart 8–10 ranks every moment, preserves weighted scores and explains every skipped candidate', () => {
  const { data, story } = fixture(), result = buildKeyMomentsHandoff(story, data);
  assert.equal(result.ranking.length, 7); assert.equal(result.selected.length, 2); assert.equal(result.skipped.length, 5);
  assert.deepEqual(result.selected.map(moment => moment.event_id), ['strong', 'other']);
  assert.equal(result.total_duration_seconds, 18); assert.equal(result.selection.distinct_event_types, 2);
  assert.equal(result.ranking[0].event_id, 'duplicate'); assert.equal(result.ranking.at(-1)!.event_id, 'unknown');
  assert.match(result.skipped.find(row => row.event_id === 'duplicate')!.reason, /Duplicate of strong/);
  assert.match(result.skipped.find(row => row.event_id === 'overlap')!.reason, /Overlaps selected moment strong/);
  assert.match(result.skipped.find(row => row.event_id === 'unknown')!.reason, /No sourced scoring/);
  assert.match(result.skipped.find(row => row.event_id === 'unreviewed')!.reason, /No verified AI review/);
  for (const row of result.selected) {
    assert.equal(row.confidence.calibrated_probability, null); assert.equal(row.confidence.evidence_coverage, .3);
    assert.ok(Math.abs(row.contributions!.sports - row.viral_score!) < 1e-9); assert.equal(row.effective_weights!.sports, 1);
  }
  assert.deepEqual(buildKeyMomentsHandoff(story, data), result);
  assert.equal(result.rights_review_status, 'not_checked'); assert.equal(result.final_render_status, 'not_started');
});

test('Rundown segments use ScorePlay media IDs, retain TwelveLabs indexed IDs and never invent safety analysis', () => {
  const { data, story } = fixture(), result = buildKeyMomentsHandoff(story, data);
  assert.equal(result.rundown.compatible, true);
  const moment = result.rundown.moments[0];
  assert.equal(moment.primary.assetId, '123'); assert.equal(moment.primary.videoId, data.source.indexedAssetId);
  assert.notEqual(moment.primary.assetId, data.source.assetId); assert.equal(moment.primary.start, 10); assert.equal(moment.primary.end, 20);
  assert.equal(moment.kind, 'skill'); assert.equal('analysis' in moment, false); assert.ok(Math.abs(moment.score - .9) < 1e-9);
  assert.equal(JSON.stringify(result).includes('api_key'), false);
});

test('uploads retain key moments without masquerading as ScorePlay assets', () => {
  const { data } = fixture(); data.source = { ...data.source, kind: 'upload', mediaId: undefined };
  const story = buildStoryDraft('synthetic-job', data, data.clips), result = buildKeyMomentsHandoff(story, data);
  assert.equal(result.selected.length, 2); assert.equal(result.rundown.compatible, false); assert.equal(result.rundown.moments.length, 0);
});

test('handoff refuses mismatched sources, unsafe selections, altered scores and inconsistent timelines', () => {
  const { data, story } = fixture();
  assert.throws(() => buildKeyMomentsHandoff({ ...story, source: { ...story.source, scoreplay_media_id: '999' } }, data), /source do not match/);
  for (const field of ['in_seconds', 'estimated_score', 'timeline_in_seconds'] as const) {
    const altered = structuredClone(story); altered.clips[0][field] = NaN;
    assert.throws(() => buildKeyMomentsHandoff(altered, data), /do not match/);
  }
  const altered = structuredClone(story); altered.clips[0].estimated_score = .1;
  assert.throws(() => buildKeyMomentsHandoff(altered, data), /do not match/);
  const unknown = structuredClone(data); unknown.events.find(event => event.id === 'strong')!.jev!.needs_review = true;
  assert.throws(() => buildKeyMomentsHandoff(story, unknown), /unverified/);
  const repeated = { ...data, events: [...data.events, data.events[0]] };
  assert.throws(() => buildKeyMomentsHandoff(story, repeated), /duplicate/);
});
