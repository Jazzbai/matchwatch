import { Hono } from 'hono';
import { and, desc, eq, gte } from 'drizzle-orm';
import { db } from '../db/client';
import { leagues, matches, teams } from '../db/schema';
import { resolveCanonicalEntity } from '../lib/entitySlugs';
import { getLatestLeagueStandings } from '../lib/standings';
import { apiError, apiResponse } from '../lib/utils';

const teamRoutes = new Hono();

teamRoutes.get('/:slug', async (c) => {
    const slug = c.req.param('slug');
    const resolved = await resolveCanonicalEntity('team', slug);
    if (!resolved) return c.json(apiError('NOT_FOUND', 'Team not found'), 404);
    const [row] = await db
        .select({
            team: teams,
            league: leagues,
        })
        .from(teams)
        .leftJoin(leagues, eq(teams.leagueId, leagues.id))
        .where(eq(teams.id, resolved.entityId))
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
        canonicalSlug: row.team.slug,
        canonicalPath: `/teams/${row.team.slug}`,
        resolvedVia: resolved.matchedVia,
        standingsRow,
        recentMatches: teamRecent,
        upcomingMatches: teamUpcoming,
    }));
});

export default teamRoutes;
