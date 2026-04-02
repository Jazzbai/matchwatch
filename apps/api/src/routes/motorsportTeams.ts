import { Hono } from 'hono';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { drivers, entrants, eventEntries, leagues, manufacturers, matches } from '../db/schema';
import { resolveCanonicalEntity } from '../lib/entitySlugs';
import { apiError, apiResponse } from '../lib/utils';

const motorsportTeamRoutes = new Hono();

motorsportTeamRoutes.get('/:slug', async (c) => {
    const slug = c.req.param('slug');
    const resolved = await resolveCanonicalEntity('entrant', slug);
    if (!resolved) return c.json(apiError('NOT_FOUND', 'Motorsport team not found'), 404);
    const [entrant] = await db
        .select({
            entrant: entrants,
            league: leagues,
        })
        .from(entrants)
        .leftJoin(leagues, eq(entrants.leagueId, leagues.id))
        .where(eq(entrants.id, resolved.entityId))
        .limit(1);

    if (!entrant) return c.json(apiError('NOT_FOUND', 'Motorsport team not found'), 404);

    const entries = await db
        .select({
            entry: eventEntries,
            match: matches,
            driver: drivers,
            manufacturer: manufacturers,
        })
        .from(eventEntries)
        .innerJoin(matches, eq(eventEntries.matchId, matches.id))
        .leftJoin(drivers, eq(eventEntries.driverId, drivers.id))
        .leftJoin(manufacturers, eq(eventEntries.manufacturerId, manufacturers.id))
        .where(eq(eventEntries.entrantId, entrant.entrant.id))
        .orderBy(desc(matches.matchDateUtc))
        .limit(20);

    const now = new Date().getTime();
    const upcomingEntries = entries
        .filter((row) => new Date(row.match.matchDateUtc).getTime() >= now)
        .sort((a, b) => new Date(a.match.matchDateUtc).getTime() - new Date(b.match.matchDateUtc).getTime())
        .slice(0, 8);
    const recentEntries = entries
        .filter((row) => new Date(row.match.matchDateUtc).getTime() < now)
        .sort((a, b) => new Date(b.match.matchDateUtc).getTime() - new Date(a.match.matchDateUtc).getTime())
        .slice(0, 8);
    const currentDrivers = Array.from(new Map(
        entries
            .filter((row) => row.driver?.id)
            .map((row) => [row.driver!.id, row.driver]),
    ).values()).slice(0, 6);
    const manufacturerSummary = Array.from(new Map(
        entries
            .filter((row) => row.manufacturer?.id)
            .map((row) => [row.manufacturer!.id, row.manufacturer]),
    ).values()).slice(0, 4);

    return c.json(apiResponse({
        ...entrant.entrant,
        league: entrant.league,
        canonicalSlug: entrant.entrant.slug,
        canonicalPath: `/motorsport/teams/${entrant.entrant.slug}`,
        resolvedVia: resolved.matchedVia,
        entries,
        recentEntries,
        upcomingEntries,
        currentDrivers,
        manufacturerSummary,
    }));
});

export default motorsportTeamRoutes;
