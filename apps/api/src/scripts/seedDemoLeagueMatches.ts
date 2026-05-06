import 'dotenv/config';
import { inArray } from 'drizzle-orm';
import { db } from '../db/client';
import { leagues, matches, teams, venueEvents, venues } from '../db/schema';

type DemoFixture = {
    externalMatchId: string;
    leagueExternalId: string;
    homeExternalId: string;
    awayExternalId: string;
    homeTeamName: string;
    awayTeamName: string;
    matchDay: number;
    stage: string;
    venueName: string;
    startsInHours: number;
};

const DEMO_FIXTURES: DemoFixture[] = [
    {
        externalMatchId: 'demo-pl-ars-liv',
        leagueExternalId: 'PL',
        homeExternalId: 'ARS',
        awayExternalId: 'LIV',
        homeTeamName: 'Arsenal',
        awayTeamName: 'Liverpool',
        matchDay: 34,
        stage: 'League',
        venueName: 'Emirates Stadium, London',
        startsInHours: 2,
    },
    {
        externalMatchId: 'demo-pd-rma-fcb',
        leagueExternalId: 'PD',
        homeExternalId: 'RMA',
        awayExternalId: 'FCB',
        homeTeamName: 'Real Madrid',
        awayTeamName: 'FC Barcelona',
        matchDay: 33,
        stage: 'League',
        venueName: 'Santiago Bernabeu, Madrid',
        startsInHours: 4,
    },
    {
        externalMatchId: 'demo-sa-int-mil',
        leagueExternalId: 'SA',
        homeExternalId: 'INT',
        awayExternalId: 'MIL',
        homeTeamName: 'Inter',
        awayTeamName: 'AC Milan',
        matchDay: 33,
        stage: 'League',
        venueName: 'San Siro, Milan',
        startsInHours: 6,
    },
    {
        externalMatchId: 'demo-cl-mci-rma',
        leagueExternalId: 'CL',
        homeExternalId: 'MCY',
        awayExternalId: 'RMA',
        homeTeamName: 'Manchester City',
        awayTeamName: 'Real Madrid',
        matchDay: 1,
        stage: 'Semi Final',
        venueName: 'Etihad Stadium, Manchester',
        startsInHours: 20,
    },
    {
        externalMatchId: 'demo-mls-hou-mia',
        leagueExternalId: 'MLS',
        homeExternalId: 'HOU',
        awayExternalId: 'MIA',
        homeTeamName: 'Houston Dynamo FC',
        awayTeamName: 'Inter Miami CF',
        matchDay: 11,
        stage: 'Regular Season',
        venueName: 'Shell Energy Stadium, Houston',
        startsInHours: 24,
    },
    {
        externalMatchId: 'demo-mls-lafc-lag',
        leagueExternalId: 'MLS',
        homeExternalId: 'LAFC',
        awayExternalId: 'LAG',
        homeTeamName: 'LAFC',
        awayTeamName: 'LA Galaxy',
        matchDay: 11,
        stage: 'Regular Season',
        venueName: 'BMO Stadium, Los Angeles',
        startsInHours: 30,
    },
];

const DEMO_TEAMS = [
    { externalId: 'INT', leagueExternalId: 'SA', name: 'Inter', shortName: 'Inter', teamType: 'club' as const },
    { externalId: 'MIL', leagueExternalId: 'SA', name: 'AC Milan', shortName: 'AC Milan', teamType: 'club' as const },
];

function kickoffFromNow(hours: number) {
    const now = new Date();
    const kickoff = new Date(now.getTime() + hours * 60 * 60 * 1000);
    kickoff.setUTCMinutes(0, 0, 0);
    return kickoff;
}

