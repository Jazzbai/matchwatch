import { Hono } from 'hono';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { leagues, matchParticipants, matches, players, sports } from '../db/schema';
import { resolveCanonicalEntity } from '../lib/entitySlugs';
import { apiError, apiResponse } from '../lib/utils';

const playerRoutes = new Hono();

playerRoutes.get('/:slug', async (c) => {
    const slug = c.req.param('slug');
    const resolved = await resolveCanonicalEntity('player', slug);
    if (!resolved) return c.json(apiError('NOT_FOUND', 'Player not found'), 404);
    const [row] = await db
        .select({
            player: players,
            sport: sports,
            league: leagues,
        })
        .from(players)
        .leftJoin(sports, eq(players.sportId, sports.id))
        .leftJoin(leagues, eq(players.leagueId, leagues.id))
        .where(eq(players.id, resolved.entityId))
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

    const appearances = participantRows.map(({ participant, match }) => ({
        ...match,
        participant,
    }));
    const now = new Date().getTime();
    const upcomingMatches = appearances
        .filter((match) => new Date(match.matchDateUtc).getTime() >= now)
        .sort((a, b) => new Date(a.matchDateUtc).getTime() - new Date(b.matchDateUtc).getTime())
        .slice(0, 8);
    const recentMatches = appearances
        .filter((match) => new Date(match.matchDateUtc).getTime() < now)
        .sort((a, b) => new Date(b.matchDateUtc).getTime() - new Date(a.matchDateUtc).getTime())
        .slice(0, 8);

    return c.json(apiResponse({
        ...row.player,
        sport: row.sport,
        league: row.league,
        canonicalSlug: row.player.slug,
        canonicalPath: `/players/${row.player.slug}`,
        resolvedVia: resolved.matchedVia,
        matches: appearances,
        recentMatches,
        upcomingMatches,
    }));
});

export default playerRoutes;
