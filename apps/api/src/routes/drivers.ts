import { Hono } from 'hono';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { drivers, entrants, eventEntries, leagues, manufacturers, matches } from '../db/schema';
import { apiError, apiResponse } from '../lib/utils';

const driverRoutes = new Hono();

function isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

driverRoutes.get('/:slug', async (c) => {
    const slug = c.req.param('slug');
    const [driver] = await db
        .select()
        .from(drivers)
        .where(isUuid(slug) ? eq(drivers.id, slug) : eq(drivers.slug, slug))
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

    return c.json(apiResponse({
        ...driver,
        entries,
    }));
});

export default driverRoutes;
