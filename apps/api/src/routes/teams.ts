import { Hono } from 'hono';
import { and, desc, eq, gte } from 'drizzle-orm';
import { db } from '../db/client';
import { leagues, matches, players, stadiums, teamRosterMembers, teamStadiumLinks, teams } from '../db/schema';
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
            primaryStadium: stadiums,
        })
        .from(teams)
        .leftJoin(leagues, eq(teams.leagueId, leagues.id))
        .leftJoin(stadiums, eq(teams.primaryStadiumId, stadiums.id))
        .where(eq(teams.id, resolved.entityId))
        .limit(1);

    if (!row) return c.json(apiError('NOT_FOUND', 'Team not found'), 404);

    const [secondaryStadiumRows, rosterRows] = await Promise.all([
        db.select({
            id: stadiums.id,
            slug: stadiums.slug,
            name: stadiums.name,
            shortName: stadiums.shortName,
            city: stadiums.city,
            country: stadiums.country,
            imageUrl: stadiums.imageUrl,
            isPrimary: teamStadiumLinks.isPrimary,
            sortOrder: teamStadiumLinks.sortOrder,
        })
            .from(teamStadiumLinks)
            .innerJoin(stadiums, eq(teamStadiumLinks.stadiumId, stadiums.id))
            .where(and(
                eq(teamStadiumLinks.teamId, row.team.id),
                eq(teamStadiumLinks.isActive, true),
            ))
            .orderBy(teamStadiumLinks.sortOrder, stadiums.name),
        db.select({
            playerId: teamRosterMembers.playerId,
            shirtNumber: teamRosterMembers.shirtNumber,
            position: teamRosterMembers.position,
            isCaptain: teamRosterMembers.isCaptain,
            sortOrder: teamRosterMembers.sortOrder,
            isActive: teamRosterMembers.isActive,
            playerName: players.name,
            playerSlug: players.slug,
            playerShortName: players.shortName,
            headshotUrl: players.headshotUrl,
            nationality: players.nationality,
        })
            .from(teamRosterMembers)
            .innerJoin(players, eq(teamRosterMembers.playerId, players.id))
            .where(and(
                eq(teamRosterMembers.teamId, row.team.id),
                eq(teamRosterMembers.isActive, true),
                eq(players.isActive, true),
            ))
            .orderBy(teamRosterMembers.sortOrder, players.name),
    ]);

    const secondaryStadiums = secondaryStadiumRows
        .filter((stadium) => !stadium.isPrimary && stadium.id !== row.team.primaryStadiumId)
        .map(({ isPrimary: _isPrimary, sortOrder: _sortOrder, ...stadium }) => stadium);
    const roster = rosterRows.map((member) => ({
        id: member.playerId,
        slug: member.playerSlug,
        name: member.playerName,
        shortName: member.playerShortName,
        headshotUrl: member.headshotUrl,
        nationality: member.nationality,
        shirtNumber: member.shirtNumber,
        position: member.position,
        isCaptain: member.isCaptain,
        sortOrder: member.sortOrder,
    }));

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
        primaryStadium: row.primaryStadium,
        secondaryStadiums,
        players: roster,
        recentMatches: teamRecent,
        upcomingMatches: teamUpcoming,
    }));
});

export default teamRoutes;
