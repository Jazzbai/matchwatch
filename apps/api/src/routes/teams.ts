import { Hono } from 'hono';
import { and, desc, eq, gte } from 'drizzle-orm';
import { db } from '../db/client';
import { leagues, matches, players, stadiums, teamRosterMembers, teamStadiumLinks, teams } from '../db/schema';
import { resolveCanonicalEntity } from '../lib/entitySlugs';
import { resolveEntityPresentation } from '../lib/entityEnrichment';
import { resolvePlayerContext } from '../lib/playerContext';
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

    const [secondaryStadiumRows, rosterRows, leagueTeamRows, leaguePlayerRows] = await Promise.all([
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
            shortDescription: players.shortDescription,
            description: players.description,
            aliases: players.aliases,
        })
            .from(teamRosterMembers)
            .innerJoin(players, eq(teamRosterMembers.playerId, players.id))
            .where(and(
                eq(teamRosterMembers.teamId, row.team.id),
                eq(teamRosterMembers.isActive, true),
                eq(players.isActive, true),
            ))
            .orderBy(teamRosterMembers.sortOrder, players.name),
        row.team.leagueId
            ? db.select({
                id: teams.id,
                name: teams.name,
                slug: teams.slug,
                shortName: teams.shortName,
                crestUrl: teams.crestUrl,
                aliases: teams.aliases,
                leagueId: teams.leagueId,
                externalId: teams.externalId,
                heroImageUrl: teams.heroImageUrl,
                shortDescription: teams.shortDescription,
                description: teams.description,
            }).from(teams).where(and(eq(teams.leagueId, row.team.leagueId), eq(teams.isActive, true))).orderBy(teams.name)
            : Promise.resolve([]),
        row.team.leagueId
            ? db.select({
                id: players.id,
                slug: players.slug,
                name: players.name,
                shortName: players.shortName,
                headshotUrl: players.headshotUrl,
                nationality: players.nationality,
                shortDescription: players.shortDescription,
                description: players.description,
                aliases: players.aliases,
            }).from(players).where(and(eq(players.leagueId, row.team.leagueId), eq(players.isActive, true))).orderBy(players.name)
            : Promise.resolve([]),
    ]);

    const secondaryStadiums = secondaryStadiumRows
        .filter((stadium) => !stadium.isPrimary && stadium.id !== row.team.primaryStadiumId)
        .map(({ isPrimary: _isPrimary, sortOrder: _sortOrder, ...stadium }) => stadium);
    const roster = rosterRows.map((member) => {
        const inferredContext = resolvePlayerContext({
            currentLeagueId: row.team.leagueId,
            availableTeams: leagueTeamRows,
            shortDescription: member.shortDescription,
            description: member.description,
            aliases: member.aliases,
        });

        return {
            id: member.playerId,
            slug: member.playerSlug,
            name: member.playerName,
            shortName: member.playerShortName,
            headshotUrl: member.headshotUrl,
            nationality: member.nationality,
            shirtNumber: member.shirtNumber,
            position: member.position || inferredContext.role,
            isCaptain: member.isCaptain,
            sortOrder: member.sortOrder,
        };
    });

    const rosterPlayerIds = new Set(roster.map((member) => member.id));
    const inferredRoster = leaguePlayerRows
        .filter((player) => !rosterPlayerIds.has(player.id))
        .map((player) => {
            const context = resolvePlayerContext({
                currentLeagueId: row.team.leagueId,
                availableTeams: leagueTeamRows,
                shortDescription: player.shortDescription,
                description: player.description,
                aliases: player.aliases,
            });

            if (context.currentTeam?.id !== row.team.id) return null;

            return {
                id: player.id,
                slug: player.slug,
                name: player.name,
                shortName: player.shortName,
                headshotUrl: player.headshotUrl,
                nationality: player.nationality,
                shirtNumber: context.shirtNumber,
                position: context.role,
                isCaptain: context.isCaptain,
                sortOrder: null,
            };
        })
        .filter((player): player is NonNullable<typeof player> => Boolean(player))
        .sort((left, right) => left.name.localeCompare(right.name));

    const presentation = resolveEntityPresentation('team', {
        id: row.team.id,
        name: row.team.name,
        shortName: row.team.shortName,
        leagueName: row.league?.name || null,
        country: row.team.country,
        website: row.team.website,
        shortDescription: row.team.shortDescription,
        description: row.team.description,
        primaryImageUrl: row.team.crestUrl,
        heroImageUrl: row.team.heroImageUrl,
        shortDescriptionSource: row.team.shortDescriptionSource,
        descriptionSource: row.team.descriptionSource,
        primaryImageSource: row.team.crestSource,
        heroImageSource: row.team.heroImageSource,
        websiteSource: row.team.websiteSource,
    });

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
        shortDescription: presentation.shortDescription,
        description: presentation.description,
        crestUrl: presentation.primaryImageUrl,
        heroImageUrl: presentation.heroImageUrl,
        league: row.league,
        canonicalSlug: row.team.slug,
        canonicalPath: `/teams/${row.team.slug}`,
        resolvedVia: resolved.matchedVia,
        standingsRow,
        primaryStadium: row.primaryStadium,
        secondaryStadiums,
        players: [...roster, ...inferredRoster],
        recentMatches: teamRecent,
        upcomingMatches: teamUpcoming,
    }));
});

export default teamRoutes;
