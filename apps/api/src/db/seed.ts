import 'dotenv/config';
import { db } from './client';
import { sports, leagues, teams, users, venues, matches, venueEvents } from './schema';
import { hashPassword } from '../lib/auth';
import { generateUniqueSlug } from '../lib/utils';
import { eq, sql } from 'drizzle-orm';

export const CORE_SPORT_DATA = [
    { name: 'Soccer', slug: 'soccer', shortName: 'SOC', sortOrder: 1 },
    { name: 'American Football', slug: 'american-football', shortName: 'NFL', sortOrder: 2 },
    { name: 'Baseball', slug: 'baseball', shortName: 'MLB', sortOrder: 3 },
    { name: 'Basketball', slug: 'basketball', shortName: 'NBA', sortOrder: 4 },
    { name: 'Hockey', slug: 'hockey', shortName: 'NHL', sortOrder: 5 },
];

export const CORE_LEAGUE_DATA = [
    { name: 'FIFA World Cup 2026', shortName: 'WC 2026', externalId: 'WC', country: 'US/MX/CA', sortOrder: 1 },
    { name: 'Premier League', shortName: 'PL', externalId: 'PL', country: 'England', sortOrder: 2 },
    { name: 'La Liga', shortName: 'La Liga', externalId: 'PD', country: 'Spain', sortOrder: 3 },
    { name: 'Bundesliga', shortName: 'BL', externalId: 'BL1', country: 'Germany', sortOrder: 4 },
    { name: 'Serie A', shortName: 'SA', externalId: 'SA', country: 'Italy', sortOrder: 5 },
    { name: 'Ligue 1', shortName: 'L1', externalId: 'FL1', country: 'France', sortOrder: 6 },
    { name: 'Champions League', shortName: 'UCL', externalId: 'CL', country: 'Europe', sortOrder: 7 },
    { name: 'MLS', shortName: 'MLS', externalId: 'MLS', country: 'US/CA', sortOrder: 8 },
    { name: 'Liga MX', shortName: 'Liga MX', externalId: 'LMX', country: 'Mexico', sortOrder: 9 },
    { name: 'NWSL Women', shortName: 'NWSL', externalId: 'NWSL', country: 'USA', sortOrder: 10 },
];

export async function ensureSportsSeeded() {
    return db.insert(sports).values(CORE_SPORT_DATA).onConflictDoNothing().returning();
}

export async function ensureLeaguesSeeded() {
    await ensureSportsSeeded();
    const sportRows = await db.select({ id: sports.id, slug: sports.slug }).from(sports);
    const soccerSportId = sportRows.find((row) => row.slug === 'soccer')?.id;
    if (!soccerSportId) {
        throw new Error('Soccer sport row is missing');
    }

    const rows = CORE_LEAGUE_DATA.map((league) => ({
        ...league,
        sportId: soccerSportId,
    }));
    return db.insert(leagues).values(rows).onConflictDoNothing().returning();
}

