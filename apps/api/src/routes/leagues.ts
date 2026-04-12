import { Hono } from 'hono';
import { and, asc, desc, eq, gte, lte, notInArray } from 'drizzle-orm';
import { db } from '../db/client';
import { leagues, matches, sports, teams } from '../db/schema';
import { resolveEntityPresentation } from '../lib/entityEnrichment';
import { resolveCanonicalEntity } from '../lib/entitySlugs';
import { getLatestLeagueStandings } from '../lib/standings';
import { choosePreferredTeamRecord, normalizeTeamIdentity } from '../lib/teamIdentity';
import { apiError, apiResponse } from '../lib/utils';

const leagueRoutes = new Hono();

function dedupeLeagueTeams<T extends {
    name: string;
    shortName?: string | null;
    crestUrl?: string | null;
    heroImageUrl?: string | null;
    shortDescription?: string | null;
    description?: string | null;
    externalId?: string | null;
}>(rows: T[]) {
    const groups = new Map<string, T[]>();
    for (const row of rows) {
        const key = normalizeTeamIdentity(row.name) || row.name.toLowerCase();
        const existing = groups.get(key) || [];
        existing.push(row);
        groups.set(key, existing);
    }

    return Array.from(groups.values())
        .map((group) => choosePreferredTeamRecord(group)!)
        .sort((left, right) => left.name.localeCompare(right.name));
}

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
            externalId: teams.externalId,
        }).from(teams).where(and(eq(teams.leagueId, row.league.id), eq(teams.isActive, true))).orderBy(teams.name),
        getLatestLeagueStandings(row.league.id),
        loadLeagueMatches(row.league.id, 'fixtures', 8),
        loadLeagueMatches(row.league.id, 'results', 8),
    ]);

    const presentation = resolveEntityPresentation('league', {
        id: row.league.id,
        name: row.league.name,
        shortName: row.league.shortName,
        sportName: row.sport?.name || null,
        country: row.league.country,
        website: row.league.website,
        shortDescription: row.league.shortDescription,
        description: row.league.description,
        primaryImageUrl: row.league.logoUrl,
        heroImageUrl: row.league.heroImageUrl,
        shortDescriptionSource: row.league.shortDescriptionSource,
        descriptionSource: row.league.descriptionSource,
        primaryImageSource: row.league.logoSource,
        heroImageSource: row.league.heroImageSource,
        websiteSource: row.league.websiteSource,
    });

    return c.json(apiResponse({
        ...row.league,
        shortDescription: presentation.shortDescription,
        description: presentation.description,
        logoUrl: presentation.primaryImageUrl,
        heroImageUrl: presentation.heroImageUrl,
        sport: row.sport,
        canonicalSlug: row.league.slug,
        canonicalPath: `/leagues/${row.league.slug}`,
        resolvedVia: row.resolved.matchedVia,
        teams: dedupeLeagueTeams(memberTeams).map(({ externalId: _externalId, ...team }) => team),
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