async function seedDemoLeagueMatches() {
    console.log('Seeding demo league matches...');

    const leagueRows = await db.select({
        id: leagues.id,
        externalId: leagues.externalId,
    }).from(leagues);

    const teamRows = await db.select({
        id: teams.id,
        externalId: teams.externalId,
        name: teams.name,
    }).from(teams);

    const venueRows = await db.select({
        id: venues.id,
        name: venues.name,
        capacity: venues.capacity,
        priceRange: venues.priceRange,
    }).from(venues);

    const leagueIdByExternalId = new Map(leagueRows.map((row) => [row.externalId, row.id]));

    if (DEMO_TEAMS.length > 0) {
        const missingTeams = DEMO_TEAMS
            .filter((team) => !teamRows.some((row) => row.externalId === team.externalId))
            .map((team) => {
                const leagueId = leagueIdByExternalId.get(team.leagueExternalId);
                if (!leagueId) {
                    throw new Error(`Missing league dependency for ${team.externalId}`);
                }

                return {
                    externalId: team.externalId,
                    leagueId,
                    name: team.name,
                    shortName: team.shortName,
                    slug: team.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
                    teamType: team.teamType,
                    isActive: true,
                };
            });

        if (missingTeams.length > 0) {
            await db.insert(teams)
                .values(missingTeams)
                .onConflictDoNothing({ target: teams.externalId });
        }
    }

    const refreshedTeamRows = await db.select({
        id: teams.id,
        externalId: teams.externalId,
        name: teams.name,
    }).from(teams);
    const teamByExternalId = new Map(refreshedTeamRows.map((row) => [row.externalId, row]));

    const matchValues = DEMO_FIXTURES.map((fixture) => {
        const leagueId = leagueIdByExternalId.get(fixture.leagueExternalId);
        const homeTeam = teamByExternalId.get(fixture.homeExternalId);
        const awayTeam = teamByExternalId.get(fixture.awayExternalId);

        if (!leagueId || !homeTeam || !awayTeam) {
            throw new Error(`Missing seed dependency for ${fixture.externalMatchId}`);
        }

        return {
            externalMatchId: fixture.externalMatchId,
            leagueId,
            homeTeamId: homeTeam.id,
            awayTeamId: awayTeam.id,
            homeTeamName: fixture.homeTeamName,
            awayTeamName: fixture.awayTeamName,
            matchDateUtc: kickoffFromNow(fixture.startsInHours),
            status: 'SCHEDULED' as const,
            matchDay: fixture.matchDay,
            stage: fixture.stage,
            venueName: fixture.venueName,
        };
    });

    await db.insert(matches)
        .values(matchValues)
        .onConflictDoNothing({ target: matches.externalMatchId });

    const seededMatches = await db.select({
        id: matches.id,
        externalMatchId: matches.externalMatchId,
        homeTeamName: matches.homeTeamName,
        awayTeamName: matches.awayTeamName,
        status: matches.status,
    })
        .from(matches)
        .where(inArray(matches.externalMatchId, DEMO_FIXTURES.map((fixture) => fixture.externalMatchId)));

    const eventValues = seededMatches
        .filter((match) => match.status === 'SCHEDULED')
        .flatMap((match) => venueRows.map((venue) => ({
            venueId: venue.id,
            matchId: match.id,
            bookingLimit: venue.capacity ? Math.floor(venue.capacity * 0.8) : null,
            specialNotes: `Watch party for ${match.homeTeamName} vs ${match.awayTeamName}!`,
            customPrice: venue.priceRange === 'LUXURY' ? '25.00' : venue.priceRange === 'UPSCALE' ? '15.00' : null,
        })));

    if (eventValues.length > 0) {
        await db.insert(venueEvents)
            .values(eventValues)
            .onConflictDoNothing({ target: [venueEvents.venueId, venueEvents.matchId] });
    }

    console.log(`  OK: ${seededMatches.length} demo league matches available`);
    console.log(`  OK: ${eventValues.length} venue-event links ensured`);
}

if (process.argv[1]?.includes('seedDemoLeagueMatches')) {
    seedDemoLeagueMatches()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('Demo league seed failed:', error);
            process.exit(1);
        });
}

export { seedDemoLeagueMatches };
