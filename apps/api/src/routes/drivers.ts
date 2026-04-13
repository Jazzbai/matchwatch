import { Hono } from 'hono';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { drivers, entrants, eventEntries, leagues, manufacturers, matches } from '../db/schema';
import { resolveCanonicalEntity } from '../lib/entitySlugs';
import { apiError, apiResponse } from '../lib/utils';

const driverRoutes = new Hono();

driverRoutes.get('/:slug', async (c) => {
    const slug = c.req.param('slug');
    const resolved = await resolveCanonicalEntity('driver', slug);
    if (!resolved) return c.json(apiError('NOT_FOUND', 'Driver not found'), 404);
    const [driver] = await db
        .select()
        .from(drivers)
        .where(eq(drivers.id, resolved.entityId))
        .limit(1);

    if (!driver) return c.json(apiError('NOT_FOUND', 'Driver not found'), 404);

    const entries = await db
        .select({
            entry: eventEntries,
            match: matches,
            league: leagues,
            entrant: entrants,
            manufacturer: manufacturers,
        })
        .from(eventEntries)
        .innerJoin(matches, eq(eventEntries.matchId, matches.id))
        .leftJoin(leagues, eq(matches.leagueId, leagues.id))
        .leftJoin(entrants, eq(eventEntries.entrantId, entrants.id))
        .leftJoin(manufacturers, eq(eventEntries.manufacturerId, manufacturers.id))
        .where(eq(eventEntries.driverId, driver.id))
        .orderBy(desc(matches.matchDateUtc))
        .limit(20);

    const hydratedEntries = entries.map((row) => ({
        ...row,
        raceDateUtc: row.match.matchDateUtc,
    }));
    const now = new Date().getTime();
    const upcomingEntries = hydratedEntries
        .filter((row) => new Date(row.match.matchDateUtc).getTime() >= now)
        .sort((a, b) => new Date(a.match.matchDateUtc).getTime() - new Date(b.match.matchDateUtc).getTime())
        .slice(0, 8);
    const recentEntries = hydratedEntries
        .filter((row) => new Date(row.match.matchDateUtc).getTime() < now)
        .sort((a, b) => new Date(b.match.matchDateUtc).getTime() - new Date(a.match.matchDateUtc).getTime())
        .slice(0, 8);
    const currentContext = upcomingEntries[0] || recentEntries[0] || null;

    return c.json(apiResponse({
        ...driver,
        canonicalSlug: driver.slug,
        canonicalPath: `/drivers/${driver.slug}`,
        resolvedVia: resolved.matchedVia,
        entries: hydratedEntries,
        recentEntries,
        upcomingEntries,
        currentContext: currentContext ? {
            league: currentContext.league,
            entrant: currentContext.entrant,
            manufacturer: currentContext.manufacturer,
            nextEvent: currentContext.match,
        } : null,
    }));
});

export default driverRoutes;
