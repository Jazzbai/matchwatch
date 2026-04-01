import { Hono } from 'hono';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { leagues, matchParticipants, matches, players, sports } from '../db/schema';
import { apiError, apiResponse } from '../lib/utils';

const playerRoutes = new Hono();

function isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

playerRoutes.get('/:slug', async (c) => {
    const slug = c.req.param('slug');
    const [row] = await db
        .select({
            player: players,
            sport: sports,
            league: leagues,
        })
        .from(players)
        .leftJoin(sports, eq(players.sportId, sports.id))
        .leftJoin(leagues, eq(players.leagueId, leagues.id))
        .where(isUuid(slug) ? eq(players.id, slug) : eq(players.slug, slug))
        .limit(1);

    if (!row) return c.json(apiError('NOT_FOUND', 'Player not found'), 404);

    const participantRows = await db
        .select({
            participant: matchParticipants,
            match: matches,
        })
        .from(matchParticipants)
        .innerJoin(matches, eq(matchParticipants.matchId, matches.id))
        .where(eq(matchParticipants.playerId, row.player.id))
        .orderBy(desc(matches.matchDateUtc))
        .limit(20);

    return c.json(apiResponse({
        ...row.player,
        sport: row.sport,
        league: row.league,
        matches: participantRows.map(({ participant, match }) => ({
            ...match,
            participant,
        })),
    }));
});

export default playerRoutes;
