import { createHash } from 'node:crypto';
import { overlapShare } from './intervals';
import type { TwelveLabsClient } from './twelvelabs';
import { parseReviews, reviewPrompt, reviewSchema, reviewWindows, type ReviewWindow } from './video-review';
import type { CandidateMoment, EventType, Sport } from './types';

// Diagram step 4. Flowchart: "Already analyzed by TwelveLabs?" → reuse the index,
// otherwise index the uploaded asset; then search for candidate moments and review them.

export type UnderstandingState = {
  assetId: string;
  indexedAssetId?: string;
  duration: number;
  nonce: string;
  candidates?: CandidateMoment[];
  windows?: (ReviewWindow & { taskId?: string; done: boolean; error?: string })[];
};
export type UnderstandingContext = { queries: { type: EventType; text: string }[]; sport: Sport; teams: string[] };
export type UnderstandingTick = { done: false; message: string } | { done: true; candidates: CandidateMoment[]; message: string };

const PER_QUERY = 5;
const MAX_CANDIDATES = 24;
const PARALLEL_TASKS = 4;

export class UnderstandingError extends Error {}

/** Performs one bounded unit of work and records progress in `state` for the next call. */
export async function advanceUnderstanding(labs: TwelveLabsClient, state: UnderstandingState, context: UnderstandingContext): Promise<UnderstandingTick> {
  if (!state.indexedAssetId) {
    const asset = await labs.asset(state.assetId);
    if (asset.status === 'failed' || asset.status === 'canceled') throw new UnderstandingError('TwelveLabs could not process this video. Try an H.264 MP4.');
    if (asset.status !== 'ready') return { done: false, message: `Processing the uploaded video (${asset.status || 'queued'}).` };
    state.indexedAssetId = await labs.indexAsset(state.assetId);
    return { done: false, message: 'Adding the video to the TwelveLabs index.' };
  }

  if (!state.candidates) {
    const indexed = await labs.indexedAsset(state.indexedAssetId);
    if (indexed.status === 'failed' || indexed.status === 'canceled') throw new UnderstandingError('TwelveLabs indexing failed for this video.');
    if (indexed.status !== 'ready') return { done: false, message: `Indexing the video (${indexed.status || 'queued'}).` };
    state.duration = indexed.system_metadata?.duration || state.duration;
    state.candidates = await searchCandidates(labs, state.indexedAssetId, state.duration, context.queries);
    state.windows = reviewWindows(state.candidates, state.duration).map(window => ({ ...window, done: false }));
    if (!state.candidates.length) return { done: true, candidates: [], message: 'The search found no candidate moments.' };
    return { done: false, message: `Found ${state.candidates.length} candidate moments. Starting the video review.` };
  }

  const windows = state.windows || [];
  const byId = new Map(state.candidates.map(candidate => [candidate.id, candidate]));
  const members = (window: ReviewWindow) => window.ids.map(id => byId.get(id)!).filter(Boolean);

  const inFlight = windows.filter(w => w.taskId && !w.done).length;
  for (const window of windows.filter(w => !w.done && !w.taskId).slice(0, Math.max(0, PARALLEL_TASKS - inFlight))) {
    const key = createHash('sha256').update(`${state.nonce}|${window.ids.join(',')}`).digest('hex');
    window.taskId = await labs.createAnalysis(state.assetId, reviewPrompt(members(window), context.sport, context.teams), reviewSchema(window.ids), window, key);
  }
  for (const window of windows.filter(w => w.taskId && !w.done)) {
    const result = await labs.analysis(window.taskId!);
    if (result.status === 'ready') {
      const reviews = parseReviews(result.data, members(window), window);
      for (const candidate of members(window)) candidate.review = reviews.get(candidate.id);
      window.done = true;
    } else if (result.status === 'failed' || result.status === 'canceled') {
      // Keep going: candidates without a review stay unverified and are never auto-selected.
      window.done = true;
      window.error = result.error || 'The analysis failed.';
    }
  }

  const finished = windows.filter(w => w.done).length;
  if (finished < windows.length) return { done: false, message: `Reviewed ${finished} of ${windows.length} video windows with Pegasus.` };
  const failed = windows.filter(w => w.error).length;
  return { done: true, candidates: state.candidates, message: `Reviewed ${state.candidates.length} moments${failed ? `; ${failed} window(s) could not be analyzed` : ''}.` };
}

/** Marengo search for every query, interleaved by rank and de-duplicated by overlap. */
async function searchCandidates(labs: TwelveLabsClient, indexedAssetId: string, duration: number, queries: UnderstandingContext['queries']) {
  const results: { type: EventType; text: string; matches: Awaited<ReturnType<TwelveLabsClient['search']>> }[] = [];
  for (let i = 0; i < queries.length; i += 2) {
    const batch = queries.slice(i, i + 2);
    results.push(...await Promise.all(batch.map(async query => ({ ...query, matches: (await labs.search(indexedAssetId, query.text)).slice(0, PER_QUERY) }))));
  }
  const kept: CandidateMoment[] = [];
  for (let rank = 0; rank < PER_QUERY; rank++) {
    for (const result of results) {
      const match = result.matches[rank];
      if (!match) continue;
      const start = Math.max(0, match.start), end = Math.min(duration, match.end);
      if (end - start < 1 || kept.some(other => overlapShare(other, { start, end }) >= 0.6)) continue;
      const id = createHash('sha256').update(`${indexedAssetId}|${result.text}|${start}|${end}`).digest('hex').slice(0, 16);
      kept.push({ id, type: result.type, query: result.text, start, end, searchRank: match.rank, ...(match.transcription ? { transcription: match.transcription } : {}) });
    }
  }
  return kept.slice(0, MAX_CANDIDATES).sort((a, b) => a.start - b.start);
}
