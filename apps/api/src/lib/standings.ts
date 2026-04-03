import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { leagueSeasons, leagues, matches, sports, standingsRows, standingsSnapshots, teams } from '../db/schema';

export type ComputedStandingRow = {
  subjectType: 'TEAM';
  teamId: string;
  name: string;
  imageUrl: string | null;
  rank: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: string;
};

const DRAW_SPORT_SLUGS = new Set(['soccer']);

function pointsForResult(sportSlug: string | null | undefined, result: 'W' | 'D' | 'L') {
  if (result === 'W') return DRAW_SPORT_SLUGS.has(sportSlug || '') ? 3 : 1;
  if (result === 'D') return DRAW_SPORT_SLUGS.has(sportSlug || '') ? 1 : 0;
  return 0;
}

export async function ensureCurrentSeason(leagueId: string) {
  const [existing] = await db
    .select()
    .from(leagueSeasons)
    .where(and(eq(leagueSeasons.leagueId, leagueId), eq(leagueSeasons.isCurrent, true)))
    .limit(1);

  if (existing) return existing;

  const year = new Date().getUTCFullYear();
  const [created] = await db
    .insert(leagueSeasons)
    .values({
      leagueId,
      label: `${year} Season`,
      year,
      startsAt: new Date(Date.UTC(year, 0, 1)),
      endsAt: new Date(Date.UTC(year, 11, 31, 23, 59, 59)),
      isCurrent: true,
    })
    .returning();

  return created;
}

export async function computeTeamStandings(leagueId: string, seasonId?: string | null) {
  const [leagueRow] = await db
    .select({
      leagueId: leagues.id,
      sportSlug: sports.slug,
    })
    .from(leagues)
    .leftJoin(sports, eq(leagues.sportId, sports.id))
    .where(eq(leagues.id, leagueId))
    .limit(1);

  if (!leagueRow) return [] as ComputedStandingRow[];

  const finishedMatches = await db
    .select({
      id: matches.id,
      homeTeamId: matches.homeTeamId,
      awayTeamId: matches.awayTeamId,
      homeTeamName: matches.homeTeamName,
      awayTeamName: matches.awayTeamName,
      homeTeamCrestUrl: matches.homeTeamCrestUrl,
      awayTeamCrestUrl: matches.awayTeamCrestUrl,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      matchDateUtc: matches.matchDateUtc,
    })
    .from(matches)
    .where(and(
      eq(matches.leagueId, leagueId),
      eq(matches.eventFormat, 'HEAD_TO_HEAD'),
      eq(matches.status, 'FINISHED'),
      ...(seasonId ? [eq(matches.seasonId, seasonId)] : []),
    ))
    .orderBy(desc(matches.matchDateUtc));

  type TeamAccumulator = ComputedStandingRow & { recent: Array<'W' | 'D' | 'L'> };
  const map = new Map<string, TeamAccumulator>();

  const ensureTeam = (id: string | null, name: string | null, imageUrl: string | null) => {
    if (!id) return null;
    const existing = map.get(id);
    if (existing) return existing;
    const seeded: TeamAccumulator = {
      subjectType: 'TEAM',
      teamId: id,
      name: name || 'Team',
      imageUrl,
      rank: 0,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      form: '',
      recent: [],
    };
    map.set(id, seeded);
    return seeded;
  };

  for (const match of finishedMatches) {
    if (match.homeScore == null || match.awayScore == null) continue;
    const home = ensureTeam(match.homeTeamId, match.homeTeamName, match.homeTeamCrestUrl || null);
    const away = ensureTeam(match.awayTeamId, match.awayTeamName, match.awayTeamCrestUrl || null);
    if (!home || !away) continue;

    home.played += 1;
    away.played += 1;
    home.goalsFor += match.homeScore;
    home.goalsAgainst += match.awayScore;
    away.goalsFor += match.awayScore;
    away.goalsAgainst += match.homeScore;

    let homeResult: 'W' | 'D' | 'L' = 'D';
    let awayResult: 'W' | 'D' | 'L' = 'D';

    if (match.homeScore > match.awayScore) {
      home.wins += 1;
      away.losses += 1;
      homeResult = 'W';
      awayResult = 'L';
    } else if (match.homeScore < match.awayScore) {
      away.wins += 1;
      home.losses += 1;
      awayResult = 'W';
      homeResult = 'L';
    } else {
      home.draws += 1;
      away.draws += 1;
    }

    home.points += pointsForResult(leagueRow.sportSlug, homeResult);
    away.points += pointsForResult(leagueRow.sportSlug, awayResult);
    home.recent.unshift(homeResult);
    away.recent.unshift(awayResult);
    home.recent = home.recent.slice(0, 5);
    away.recent = away.recent.slice(0, 5);
  }

  const rows = Array.from(map.values())
    .map((row) => ({
      ...row,
      goalDifference: row.goalsFor - row.goalsAgainst,
      form: row.recent.join(''),
    }))
    .sort((a, b) => (
      b.points - a.points
      || b.goalDifference - a.goalDifference
      || b.goalsFor - a.goalsFor
      || a.name.localeCompare(b.name)
    ))
    .map((row, index) => ({
      subjectType: row.subjectType,
      teamId: row.teamId,
      name: row.name,
      imageUrl: row.imageUrl,
      rank: index + 1,
      played: row.played,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      goalDifference: row.goalDifference,
      points: row.points,
      form: row.form,
    }));

  return rows;
}

