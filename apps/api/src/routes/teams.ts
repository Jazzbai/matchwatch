import { Hono } from 'hono';
import { and, desc, eq, gte } from 'drizzle-orm';
import { db } from '../db/client';
import { leagues, matches, teams } from '../db/schema';
import { getLatestLeagueStandings } from '../lib/standings';
import { apiError, apiResponse } from '../lib/utils';

const teamRoutes = new Hono();

function isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

teamRoutes.get('/:slug', async (c) => {
    const slug = c.req.param('slug');
    const [row] = await db
        .select({
            team: teams,
            league: leagues,
        })
        .from(teams)
        .leftJoin(leagues, eq(teams.leagueId, leagues.id))
        .where(isUuid(slug) ? eq(teams.id, slug) : eq(teams.slug, slug))
        .limit(1);

    if (!row) return c.json(apiError('NOT_FOUND', 'Team not found'), 404);

    const recentMatches = row.team.leagueId ? await db
        .select()
        .from(matches)
        .where(and(
            eq(matches.eventFormat, 'HEAD_TO_HEAD'),
            eq(matches.status, 'FINISHED'),
            eq(matches.leagueId, row.team.leagueId),
        ))
        .orderBy(desc(matches.matchDateUtc))
        .limit(25) : [];

    const teamRecent = recentMatches.filter((match) => match.homeTeamId === row.team.id || match.awayTeamId === row.team.id).slice(0, 8);
    const upcoming = row.team.leagueId ? await db
        .select()
        .from(matches)
        .where(and(
            eq(matches.eventFormat, 'HEAD_TO_HEAD'),
            eq(matches.leagueId, row.team.leagueId),
            gte(matches.matchDateUtc, new Date()),
        ))
        .orderBy(matches.matchDateUtc)
        .limit(25) : [];

    const teamUpcoming = upcoming.filter((match) => match.homeTeamId === row.team.id || match.awayTeamId === row.team.id).slice(0, 8);
    const standings = row.team.leagueId ? await getLatestLeagueStandings(row.team.leagueId) : null;
    const standingsRow = standings?.rows.find((entry) => entry.team?.id === row.team.id) || null;

    return c.json(apiResponse({
        ...row.team,
        league: row.league,
        standingsRow,
        recentMatches: teamRecent,
        upcomingMatches: teamUpcoming,
    }));
});

export default teamRoutes;