export async function seedDatabase() {
    console.log('Starting database seed...\n');
    console.log('Seeding sports...');
    const insertedSports = await ensureSportsSeeded();
    console.log(`  OK: ${insertedSports.length} sports inserted\n`);

    // ─── Leagues ────────────────────────────────
    console.log('Seeding leagues...');
    const insertedLeagues = await ensureLeaguesSeeded();
    console.log(`  OK: ${insertedLeagues.length} leagues inserted\n`);

    // Get league IDs by externalId
    const allLeagues = await db.select().from(leagues);
    const leagueMap = new Map(allLeagues.map(l => [l.externalId, l.id]));

    // ─── Teams ──────────────────────────────────
    console.log('Seeding teams...');
    const teamData = [
        // World Cup teams
        { name: 'United States', shortName: 'USA', externalId: 'US', leagueId: leagueMap.get('WC') },
        { name: 'Mexico', shortName: 'MEX', externalId: 'MX', leagueId: leagueMap.get('WC') },
        { name: 'Canada', shortName: 'CAN', externalId: 'CA', leagueId: leagueMap.get('WC') },
        { name: 'Argentina', shortName: 'ARG', externalId: 'AR', leagueId: leagueMap.get('WC') },
        { name: 'Brazil', shortName: 'BRA', externalId: 'BR', leagueId: leagueMap.get('WC') },
        { name: 'France', shortName: 'FRA', externalId: 'FR', leagueId: leagueMap.get('WC') },
        { name: 'Germany', shortName: 'GER', externalId: 'DE', leagueId: leagueMap.get('WC') },
        { name: 'England', shortName: 'ENG', externalId: 'ENG', leagueId: leagueMap.get('WC') },
        { name: 'Spain', shortName: 'ESP', externalId: 'ES', leagueId: leagueMap.get('WC') },
        { name: 'Netherlands', shortName: 'NED', externalId: 'NL', leagueId: leagueMap.get('WC') },
        { name: 'Portugal', shortName: 'POR', externalId: 'PT', leagueId: leagueMap.get('WC') },
        { name: 'Japan', shortName: 'JPN', externalId: 'JP', leagueId: leagueMap.get('WC') },
        { name: 'South Korea', shortName: 'KOR', externalId: 'KR', leagueId: leagueMap.get('WC') },
        { name: 'Morocco', shortName: 'MAR', externalId: 'MA', leagueId: leagueMap.get('WC') },
        { name: 'Senegal', shortName: 'SEN', externalId: 'SN', leagueId: leagueMap.get('WC') },
        { name: 'Uruguay', shortName: 'URU', externalId: 'UY', leagueId: leagueMap.get('WC') },
        // PL clubs
        { name: 'Manchester City', shortName: 'Man City', externalId: 'MCY', leagueId: leagueMap.get('PL') },
        { name: 'Arsenal', shortName: 'Arsenal', externalId: 'ARS', leagueId: leagueMap.get('PL') },
        { name: 'Liverpool', shortName: 'Liverpool', externalId: 'LIV', leagueId: leagueMap.get('PL') },
        { name: 'Chelsea', shortName: 'Chelsea', externalId: 'CHE', leagueId: leagueMap.get('PL') },
        { name: 'Manchester United', shortName: 'Man Utd', externalId: 'MUN', leagueId: leagueMap.get('PL') },
        { name: 'Tottenham Hotspur', shortName: 'Spurs', externalId: 'TOT', leagueId: leagueMap.get('PL') },
        // La Liga clubs
        { name: 'Real Madrid', shortName: 'R. Madrid', externalId: 'RMA', leagueId: leagueMap.get('PD') },
        { name: 'FC Barcelona', shortName: 'Barcelona', externalId: 'FCB', leagueId: leagueMap.get('PD') },
        { name: 'Atlético Madrid', shortName: 'Atlético', externalId: 'ATM', leagueId: leagueMap.get('PD') },
        // MLS clubs
        { name: 'Houston Dynamo FC', shortName: 'Dynamo', externalId: 'HOU', leagueId: leagueMap.get('MLS') },
        { name: 'Inter Miami CF', shortName: 'Inter Miami', externalId: 'MIA', leagueId: leagueMap.get('MLS') },
        { name: 'LA Galaxy', shortName: 'Galaxy', externalId: 'LAG', leagueId: leagueMap.get('MLS') },
        { name: 'LAFC', shortName: 'LAFC', externalId: 'LAFC', leagueId: leagueMap.get('MLS') },
    ];

    const insertedTeams = await db.insert(teams).values(teamData).onConflictDoNothing().returning();
    console.log(`  OK: ${insertedTeams.length} teams inserted\n`);

    // Get all teams for match creation
    const allTeams = await db.select().from(teams);
    const teamMap = new Map(allTeams.map(t => [t.externalId, t]));

    // ─── Admin User ─────────────────────────────
    console.log('Seeding admin user...');
    const adminHash = await hashPassword('Admin@12345');
    const [admin] = await db.insert(users).values({
        email: 'admin@matchwatch.us',
        passwordHash: adminHash,
        name: 'MatchWatch Admin',
        role: 'SUPER_ADMIN',
        emailVerified: true,
    }).onConflictDoNothing().returning();
    const adminUser = admin || (await db.select({ id: users.id }).from(users).where(eq(users.email, 'admin@matchwatch.us')).limit(1))[0];

    // ─── Demo User ──────────────────────────────
    console.log('Seeding demo user...');
    const demoHash = await hashPassword('Demo@12345');
    const [demoUser] = await db.insert(users).values({
        email: 'demo@matchwatch.us',
        passwordHash: demoHash,
        name: 'Demo User',
        role: 'USER',
        emailVerified: true,
    }).onConflictDoNothing().returning();

    // ─── Demo Venue Owner ───────────────────────
    console.log('Seeding demo business owner...');
    const venueOwnerHash = await hashPassword('VenueOwner@12345');
    const [venueOwner] = await db.insert(users).values({
        email: 'owner@matchwatch.us',
        passwordHash: venueOwnerHash,
        name: 'Business Owner',
        role: 'BUSINESS',
        emailVerified: true,
    }).onConflictDoNothing().returning();
    const resolvedVenueOwner = venueOwner || (await db.select({ id: users.id }).from(users).where(eq(users.email, 'owner@matchwatch.us')).limit(1))[0];
    const venueOwnerId = resolvedVenueOwner?.id || adminUser?.id;
    if (!venueOwnerId) {
        throw new Error('Seed users are missing; cannot create demo venues');
    }

    // ─── Demo Venues ────────────────────────────
    console.log('Seeding demo venues...');

    const venueData = [
        {
            ownerId: venueOwnerId,
            name: 'The Pitch Sports Bar',
            slug: generateUniqueSlug('The Pitch Sports Bar'),
            description: 'Houston\'s premier football watch party destination with 20 screens, craft beer, and international cuisine.',
            shortDescription: 'Premier sports bar with 20+ screens & craft beer',
            addressLine1: '1234 Downtown Ave',
            city: 'Houston',
            stateProvince: 'Texas',
            country: 'US',
            postalCode: '77002',
            lat: '29.7604',
            lng: '-95.3698',
            timezone: 'America/Chicago',
            phone: '+1-713-555-0101',
            capacity: 200,
            amenities: ['TV', 'PROJECTOR', 'WIFI', 'FOOD', 'PARKING', 'ALCOHOLIC'],
            vibes: ['GAME_DAY', 'LIVELY'],
            cuisineTags: ['AMERICAN', 'BBQ'],
            priceRange: 'MID' as const,
            isVerified: true,
            isFeatured: true,
        },
        {
            ownerId: venueOwnerId,
            name: 'Mediterranean Lounge',
            slug: generateUniqueSlug('Mediterranean Lounge'),
            description: 'Cozy Mediterranean-themed lounge with hookahs, outdoor seating, and the best hummus in town.',
            shortDescription: 'Cozy Mediterranean lounge with hookah & outdoor seating',
            addressLine1: '456 Midtown Blvd',
            city: 'Houston',
            stateProvince: 'Texas',
            country: 'US',
            postalCode: '77006',
            lat: '29.7398',
            lng: '-95.3891',
            timezone: 'America/Chicago',
            phone: '+1-713-555-0202',
            capacity: 80,
            amenities: ['TV', 'HOOKAH', 'OUTDOOR', 'WIFI', 'FOOD'],
            vibes: ['CASUAL', 'NEIGHBORHOOD'],
            cuisineTags: ['MIDDLE_EASTERN', 'MEDITERRANEAN'],
            priceRange: 'MID' as const,
            isVerified: true,
            isFeatured: true,
        },
        {
            ownerId: venueOwnerId,
            name: 'Casa Fútbol',
            slug: generateUniqueSlug('Casa Fútbol'),
            description: 'Authentic Mexican sports cantina with massive projectors, tacos, and margaritas for the best match day atmosphere.',
            shortDescription: 'Mexican sports cantina with big screens & tacos',
            addressLine1: '789 Heights St',
            city: 'Houston',
            stateProvince: 'Texas',
            country: 'US',
            postalCode: '77008',
            lat: '29.7932',
            lng: '-95.3972',
            timezone: 'America/Chicago',
            phone: '+1-713-555-0303',
            capacity: 150,
            amenities: ['TV', 'PROJECTOR', 'FOOD', 'ALCOHOLIC', 'KIDS', 'PARKING'],
            vibes: ['FAMILY_FRIENDLY', 'GAME_DAY'],
            cuisineTags: ['MEXICAN', 'AMERICAN'],
            priceRange: 'BUDGET' as const,
            isVerified: true,
            isFeatured: false,
        },
        {
            ownerId: venueOwnerId,
            name: 'VIP Skybox',
            slug: generateUniqueSlug('VIP Skybox'),
            description: 'Premium watching experience with private rooms, luxury seating, premium drinks, and personal service.',
            shortDescription: 'Luxury private viewing with premium service',
            addressLine1: '100 Galleria Way',
            city: 'Houston',
            stateProvince: 'Texas',
            country: 'US',
            postalCode: '77056',
            lat: '29.7606',
            lng: '-95.4613',
            timezone: 'America/Chicago',
            phone: '+1-713-555-0404',
            capacity: 40,
            amenities: ['TV', 'VIP', 'WIFI', 'FOOD', 'ALCOHOLIC', 'PRIVATE_ROOM'],
            vibes: ['LUXURY', 'UPSCALE'],
            cuisineTags: ['FRENCH', 'SEAFOOD'],
            priceRange: 'LUXURY' as const,
            isVerified: true,
            isFeatured: true,
        },
    ];

    const insertedVenues = await db.insert(venues).values(venueData).onConflictDoNothing().returning();
    console.log(`  OK: ${insertedVenues.length} venues inserted\n`);

    // ─── Demo Matches ───────────────────────────
    console.log('Seeding demo matches...');

    const usTeam = teamMap.get('US');
    const mxTeam = teamMap.get('MX');
    const argTeam = teamMap.get('AR');
    const braTeam = teamMap.get('BR');
    const engTeam = teamMap.get('ENG');
    const fraTeam = teamMap.get('FR');
    const gerTeam = teamMap.get('DE');
    const espTeam = teamMap.get('ES');
    const jupTeam = teamMap.get('JP');
    const wcLeagueId = leagueMap.get('WC');

    const now = new Date();
    const matchData = [
        {
            leagueId: wcLeagueId,
            homeTeamId: usTeam?.id, awayTeamId: mxTeam?.id,
            homeTeamName: 'United States', awayTeamName: 'Mexico',
            matchDateUtc: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
            status: 'SCHEDULED' as const,
            stage: 'Group A', matchDay: 1,
            venueName: 'NRG Stadium, Houston',
        },
        {
            leagueId: wcLeagueId,
            homeTeamId: argTeam?.id, awayTeamId: braTeam?.id,
            homeTeamName: 'Argentina', awayTeamName: 'Brazil',
            matchDateUtc: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
            status: 'SCHEDULED' as const,
            stage: 'Group B', matchDay: 1,
            venueName: 'AT&T Stadium, Dallas',
        },
        {
            leagueId: wcLeagueId,
            homeTeamId: engTeam?.id, awayTeamId: fraTeam?.id,
            homeTeamName: 'England', awayTeamName: 'France',
            matchDateUtc: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
            status: 'SCHEDULED' as const,
            stage: 'Group C', matchDay: 1,
            venueName: 'MetLife Stadium, New York',
        },
        {
            leagueId: wcLeagueId,
            homeTeamId: gerTeam?.id, awayTeamId: espTeam?.id,
            homeTeamName: 'Germany', awayTeamName: 'Spain',
            matchDateUtc: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
            status: 'SCHEDULED' as const,
            stage: 'Group D', matchDay: 1,
            venueName: 'SoFi Stadium, Los Angeles',
        },
        {
            leagueId: wcLeagueId,
            homeTeamId: usTeam?.id, awayTeamId: jupTeam?.id,
            homeTeamName: 'United States', awayTeamName: 'Japan',
            matchDateUtc: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
            status: 'FINISHED' as const,
            homeScore: 2, awayScore: 1,
            stage: 'Group A', matchDay: 2,
            venueName: 'NRG Stadium, Houston',
        },
    ];

    const insertedMatches = await db.insert(matches).values(matchData).onConflictDoNothing().returning();
    console.log(`  OK: ${insertedMatches.length} matches inserted\n`);

    // ─── Venue Events ───────────────────────────
    console.log('Seeding venue events...');

    if (insertedVenues.length > 0 && insertedMatches.length > 0) {
        const eventData = [];
        for (const match of insertedMatches.filter(m => m.status === 'SCHEDULED')) {
            for (const venue of insertedVenues) {
                eventData.push({
                    venueId: venue.id,
                    matchId: match.id,
                    bookingLimit: venue.capacity ? Math.floor(venue.capacity * 0.8) : null,
                    specialNotes: `Watch party for ${match.homeTeamName} vs ${match.awayTeamName}!`,
                    customPrice: venue.priceRange === 'LUXURY' ? '25.00' : venue.priceRange === 'UPSCALE' ? '15.00' : null,
                });
            }
        }

        const insertedEvents = await db.insert(venueEvents).values(eventData).onConflictDoNothing().returning();
        console.log(`  OK: ${insertedEvents.length} venue events inserted\n`);
    }

    console.log('Seed completed\n');
    console.log('Demo accounts:');
    console.log('  Admin:       admin@matchwatch.us / Admin@12345');
    console.log('  User:        demo@matchwatch.us / Demo@12345');
    console.log('  Business:    owner@matchwatch.us / VenueOwner@12345');

}

if (process.argv[1]?.includes('seed.ts') || process.argv[1]?.includes('seed.js')) {
    seedDatabase()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error('Seed failed:', err);
            process.exit(1);
        });
}
