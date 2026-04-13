import { and, desc, eq, or } from 'drizzle-orm';
import { db } from '../db/client';
import { leagues, matchPredictions, matches, sports } from '../db/schema';
import { getLatestLeagueStandings } from './standings';

const MODEL_VERSION = 'facts-v1';
const DRAW_SPORT_SLUGS = new Set(['soccer']);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundProbability(value: number) {
  return Number(clamp(value, 0, 1).toFixed(4));
}

function resultPointsForPerspective(match: { homeTeamId: string | null; awayTeamId: string | null; homeScore: number | null; awayScore: number | null }, teamId: string) {
  if (match.homeScore == null || match.awayScore == null) return 0;
  if (match.homeTeamId === teamId) {
    if (match.homeScore > match.awayScore) return 1;
    if (match.homeScore === match.awayScore) return 0.5;
    return 0;
  }
  if (match.awayTeamId === teamId) {
    if (match.awayScore > match.homeScore) return 1;
    if (match.homeScore === match.awayScore) return 0.5;
    return 0;
  }
  return 0;
}

export async function computeMatchPrediction(matchId: string) {
  const [matchRow] = await db
    .select({
      match: matches,
      league: leagues,
      sport: sports,
    })
    .from(matches)
    .leftJoin(leagues, eq(matches.leagueId, leagues.id))
    .leftJoin(sports, eq(leagues.sportId, sports.id))
    .where(eq(matches.id, matchId))
    .limit(1);

  if (!matchRow || matchRow.match.eventFormat !== 'HEAD_TO_HEAD' || !matchRow.match.homeTeamId || !matchRow.match.awayTeamId) {
    return null;
  }

  if (!matchRow.match.leagueId) {
    return null;
  }

  const now = new Date(matchRow.match.matchDateUtc);
  const recentMatches = await db
    .select()
    .from(matches)
    .where(and(
      eq(matches.leagueId, matchRow.match.leagueId),
      eq(matches.eventFormat, 'HEAD_TO_HEAD'),
      eq(matches.status, 'FINISHED'),
      or(
        eq(matches.homeTeamId, matchRow.match.homeTeamId),
        eq(matches.awayTeamId, matchRow.match.homeTeamId),
        eq(matches.homeTeamId, matchRow.match.awayTeamId),
        eq(matches.awayTeamId, matchRow.match.awayTeamId),
      ),
    ))
    .orderBy(desc(matches.matchDateUtc))
    .limit(40);

  const homeRecent = recentMatches.filter((entry) => entry.homeTeamId === matchRow.match.homeTeamId || entry.awayTeamId === matchRow.match.homeTeamId).slice(0, 5);
  const awayRecent = recentMatches.filter((entry) => entry.homeTeamId === matchRow.match.awayTeamId || entry.awayTeamId === matchRow.match.awayTeamId).slice(0, 5);
  const headToHead = recentMatches.filter((entry) => (
    (entry.homeTeamId === matchRow.match.homeTeamId && entry.awayTeamId === matchRow.match.awayTeamId)
    || (entry.homeTeamId === matchRow.match.awayTeamId && entry.awayTeamId === matchRow.match.homeTeamId)
  )).slice(0, 5);

  if (homeRecent.length < 2 || awayRecent.length < 2) {
    return null;
  }

  const homeForm = homeRecent.reduce((sum, entry) => sum + resultPointsForPerspective(entry, matchRow.match.homeTeamId!), 0) / homeRecent.length;
  const awayForm = awayRecent.reduce((sum, entry) => sum + resultPointsForPerspective(entry, matchRow.match.awayTeamId!), 0) / awayRecent.length;

  const homeGoalDiff = homeRecent.reduce((sum, entry) => {
    if (entry.homeScore == null || entry.awayScore == null) return sum;
    return sum + (entry.homeTeamId === matchRow.match.homeTeamId ? entry.homeScore - entry.awayScore : entry.awayScore - entry.homeScore);
  }, 0) / homeRecent.length;
  const awayGoalDiff = awayRecent.reduce((sum, entry) => {
    if (entry.homeScore == null || entry.awayScore == null) return sum;
    return sum + (entry.homeTeamId === matchRow.match.awayTeamId ? entry.homeScore - entry.awayScore : entry.awayScore - entry.homeScore);
  }, 0) / awayRecent.length;

  let standingsDelta = 0;
  if (matchRow.match.leagueId) {
    const standings = await getLatestLeagueStandings(matchRow.match.leagueId, matchRow.match.seasonId || null);
    const homeStanding = standings.rows.find((row) => row.team?.id === matchRow.match.homeTeamId);
    const awayStanding = standings.rows.find((row) => row.team?.id === matchRow.match.awayTeamId);
    if (homeStanding && awayStanding) {
      standingsDelta = (awayStanding.rank - homeStanding.rank) / Math.max(standings.rows.length, 1);
    }
  }

  const h2hEdge = headToHead.length === 0 ? 0 : headToHead.reduce((sum, entry) => {
    const points = resultPointsForPerspective(entry, matchRow.match.homeTeamId!);
    return sum + (points - 0.5);
  }, 0) / headToHead.length;

  const score = ((homeForm - awayForm) * 1.1)
    + ((homeGoalDiff - awayGoalDiff) * 0.12)
    + (standingsDelta * 0.75)
    + (h2hEdge * 0.45)
    + 0.18;

  const isDrawSport = DRAW_SPORT_SLUGS.has(matchRow.sport?.slug || '');
  let homeWinProbability = 0;
  let drawProbability = 0;
  let awayWinProbability = 0;

  if (isDrawSport) {
    const drawBase = clamp(0.26 - Math.abs(score) * 0.08, 0.12, 0.3);
    const nonDraw = 1 - drawBase;
    const logistic = 1 / (1 + Math.exp(-score));
    homeWinProbability = roundProbability(nonDraw * logistic);
    awayWinProbability = roundProbability(nonDraw * (1 - logistic));
    drawProbability = roundProbability(1 - homeWinProbability - awayWinProbability);
  } else {
    const logistic = 1 / (1 + Math.exp(-score));
    homeWinProbability = roundProbability(logistic);
    awayWinProbability = roundProbability(1 - logistic);
    drawProbability = 0;
  }

  const explanationFacts = [
    { key: 'recent-form', label: 'Recent form', home: Number(homeForm.toFixed(2)), away: Number(awayForm.toFixed(2)) },
    { key: 'goal-trend', label: 'Goal / score trend', home: Number(homeGoalDiff.toFixed(2)), away: Number(awayGoalDiff.toFixed(2)) },
    { key: 'home-advantage', label: 'Home advantage', value: 0.18 },
    ...(standingsDelta !== 0 ? [{ key: 'league-position', label: 'League position difference', value: Number(standingsDelta.toFixed(2)) }] : []),
    ...(headToHead.length > 0 ? [{ key: 'head-to-head', label: 'Head-to-head edge', value: Number(h2hEdge.toFixed(2)) }] : []),
  ];

  return {
    matchId,
    modelVersion: MODEL_VERSION,
    homeWinProbability,
    drawProbability: isDrawSport ? drawProbability : null,
    awayWinProbability,
    explanationFacts,
    confidence: roundProbability(clamp(0.45 + (homeRecent.length + awayRecent.length + headToHead.length) / 30, 0.45, 0.9)),
    availability: 'READY' as const,
    generatedAt: now.toISOString(),
    isDisplayEnabled: true,
  };
}

