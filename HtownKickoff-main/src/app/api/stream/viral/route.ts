import { NextRequest, NextResponse } from 'next/server';
import { highlightOwner, HighlightAccessError, reserveOperation } from '../../../../lib/highlight-access';
import { parseAnchors, parseAudience, parsePosts, parseStats } from '../../../../lib/event-fusion';
import { reviewInput, validateJevReviews } from '../../../../lib/jev';
import { rankViralMoments } from '../../../../lib/viral-ranking';
import { priorityWeights } from '../../../../lib/highlight-preferences';

export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  try {
    const owner = await highlightOwner(request); reserveOperation(owner, 'request');
    if (Number(request.headers.get('content-length')) > 1024 * 1024) return reply({ error: 'Use a ranking payload smaller than 1 MB.' }, 413);
    const raw = await request.text();
    if (raw.length > 1024 * 1024) return reply({ error: 'Use a ranking payload smaller than 1 MB.' }, 413);
    const input = JSON.parse(raw);
    const candidates = reviewInput(input.events, input.duration);
    const reviews = validateJevReviews(input.events.map((event: { jev: unknown }) => event.jev), candidates, input.duration);
    const events = candidates.map(event => ({ ...event, confidence: 0, importance: 0, context: 0, audio: 0, reaction: 0, preference: 0, jev: reviews.find(review => review.candidate_id === event.id)! }));
    const data = rankViralMoments(events, { matchId: input.matchId, stats: parseStats(input.stats ?? []), posts: parsePosts(input.posts ?? []), anchors: parseAnchors(input.anchors ?? []), videoUtc: input.videoUtc ?? '', reactionDelay: input.reactionDelay ?? 15, tolerance: input.tolerance ?? 10, audience: input.audience === undefined ? undefined : parseAudience(input.audience) }, input.duration, 60, priorityWeights(input.scoringPriority));
    console.info('viral_ranking', { candidates: events.length, selected: data.moments.length });
    return reply(data);
  } catch (error) {
    if (error instanceof HighlightAccessError) return reply({ error: error.message }, error.status);
    console.warn('viral_ranking_rejected');
    return reply({ error: error instanceof SyntaxError ? 'Invalid ranking JSON.' : error instanceof Error ? error.message : 'Invalid ranking inputs.' }, 400);
  }
}
