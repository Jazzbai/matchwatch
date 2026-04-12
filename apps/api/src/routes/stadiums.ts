import { Hono } from 'hono';
import { and, asc, desc, eq, gte, or } from 'drizzle-orm';
import { db } from '../db/client';
import { matches, stadiums, teamStadiumLinks, teams } from '../db/schema';
import { resolveCanonicalEntity } from '../lib/entitySlugs';
import { apiError, apiResponse } from '../lib/utils';

const stadiumRoutes = new Hono();

stadiumRoutes.get('/:slug', async (c) => {
    const slug = c.req.param('slug');
    const resolved = await resolveCanonicalEntity('stadium', slug);
    if (!resolved) return c.json(apiError('NOT_FOUND', 'Stadium not found'), 404);

    const [stadium] = await db.select().from(stadiums).where(eq(stadiums.id, resolved.entityId)).limit(1);
    if (!stadium || !stadium.isActive) return c.json(apiError('NOT_FOUND', 'Stadium not found'), 404);

    const linkedTeams = await db.select({
        id: teams.id,
        slug: teams.slug,
        name: teams.name,
        shortName: teams.shortName,
        crestUrl: teams.crestUrl,
        leagueId: teams.leagueId,
        isPrimary: teamStadiumLinks.isPrimary,
        sortOrder: teamStadiumLinks.sortOrder,
    })
        .from(teamStadiumLinks)
        .innerJoin(teams, eq(teamStadiumLinks.teamId, teams.id))
        .where(and(
            eq(teamStadiumLinks.stadiumId, stadium.id),
            eq(teamStadiumLinks.isActive, true),
            eq(teams.isActive, true),
        ))
        .orderBy(teamStadiumLinks.isPrimary, teamStadiumLinks.sortOrder, teams.name);

    const [upcomingMatches, recentMatches] = await Promise.all([
        db.select().from(matches)
            .where(and(
                eq(matches.stadiumId, stadium.id),
                gte(matches.matchDateUtc, new Date()),
            ))
            .orderBy(asc(matches.matchDateUtc))
            .limit(12),
        db.select().from(matches)
            .where(and(
                eq(matches.stadiumId, stadium.id),
                or(eq(matches.status, 'FINISHED'), eq(matches.status, 'IN_PLAY')),
            ))
            .orderBy(desc(matches.matchDateUtc))
            .limit(12),
    ]);

    return c.json(apiResponse({
        ...stadium,
        canonicalSlug: stadium.slug,
        canonicalPath: `/stadiums/${stadium.slug}`,
        resolvedVia: resolved.matchedVia,
        teams: linkedTeams,
        upcomingMatches,
        recentMatches,
    }));
});

export default stadiumRoutes;