export async function refreshMatchPrediction(matchId: string) {
  const prediction = await computeMatchPrediction(matchId);
  if (!prediction) return null;

  const [saved] = await db
    .insert(matchPredictions)
    .values({
      matchId,
      modelVersion: prediction.modelVersion,
      homeWinProbability: prediction.homeWinProbability.toFixed(4),
      drawProbability: prediction.drawProbability == null ? null : prediction.drawProbability.toFixed(4),
      awayWinProbability: prediction.awayWinProbability.toFixed(4),
      explanationFacts: prediction.explanationFacts,
      confidence: prediction.confidence.toFixed(4),
      isDisplayEnabled: true,
      generatedAt: new Date(),
      metadata: { availability: prediction.availability },
    })
    .onConflictDoUpdate({
      target: matchPredictions.matchId,
      set: {
        modelVersion: prediction.modelVersion,
        homeWinProbability: prediction.homeWinProbability.toFixed(4),
        drawProbability: prediction.drawProbability == null ? null : prediction.drawProbability.toFixed(4),
        awayWinProbability: prediction.awayWinProbability.toFixed(4),
        explanationFacts: prediction.explanationFacts,
        confidence: prediction.confidence.toFixed(4),
        generatedAt: new Date(),
        metadata: { availability: prediction.availability },
      },
    })
    .returning();

  return {
    ...prediction,
    generatedAt: saved.generatedAt.toISOString(),
    isDisplayEnabled: saved.isDisplayEnabled,
  };
}

export async function getMatchPrediction(matchId: string) {
  const [existing] = await db.select().from(matchPredictions).where(eq(matchPredictions.matchId, matchId)).limit(1);
  if (existing) {
    return {
      matchId,
      modelVersion: existing.modelVersion,
      homeWinProbability: Number(existing.homeWinProbability || 0),
      drawProbability: existing.drawProbability == null ? null : Number(existing.drawProbability),
      awayWinProbability: Number(existing.awayWinProbability || 0),
      explanationFacts: Array.isArray(existing.explanationFacts) ? existing.explanationFacts : [],
      confidence: Number(existing.confidence || 0),
      generatedAt: existing.generatedAt.toISOString(),
      isDisplayEnabled: existing.isDisplayEnabled,
      availability: typeof existing.metadata === 'object' && existing.metadata && 'availability' in existing.metadata ? (existing.metadata as Record<string, unknown>).availability : 'READY',
    };
  }

  return refreshMatchPrediction(matchId);
}
