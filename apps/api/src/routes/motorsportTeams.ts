import { Hono } from 'hono';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { drivers, entrants, eventEntries, leagues, manufacturers, matches } from '../db/schema';
import { apiError, apiResponse } from '../lib/utils';

const motorsportTeamRoutes = new Hono();

function isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

motorsportTeamRoutes.get('/:slug', async (c) => {
    const slug = c.req.param('slug');
    const [entrant] = await db
        .select({
            entrant: entrants,
            league: leagues,
        })
        .from(entrants)
        .leftJoin(leagues, eq(entrants.leagueId, leagues.id))
        .where(isUuid(slug) ? eq(entrants.id, slug) : eq(entrants.slug, slug))
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

    return c.json(apiResponse({
        ...entrant.entrant,
        league: entrant.league,
        entries,
    }));
});

export default motorsportTeamRoutes;
