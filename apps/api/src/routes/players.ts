import { Hono } from 'hono';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { leagues, matchParticipants, matches, players, sports, teamRosterMembers, teams } from '../db/schema';
import { resolveCanonicalEntity } from '../lib/entitySlugs';
import { resolveEntityPresentation } from '../lib/entityEnrichment';
import { resolvePlayerContext } from '../lib/playerContext';
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

    const [participantRows, rosterMembershipRows, leagueTeamRows] = await Promise.all([
        db
            .select({
                participant: matchParticipants,
                match: matches,
            })
            .from(matchParticipants)
            .innerJoin(matches, eq(matchParticipants.matchId, matches.id))
            .where(eq(matchParticipants.playerId, row.player.id))
            .orderBy(desc(matches.matchDateUtc))
            .limit(20),
        db
            .select({
                teamId: teamRosterMembers.teamId,
                position: teamRosterMembers.position,
                shirtNumber: teamRosterMembers.shirtNumber,
                isCaptain: teamRosterMembers.isCaptain,
                sortOrder: teamRosterMembers.sortOrder,
                teamName: teams.name,
                teamSlug: teams.slug,
                teamShortName: teams.shortName,
                teamCrestUrl: teams.crestUrl,
                teamLeagueId: teams.leagueId,
                teamAliases: teams.aliases,
                teamExternalId: teams.externalId,
                teamHeroImageUrl: teams.heroImageUrl,
                teamShortDescription: teams.shortDescription,
                teamDescription: teams.description,
            })
            .from(teamRosterMembers)
            .innerJoin(teams, eq(teamRosterMembers.teamId, teams.id))
            .where(and(
                eq(teamRosterMembers.playerId, row.player.id),
                eq(teamRosterMembers.isActive, true),
                eq(teams.isActive, true),
            ))
            .orderBy(teamRosterMembers.sortOrder, teams.name),
        row.player.leagueId
            ? db
                .select({
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
                })
                .from(teams)
                .where(and(eq(teams.leagueId, row.player.leagueId), eq(teams.isActive, true)))
                .orderBy(teams.name)
            : Promise.resolve([]),
    ]);

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

    const context = resolvePlayerContext({
        currentLeagueId: row.player.leagueId,
        availableTeams: leagueTeamRows,
        rosterMemberships: rosterMembershipRows.map((membership) => ({
            team: {
                id: membership.teamId,
                name: membership.teamName,
                slug: membership.teamSlug,
                shortName: membership.teamShortName,
                crestUrl: membership.teamCrestUrl,
                leagueId: membership.teamLeagueId,
                aliases: membership.teamAliases,
                externalId: membership.teamExternalId,
                heroImageUrl: membership.teamHeroImageUrl,
                shortDescription: membership.teamShortDescription,
                description: membership.teamDescription,
            },
            position: membership.position,
            shirtNumber: membership.shirtNumber,
            isCaptain: membership.isCaptain,
            sortOrder: membership.sortOrder,
        })),
        shortDescription: row.player.shortDescription,
        description: row.player.description,
        aliases: row.player.aliases,
    });

    const presentation = resolveEntityPresentation('player', {
        id: row.player.id,
        name: row.player.name,
        shortName: row.player.shortName,
        sportName: row.sport?.name || null,
        leagueName: row.league?.name || null,
        teamName: context.currentTeam?.name || null,
        role: context.role || null,
        country: row.player.nationality,
        nationality: row.player.nationality,
        website: row.player.website,
        shortDescription: row.player.shortDescription,
        description: row.player.description,
        primaryImageUrl: row.player.headshotUrl,
        heroImageUrl: row.player.heroImageUrl,
        shortDescriptionSource: row.player.shortDescriptionSource,
        descriptionSource: row.player.descriptionSource,
        primaryImageSource: row.player.headshotSource,
        heroImageSource: row.player.heroImageSource,
        websiteSource: row.player.websiteSource,
    });

    return c.json(apiResponse({
        ...row.player,
        shortDescription: presentation.shortDescription,
        description: presentation.description,
        headshotUrl: presentation.primaryImageUrl,
        heroImageUrl: presentation.heroImageUrl,
        sport: row.sport,
        league: row.league,
        currentTeam: context.currentTeam ? {
            id: context.currentTeam.id,
            name: context.currentTeam.name,
            slug: context.currentTeam.slug,
            shortName: context.currentTeam.shortName || null,
            crestUrl: context.currentTeam.crestUrl || null,
        } : null,
        role: context.role,
        shirtNumber: context.shirtNumber,
        isCaptain: context.isCaptain,
        profileContextSource: context.source,
        canonicalSlug: row.player.slug,
        canonicalPath: `/players/${row.player.slug}`,
        resolvedVia: resolved.matchedVia,
        matches: appearances,
        recentMatches,
        upcomingMatches,
    }));
});

export default playerRoutes;
