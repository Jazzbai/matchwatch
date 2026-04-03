import { Hono } from 'hono';
import { and, asc, desc, eq, gte, lte, notInArray } from 'drizzle-orm';
import { db } from '../db/client';
import { leagues, matches, sports, teams } from '../db/schema';
import { resolveCanonicalEntity } from '../lib/entitySlugs';
import { getLatestLeagueStandings } from '../lib/standings';
import { apiError, apiResponse } from '../lib/utils';

const leagueRoutes = new Hono();

async function resolveLeague(slugOrId: string) {
    const resolved = await resolveCanonicalEntity('league', slugOrId);
    if (!resolved) return null;
    const [row] = await db
        .select({
            league: leagues,
            sport: sports,
        })
        .from(leagues)
        .leftJoin(sports, eq(leagues.sportId, sports.id))
        .where(eq(leagues.id, resolved.entityId))
        .limit(1);
    return row ? { ...row, resolved } : null;
}

async function loadLeagueMatches(leagueId: string, mode: 'fixtures' | 'results', limit = 12) {
    const rows = await db
        .select({
            match: matches,
            homeTeam: teams,
        })
        .from(matches)
        .leftJoin(teams, eq(matches.homeTeamId, teams.id))
        .where(and(
            eq(matches.leagueId, leagueId),
            eq(matches.eventFormat, 'HEAD_TO_HEAD'),
            mode === 'fixtures' ? gte(matches.matchDateUtc, new Date()) : lte(matches.matchDateUtc, new Date()),
            ...(mode === 'fixtures'
                ? [notInArray(matches.status, ['FINISHED', 'CANCELLED'])]
                : [eq(matches.status, 'FINISHED')]),
        ))
        .orderBy(mode === 'fixtures' ? asc(matches.matchDateUtc) : desc(matches.matchDateUtc))
        .limit(limit);

    return Promise.all(rows.map(async ({ match, homeTeam }) => {
        const awayTeam = match.awayTeamId
            ? await db.select().from(teams).where(eq(teams.id, match.awayTeamId)).limit(1).then((items) => items[0] || null)
            : null;
        return {
            ...match,
            homeTeamName: match.homeTeamName || homeTeam?.name || null,
            awayTeamName: match.awayTeamName || awayTeam?.name || null,
            homeTeamCrestUrl: match.homeTeamCrestUrl || homeTeam?.crestUrl || null,
            awayTeamCrestUrl: match.awayTeamCrestUrl || awayTeam?.crestUrl || null,
        };
    }));
}

leagueRoutes.get('/:slug', async (c) => {
    const slug = c.req.param('slug');
    const row = await resolveLeague(slug);
    if (!row) return c.json(apiError('NOT_FOUND', 'League not found'), 404);

    const [memberTeams, standings, fixtures, results] = await Promise.all([
        db.select({
            id: teams.id,
            name: teams.name,
            slug: teams.slug,
            shortName: teams.shortName,
            crestUrl: teams.crestUrl,
            heroImageUrl: teams.heroImageUrl,
            shortDescription: teams.shortDescription,
            description: teams.description,
            country: teams.country,
        }).from(teams).where(and(eq(teams.leagueId, row.league.id), eq(teams.isActive, true))).orderBy(teams.name),
        getLatestLeagueStandings(row.league.id),
        loadLeagueMatches(row.league.id, 'fixtures', 8),
        loadLeagueMatches(row.league.id, 'results', 8),
    ]);

    return c.json(apiResponse({
        ...row.league,
        sport: row.sport,
        canonicalSlug: row.league.slug,
        canonicalPath: `/leagues/${row.league.slug}`,
        resolvedVia: row.resolved.matchedVia,
        teams: memberTeams,
        standings,
        fixtures,
        results,
    }));
});

leagueRoutes.get('/:slug/standings', async (c) => {
    const slug = c.req.param('slug');
    const row = await resolveLeague(slug);
    if (!row) return c.json(apiError('NOT_FOUND', 'League not found'), 404);
    return c.json(apiResponse(await getLatestLeagueStandings(row.league.id)));
});

leagueRoutes.get('/:slug/fixtures', async (c) => {
    const slug = c.req.param('slug');
    const row = await resolveLeague(slug);
    if (!row) return c.json(apiError('NOT_FOUND', 'League not found'), 404);
    return c.json(apiResponse(await loadLeagueMatches(row.league.id, 'fixtures')));
});

leagueRoutes.get('/:slug/results', async (c) => {
    const slug = c.req.param('slug');
    const row = await resolveLeague(slug);
    if (!row) return c.json(apiError('NOT_FOUND', 'League not found'), 404);
    return c.json(apiResponse(await loadLeagueMatches(row.league.id, 'results')));
});

export default leagueRoutes;