export async function refreshLeagueStandingsSnapshot(leagueId: string, seasonId?: string | null) {
  const season = seasonId ? await db.select().from(leagueSeasons).where(eq(leagueSeasons.id, seasonId)).limit(1).then((rows) => rows[0] || null) : await ensureCurrentSeason(leagueId);
  const rows = await computeTeamStandings(leagueId, season?.id || null);

  const [snapshot] = await db
    .insert(standingsSnapshots)
    .values({
      leagueId,
      seasonId: season?.id || null,
      tableType: 'TEAM',
      source: 'INTERNAL',
      generatedAt: new Date(),
      metadata: { rowCount: rows.length },
    })
    .returning();

  if (rows.length > 0) {
    await db.insert(standingsRows).values(rows.map((row) => ({
      snapshotId: snapshot.id,
      subjectType: 'TEAM' as const,
      teamId: row.teamId,
      rank: row.rank,
      played: row.played,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      goalDifference: row.goalDifference,
      points: row.points.toFixed(2),
      form: row.form,
      metadata: { name: row.name, imageUrl: row.imageUrl },
    })));
  }

  return {
    snapshot,
    season,
    rows,
  };
}

export async function getLatestLeagueStandings(leagueId: string, seasonId?: string | null) {
  const [snapshot] = await db
    .select()
    .from(standingsSnapshots)
    .where(and(
      eq(standingsSnapshots.leagueId, leagueId),
      eq(standingsSnapshots.tableType, 'TEAM'),
      ...(seasonId ? [eq(standingsSnapshots.seasonId, seasonId)] : []),
    ))
    .orderBy(desc(standingsSnapshots.generatedAt))
    .limit(1);

  const [latestFinishedMatch] = await db
    .select({
      updatedAt: matches.updatedAt,
      lastSyncedAt: matches.lastSyncedAt,
      matchDateUtc: matches.matchDateUtc,
    })
    .from(matches)
    .where(and(
      eq(matches.leagueId, leagueId),
      eq(matches.eventFormat, 'HEAD_TO_HEAD'),
      eq(matches.status, 'FINISHED'),
      ...(seasonId ? [eq(matches.seasonId, seasonId)] : []),
    ))
    .orderBy(desc(matches.updatedAt))
    .limit(1);

  const latestFinishedMatchTimestamp = latestFinishedMatch
    ? Math.max(
      latestFinishedMatch.updatedAt?.getTime?.() || 0,
      latestFinishedMatch.lastSyncedAt?.getTime?.() || 0,
      latestFinishedMatch.matchDateUtc?.getTime?.() || 0,
    )
    : 0;
  const snapshotTimestamp = snapshot?.generatedAt?.getTime?.() || 0;
  const shouldRefresh = !snapshot || latestFinishedMatchTimestamp > snapshotTimestamp;

  const ensured = shouldRefresh ? (await refreshLeagueStandingsSnapshot(leagueId, seasonId)).snapshot : snapshot;
  const rows = await db
    .select({
      row: standingsRows,
      team: teams,
    })
    .from(standingsRows)
    .leftJoin(teams, eq(standingsRows.teamId, teams.id))
    .where(eq(standingsRows.snapshotId, ensured.id))
    .orderBy(asc(standingsRows.rank));

  return {
    snapshot: ensured,
    rows: rows.map(({ row, team }) => ({
      rank: row.rank,
      played: row.played,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      goalDifference: row.goalDifference,
      points: Number(row.points || 0),
      form: row.form || '',
      team: row.teamId ? {
        id: row.teamId,
        name: team?.name || (row.metadata as Record<string, unknown> | null | undefined)?.name || 'Team',
        slug: team?.slug || null,
        crestUrl: team?.crestUrl || ((row.metadata as Record<string, unknown> | null | undefined)?.imageUrl as string | null | undefined) || null,
      } : null,
    })),
  };
}
