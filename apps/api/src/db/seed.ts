import 'dotenv/config';
import { db } from './client';
import { sports, leagues, teams, countries, competitionTeams, users, venues, matches, venueEvents } from './schema';
import { hashPassword } from '../lib/auth';
import { generateUniqueSlug } from '../lib/utils';
import { eq, sql } from 'drizzle-orm';

export const CORE_SPORT_DATA = [
    { name: 'Soccer', slug: 'soccer', shortName: 'SOC', sortOrder: 1 },
    { name: 'American Football', slug: 'american-football', shortName: 'NFL', sortOrder: 2 },
    { name: 'Baseball', slug: 'baseball', shortName: 'MLB', sortOrder: 3 },
    { name: 'Basketball', slug: 'basketball', shortName: 'NBA', sortOrder: 4 },
    { name: 'Hockey', slug: 'hockey', shortName: 'NHL', sortOrder: 5 },
    { name: 'Motorsport', slug: 'motorsport', shortName: 'RACE', sortOrder: 6 },
];

export const CORE_LEAGUE_DATA = [
    { sportSlug: 'soccer', name: 'FIFA World Cup 2026', shortName: 'WC 2026', externalId: 'WC', country: 'US/MX/CA', sortOrder: 1 },
    { sportSlug: 'soccer', name: 'Premier League', shortName: 'PL', externalId: 'PL', country: 'England', sortOrder: 2 },
    { sportSlug: 'soccer', name: 'La Liga', shortName: 'La Liga', externalId: 'PD', country: 'Spain', sortOrder: 3 },
    { sportSlug: 'soccer', name: 'Bundesliga', shortName: 'BL', externalId: 'BL1', country: 'Germany', sortOrder: 4 },
    { sportSlug: 'soccer', name: 'Serie A', shortName: 'SA', externalId: 'SA', country: 'Italy', sortOrder: 5 },
    { sportSlug: 'soccer', name: 'Ligue 1', shortName: 'L1', externalId: 'FL1', country: 'France', sortOrder: 6 },
    { sportSlug: 'soccer', name: 'Champions League', shortName: 'UCL', externalId: 'CL', country: 'Europe', sortOrder: 7 },
    { sportSlug: 'soccer', name: 'MLS', shortName: 'MLS', externalId: 'MLS', country: 'US/CA', sortOrder: 8 },
    { sportSlug: 'soccer', name: 'Liga MX', shortName: 'Liga MX', externalId: 'LMX', country: 'Mexico', sortOrder: 9 },
    { sportSlug: 'soccer', name: 'NWSL Women', shortName: 'NWSL', externalId: 'NWSL', country: 'USA', sortOrder: 10 },
    { sportSlug: 'soccer', name: 'International Friendlies', shortName: 'INTL', externalId: 'INTL', country: 'Worldwide', sortOrder: 11 },
    { sportSlug: 'american-football', name: 'NFL', shortName: 'NFL', externalId: 'NFL', country: 'USA', sortOrder: 1 },
    { sportSlug: 'baseball', name: 'MLB', shortName: 'MLB', externalId: 'MLB', country: 'USA', sortOrder: 1 },
    { sportSlug: 'basketball', name: 'NBA', shortName: 'NBA', externalId: 'NBA', country: 'USA', sortOrder: 1 },
    { sportSlug: 'hockey', name: 'NHL', shortName: 'NHL', externalId: 'NHL', country: 'USA/Canada', sortOrder: 1 },
    { sportSlug: 'motorsport', name: 'NASCAR Cup Series', shortName: 'NASCAR', externalId: 'NASCAR', country: 'USA', sortOrder: 1 },
    { sportSlug: 'motorsport', name: 'IndyCar Series', shortName: 'IndyCar', externalId: 'INDYCAR', country: 'USA', sortOrder: 2 },
    { sportSlug: 'motorsport', name: 'Formula 1', shortName: 'F1', externalId: 'F1', country: 'Worldwide', sortOrder: 3 },
];

export async function ensureSportsSeeded() {
    return db.insert(sports).values(CORE_SPORT_DATA).onConflictDoNothing().returning();
}

export async function ensureLeaguesSeeded() {
    await ensureSportsSeeded();
    const sportRows = await db.select({ id: sports.id, slug: sports.slug }).from(sports);
    const sportIdBySlug = new Map(sportRows.map((row) => [row.slug, row.id]));
    const rows = CORE_LEAGUE_DATA.map((league) => {
        const sportId = sportIdBySlug.get(league.sportSlug);
        if (!sportId) {
            throw new Error(`Sport row is missing for ${league.sportSlug}`);
        }
        return {
            name: league.name,
            slug: generateUniqueSlug(league.name),
            shortName: league.shortName,
            externalId: league.externalId,
            country: league.country,
            sortOrder: league.sortOrder,
            sportId,
        };
    });
    return db.insert(leagues).values(rows).onConflictDoNothing().returning();
}

// ─── WC 2026 Countries ──────────────────────────

export const WC2026_COUNTRIES = [
    // CONCACAF hosts + Americas
    { name: 'United States',   iso2: 'US',  iso3: 'USA', fifaCode: 'USA', iocCode: 'USA', flagEmoji: '🇺🇸' },
    { name: 'Mexico',          iso2: 'MX',  iso3: 'MEX', fifaCode: 'MEX', iocCode: 'MEX', flagEmoji: '🇲🇽' },
    { name: 'Canada',          iso2: 'CA',  iso3: 'CAN', fifaCode: 'CAN', iocCode: 'CAN', flagEmoji: '🇨🇦' },
    { name: 'Argentina',       iso2: 'AR',  iso3: 'ARG', fifaCode: 'ARG', iocCode: 'ARG', flagEmoji: '🇦🇷' },
    { name: 'Brazil',          iso2: 'BR',  iso3: 'BRA', fifaCode: 'BRA', iocCode: 'BRA', flagEmoji: '🇧🇷' },
    { name: 'Uruguay',         iso2: 'UY',  iso3: 'URY', fifaCode: 'URU', iocCode: 'URU', flagEmoji: '🇺🇾' },
    { name: 'Colombia',        iso2: 'CO',  iso3: 'COL', fifaCode: 'COL', iocCode: 'COL', flagEmoji: '🇨🇴' },
    { name: 'Ecuador',         iso2: 'EC',  iso3: 'ECU', fifaCode: 'ECU', iocCode: 'ECU', flagEmoji: '🇪🇨' },
    { name: 'Venezuela',       iso2: 'VE',  iso3: 'VEN', fifaCode: 'VEN', iocCode: 'VEN', flagEmoji: '🇻🇪' },
    { name: 'Chile',           iso2: 'CL',  iso3: 'CHL', fifaCode: 'CHI', iocCode: 'CHI', flagEmoji: '🇨🇱' },
    { name: 'Panama',          iso2: 'PA',  iso3: 'PAN', fifaCode: 'PAN', iocCode: 'PAN', flagEmoji: '🇵🇦' },
    { name: 'Costa Rica',      iso2: 'CR',  iso3: 'CRI', fifaCode: 'CRC', iocCode: 'CRC', flagEmoji: '🇨🇷' },
    { name: 'Honduras',        iso2: 'HN',  iso3: 'HND', fifaCode: 'HON', iocCode: 'HON', flagEmoji: '🇭🇳' },
    // UEFA
    { name: 'France',          iso2: 'FR',  iso3: 'FRA', fifaCode: 'FRA', iocCode: 'FRA', flagEmoji: '🇫🇷' },
    { name: 'England',         iso2: 'GB',  iso3: 'GBR', fifaCode: 'ENG', iocCode: null,  flagEmoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
    { name: 'Spain',           iso2: 'ES',  iso3: 'ESP', fifaCode: 'ESP', iocCode: 'ESP', flagEmoji: '🇪🇸' },
    { name: 'Germany',         iso2: 'DE',  iso3: 'DEU', fifaCode: 'GER', iocCode: 'GER', flagEmoji: '🇩🇪' },
    { name: 'Portugal',        iso2: 'PT',  iso3: 'PRT', fifaCode: 'POR', iocCode: 'POR', flagEmoji: '🇵🇹' },
    { name: 'Netherlands',     iso2: 'NL',  iso3: 'NLD', fifaCode: 'NED', iocCode: 'NED', flagEmoji: '🇳🇱' },
    { name: 'Italy',           iso2: 'IT',  iso3: 'ITA', fifaCode: 'ITA', iocCode: 'ITA', flagEmoji: '🇮🇹' },
    { name: 'Belgium',         iso2: 'BE',  iso3: 'BEL', fifaCode: 'BEL', iocCode: 'BEL', flagEmoji: '🇧🇪' },
    { name: 'Switzerland',     iso2: 'CH',  iso3: 'CHE', fifaCode: 'SUI', iocCode: 'SUI', flagEmoji: '🇨🇭' },
    { name: 'Austria',         iso2: 'AT',  iso3: 'AUT', fifaCode: 'AUT', iocCode: 'AUT', flagEmoji: '🇦🇹' },
    { name: 'Denmark',         iso2: 'DK',  iso3: 'DNK', fifaCode: 'DEN', iocCode: 'DEN', flagEmoji: '🇩🇰' },
    { name: 'Croatia',         iso2: 'HR',  iso3: 'HRV', fifaCode: 'CRO', iocCode: 'CRO', flagEmoji: '🇭🇷' },
    { name: 'Serbia',          iso2: 'RS',  iso3: 'SRB', fifaCode: 'SRB', iocCode: 'SRB', flagEmoji: '🇷🇸' },
    { name: 'Hungary',         iso2: 'HU',  iso3: 'HUN', fifaCode: 'HUN', iocCode: 'HUN', flagEmoji: '🇭🇺' },
    { name: 'Scotland',        iso2: 'SC',  iso3: 'SCO', fifaCode: 'SCO', iocCode: null,  flagEmoji: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
    { name: 'Slovakia',        iso2: 'SK',  iso3: 'SVK', fifaCode: 'SVK', iocCode: 'SVK', flagEmoji: '🇸🇰' },
    // CAF
    { name: 'Morocco',         iso2: 'MA',  iso3: 'MAR', fifaCode: 'MAR', iocCode: 'MAR', flagEmoji: '🇲🇦' },
    { name: 'Senegal',         iso2: 'SN',  iso3: 'SEN', fifaCode: 'SEN', iocCode: 'SEN', flagEmoji: '🇸🇳' },
    { name: 'Egypt',           iso2: 'EG',  iso3: 'EGY', fifaCode: 'EGY', iocCode: 'EGY', flagEmoji: '🇪🇬' },
    { name: 'Nigeria',         iso2: 'NG',  iso3: 'NGA', fifaCode: 'NGA', iocCode: 'NGR', flagEmoji: '🇳🇬' },
    { name: 'South Africa',    iso2: 'ZA',  iso3: 'ZAF', fifaCode: 'RSA', iocCode: 'RSA', flagEmoji: '🇿🇦' },
    { name: 'Cameroon',        iso2: 'CM',  iso3: 'CMR', fifaCode: 'CMR', iocCode: 'CMR', flagEmoji: '🇨🇲' },
    { name: 'Algeria',         iso2: 'DZ',  iso3: 'DZA', fifaCode: 'ALG', iocCode: 'ALG', flagEmoji: '🇩🇿' },
    { name: 'Mali',            iso2: 'ML',  iso3: 'MLI', fifaCode: 'MLI', iocCode: 'MLI', flagEmoji: '🇲🇱' },
    { name: 'Tunisia',         iso2: 'TN',  iso3: 'TUN', fifaCode: 'TUN', iocCode: 'TUN', flagEmoji: '🇹🇳' },
    { name: 'Ghana',           iso2: 'GH',  iso3: 'GHA', fifaCode: 'GHA', iocCode: 'GHA', flagEmoji: '🇬🇭' },
    // AFC
    { name: 'Japan',           iso2: 'JP',  iso3: 'JPN', fifaCode: 'JPN', iocCode: 'JPN', flagEmoji: '🇯🇵' },
    { name: 'South Korea',     iso2: 'KR',  iso3: 'KOR', fifaCode: 'KOR', iocCode: 'KOR', flagEmoji: '🇰🇷' },
    { name: 'Australia',       iso2: 'AU',  iso3: 'AUS', fifaCode: 'AUS', iocCode: 'AUS', flagEmoji: '🇦🇺' },
    { name: 'Iran',            iso2: 'IR',  iso3: 'IRN', fifaCode: 'IRN', iocCode: 'IRI', flagEmoji: '🇮🇷' },
    { name: 'Saudi Arabia',    iso2: 'SA',  iso3: 'SAU', fifaCode: 'KSA', iocCode: 'KSA', flagEmoji: '🇸🇦' },
    { name: 'Qatar',           iso2: 'QA',  iso3: 'QAT', fifaCode: 'QAT', iocCode: 'QAT', flagEmoji: '🇶🇦' },
    { name: 'Uzbekistan',      iso2: 'UZ',  iso3: 'UZB', fifaCode: 'UZB', iocCode: 'UZB', flagEmoji: '🇺🇿' },
    { name: 'Jordan',          iso2: 'JO',  iso3: 'JOR', fifaCode: 'JOR', iocCode: 'JOR', flagEmoji: '🇯🇴' },
    // OFC
    { name: 'New Zealand',     iso2: 'NZ',  iso3: 'NZL', fifaCode: 'NZL', iocCode: 'NZL', flagEmoji: '🇳🇿' },
];

// iso2 → group assignment for WC2026
export const WC2026_GROUP_ASSIGNMENTS: Record<string, string> = {
    US: 'A', GB: 'A', DZ: 'A', JO: 'A',
    MX: 'B', AR: 'B', MA: 'B', NZ: 'B',
    CA: 'C', BR: 'C', BE: 'C', PA: 'C',
    FR: 'D', KR: 'D', UY: 'D', HN: 'D',
    DE: 'E', JP: 'E', ZA: 'E', CR: 'E',
    ES: 'F', AU: 'F', CO: 'F', TN: 'F',
    PT: 'G', NL: 'G', SN: 'G', GH: 'G',
    IT: 'H', EG: 'H', EC: 'H', RS: 'H',
    HR: 'I', IR: 'I', VE: 'I', SK: 'I',
    CH: 'J', NG: 'J', CL: 'J', ML: 'J',
    HU: 'K', CM: 'K', SA: 'K', UZ: 'K',
    SC: 'L', QA: 'L', DK: 'L', AT: 'L',
};

export async function ensureCountriesSeeded() {
    const rows = WC2026_COUNTRIES.map((c) => ({
        ...c,
        flagSvgUrl: `https://flagcdn.com/${c.iso2.toLowerCase()}.svg`,
    }));
    return db.insert(countries).values(rows).onConflictDoNothing().returning();
}

export async function seedWorldCup2026() {
    await ensureCountriesSeeded();
    await ensureLeaguesSeeded();

    const allCountries = await db.select({ id: countries.id, iso2: countries.iso2 }).from(countries);
    const countryByIso2 = new Map(allCountries.map((c) => [c.iso2, c.id]));

    const allLeagues = await db.select({ id: leagues.id, externalId: leagues.externalId }).from(leagues);
    const wcLeagueId = allLeagues.find((l) => l.externalId === 'WC')?.id;
    if (!wcLeagueId) throw new Error('WC league not found — run ensureLeaguesSeeded first');

    const nationalTeamRows = WC2026_COUNTRIES.map((c) => ({
        name: c.name,
        slug: generateUniqueSlug(c.name),
        shortName: c.fifaCode ?? c.iso3,
        country: c.iso2,
        countryId: countryByIso2.get(c.iso2) ?? null,
        teamType: 'national_team' as const,
        leagueId: wcLeagueId,
        externalId: c.iso2,
        isActive: true,
    }));

    const insertedTeams = await db.insert(teams).values(nationalTeamRows).onConflictDoNothing().returning();

    // Reload all WC national teams to get IDs (including pre-existing ones)
    const allTeams = await db.select({ id: teams.id, externalId: teams.externalId }).from(teams);
    const teamByIso2 = new Map(allTeams.map((t) => [t.externalId, t.id]));

    const competitionRows = WC2026_COUNTRIES.map((c) => ({
        competitionId: wcLeagueId,
        teamId: teamByIso2.get(c.iso2)!,
        groupName: WC2026_GROUP_ASSIGNMENTS[c.iso2] ?? null,
        status: 'active',
    })).filter((r) => r.teamId);

    const insertedCompetitionTeams = await db.insert(competitionTeams).values(competitionRows).onConflictDoNothing().returning();

    return { insertedTeams, insertedCompetitionTeams };
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

    // ─── Countries + WC2026 national teams ──────
    console.log('Seeding WC2026 countries and national teams...');
    const { insertedTeams: insertedNationalTeams, insertedCompetitionTeams } = await seedWorldCup2026();
    console.log(`  OK: ${insertedNationalTeams.length} national teams inserted`);
    console.log(`  OK: ${insertedCompetitionTeams.length} competition_teams entries inserted\n`);

    // Get league IDs by externalId
    const allLeagues = await db.select().from(leagues);
    const leagueMap = new Map(allLeagues.map(l => [l.externalId, l.id]));

    // ─── Club Teams ─────────────────────────────
    console.log('Seeding club teams...');
    const clubTeamData = [
        // PL
        { name: 'Manchester City',    shortName: 'Man City',    externalId: 'MCY',  teamType: 'club' as const, leagueId: leagueMap.get('PL') },
        { name: 'Arsenal',            shortName: 'Arsenal',     externalId: 'ARS',  teamType: 'club' as const, leagueId: leagueMap.get('PL') },
        { name: 'Liverpool',          shortName: 'Liverpool',   externalId: 'LIV',  teamType: 'club' as const, leagueId: leagueMap.get('PL') },
        { name: 'Chelsea',            shortName: 'Chelsea',     externalId: 'CHE',  teamType: 'club' as const, leagueId: leagueMap.get('PL') },
        { name: 'Manchester United',  shortName: 'Man Utd',     externalId: 'MUN',  teamType: 'club' as const, leagueId: leagueMap.get('PL') },
        { name: 'Tottenham Hotspur',  shortName: 'Spurs',       externalId: 'TOT',  teamType: 'club' as const, leagueId: leagueMap.get('PL') },
        // La Liga
        { name: 'Real Madrid',        shortName: 'R. Madrid',   externalId: 'RMA',  teamType: 'club' as const, leagueId: leagueMap.get('PD') },
        { name: 'FC Barcelona',       shortName: 'Barcelona',   externalId: 'FCB',  teamType: 'club' as const, leagueId: leagueMap.get('PD') },
        { name: 'Atlético Madrid',    shortName: 'Atlético',    externalId: 'ATM',  teamType: 'club' as const, leagueId: leagueMap.get('PD') },
        // MLS
        { name: 'Houston Dynamo FC',  shortName: 'Dynamo',      externalId: 'HOU',  teamType: 'franchise' as const, leagueId: leagueMap.get('MLS') },
        { name: 'Inter Miami CF',     shortName: 'Inter Miami', externalId: 'MIA',  teamType: 'franchise' as const, leagueId: leagueMap.get('MLS') },
        { name: 'LA Galaxy',          shortName: 'Galaxy',      externalId: 'LAG',  teamType: 'franchise' as const, leagueId: leagueMap.get('MLS') },
        { name: 'LAFC',               shortName: 'LAFC',        externalId: 'LAFC', teamType: 'franchise' as const, leagueId: leagueMap.get('MLS') },
    ];

    const insertedTeams = await db.insert(teams).values(clubTeamData.map((team) => ({
        ...team,
        slug: generateUniqueSlug(team.name),
    }))).onConflictDoNothing().returning();
    console.log(`  OK: ${insertedTeams.length} club/franchise teams inserted\n`);

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

    const tm = (iso2: string) => teamMap.get(iso2);
    const wcLeagueId = leagueMap.get('WC');

    // Real WC2026 group stage fixtures — Matchday 1 & 2
    const matchData = [
        // ── Group A ──
        { leagueId: wcLeagueId, homeTeamId: tm('US')?.id, awayTeamId: tm('JO')?.id, homeTeamName: 'United States', awayTeamName: 'Jordan',       matchDateUtc: new Date('2026-06-11T23:00:00Z'), status: 'SCHEDULED' as const, stage: 'Group A', matchDay: 1, venueName: 'MetLife Stadium, East Rutherford' },
        { leagueId: wcLeagueId, homeTeamId: tm('GB')?.id, awayTeamId: tm('DZ')?.id, homeTeamName: 'England',       awayTeamName: 'Algeria',       matchDateUtc: new Date('2026-06-12T20:00:00Z'), status: 'SCHEDULED' as const, stage: 'Group A', matchDay: 1, venueName: 'AT&T Stadium, Arlington' },
        // ── Group B ──
        { leagueId: wcLeagueId, homeTeamId: tm('MX')?.id, awayTeamId: tm('NZ')?.id, homeTeamName: 'Mexico',        awayTeamName: 'New Zealand',   matchDateUtc: new Date('2026-06-13T23:00:00Z'), status: 'SCHEDULED' as const, stage: 'Group B', matchDay: 1, venueName: 'Estadio Azteca, Mexico City' },
        { leagueId: wcLeagueId, homeTeamId: tm('AR')?.id, awayTeamId: tm('MA')?.id, homeTeamName: 'Argentina',     awayTeamName: 'Morocco',       matchDateUtc: new Date('2026-06-14T02:00:00Z'), status: 'SCHEDULED' as const, stage: 'Group B', matchDay: 1, venueName: 'SoFi Stadium, Inglewood' },
        // ── Group C ──
        { leagueId: wcLeagueId, homeTeamId: tm('CA')?.id, awayTeamId: tm('BE')?.id, homeTeamName: 'Canada',        awayTeamName: 'Belgium',       matchDateUtc: new Date('2026-06-14T20:00:00Z'), status: 'SCHEDULED' as const, stage: 'Group C', matchDay: 1, venueName: 'BMO Field, Toronto' },
        { leagueId: wcLeagueId, homeTeamId: tm('BR')?.id, awayTeamId: tm('PA')?.id, homeTeamName: 'Brazil',        awayTeamName: 'Panama',        matchDateUtc: new Date('2026-06-14T23:00:00Z'), status: 'SCHEDULED' as const, stage: 'Group C', matchDay: 1, venueName: 'Hard Rock Stadium, Miami' },
        // ── Group D ──
        { leagueId: wcLeagueId, homeTeamId: tm('FR')?.id, awayTeamId: tm('HN')?.id, homeTeamName: 'France',        awayTeamName: 'Honduras',      matchDateUtc: new Date('2026-06-15T20:00:00Z'), status: 'SCHEDULED' as const, stage: 'Group D', matchDay: 1, venueName: 'MetLife Stadium, East Rutherford' },
        { leagueId: wcLeagueId, homeTeamId: tm('KR')?.id, awayTeamId: tm('UY')?.id, homeTeamName: 'South Korea',   awayTeamName: 'Uruguay',       matchDateUtc: new Date('2026-06-15T23:00:00Z'), status: 'SCHEDULED' as const, stage: 'Group D', matchDay: 1, venueName: 'Lincoln Financial Field, Philadelphia' },
        // ── Group E ──
        { leagueId: wcLeagueId, homeTeamId: tm('DE')?.id, awayTeamId: tm('CR')?.id, homeTeamName: 'Germany',       awayTeamName: 'Costa Rica',    matchDateUtc: new Date('2026-06-16T23:00:00Z'), status: 'SCHEDULED' as const, stage: 'Group E', matchDay: 1, venueName: "Levi's Stadium, Santa Clara" },
        { leagueId: wcLeagueId, homeTeamId: tm('JP')?.id, awayTeamId: tm('ZA')?.id, homeTeamName: 'Japan',         awayTeamName: 'South Africa',  matchDateUtc: new Date('2026-06-17T02:00:00Z'), status: 'SCHEDULED' as const, stage: 'Group E', matchDay: 1, venueName: 'Lumen Field, Seattle' },
        // ── Group F ──
        { leagueId: wcLeagueId, homeTeamId: tm('ES')?.id, awayTeamId: tm('TN')?.id, homeTeamName: 'Spain',         awayTeamName: 'Tunisia',       matchDateUtc: new Date('2026-06-17T20:00:00Z'), status: 'SCHEDULED' as const, stage: 'Group F', matchDay: 1, venueName: 'AT&T Stadium, Arlington' },
        { leagueId: wcLeagueId, homeTeamId: tm('CO')?.id, awayTeamId: tm('AU')?.id, homeTeamName: 'Colombia',      awayTeamName: 'Australia',     matchDateUtc: new Date('2026-06-17T23:00:00Z'), status: 'SCHEDULED' as const, stage: 'Group F', matchDay: 1, venueName: 'NRG Stadium, Houston' },
        // ── Group G ──
        { leagueId: wcLeagueId, homeTeamId: tm('PT')?.id, awayTeamId: tm('GH')?.id, homeTeamName: 'Portugal',      awayTeamName: 'Ghana',         matchDateUtc: new Date('2026-06-18T23:00:00Z'), status: 'SCHEDULED' as const, stage: 'Group G', matchDay: 1, venueName: 'Allegiant Stadium, Las Vegas' },
        { leagueId: wcLeagueId, homeTeamId: tm('NL')?.id, awayTeamId: tm('SN')?.id, homeTeamName: 'Netherlands',   awayTeamName: 'Senegal',       matchDateUtc: new Date('2026-06-19T02:00:00Z'), status: 'SCHEDULED' as const, stage: 'Group G', matchDay: 1, venueName: 'Empower Field at Mile High, Denver' },
        // ── Group H ──
        { leagueId: wcLeagueId, homeTeamId: tm('IT')?.id, awayTeamId: tm('EC')?.id, homeTeamName: 'Italy',         awayTeamName: 'Ecuador',       matchDateUtc: new Date('2026-06-19T20:00:00Z'), status: 'SCHEDULED' as const, stage: 'Group H', matchDay: 1, venueName: 'BC Place, Vancouver' },
        { leagueId: wcLeagueId, homeTeamId: tm('EG')?.id, awayTeamId: tm('RS')?.id, homeTeamName: 'Egypt',         awayTeamName: 'Serbia',        matchDateUtc: new Date('2026-06-19T23:00:00Z'), status: 'SCHEDULED' as const, stage: 'Group H', matchDay: 1, venueName: 'Estadio BBVA, Monterrey' },
        // ── Group I ──
        { leagueId: wcLeagueId, homeTeamId: tm('HR')?.id, awayTeamId: tm('SK')?.id, homeTeamName: 'Croatia',       awayTeamName: 'Slovakia',      matchDateUtc: new Date('2026-06-20T23:00:00Z'), status: 'SCHEDULED' as const, stage: 'Group I', matchDay: 1, venueName: 'Empower Field at Mile High, Denver' },
        { leagueId: wcLeagueId, homeTeamId: tm('IR')?.id, awayTeamId: tm('VE')?.id, homeTeamName: 'Iran',          awayTeamName: 'Venezuela',     matchDateUtc: new Date('2026-06-21T02:00:00Z'), status: 'SCHEDULED' as const, stage: 'Group I', matchDay: 1, venueName: 'Estadio Akron, Guadalajara' },
        // ── Group J ──
        { leagueId: wcLeagueId, homeTeamId: tm('CH')?.id, awayTeamId: tm('CL')?.id, homeTeamName: 'Switzerland',   awayTeamName: 'Chile',         matchDateUtc: new Date('2026-06-21T20:00:00Z'), status: 'SCHEDULED' as const, stage: 'Group J', matchDay: 1, venueName: 'Lincoln Financial Field, Philadelphia' },
        { leagueId: wcLeagueId, homeTeamId: tm('NG')?.id, awayTeamId: tm('ML')?.id, homeTeamName: 'Nigeria',       awayTeamName: 'Mali',          matchDateUtc: new Date('2026-06-21T23:00:00Z'), status: 'SCHEDULED' as const, stage: 'Group J', matchDay: 1, venueName: 'NRG Stadium, Houston' },
        // ── Group K ──
        { leagueId: wcLeagueId, homeTeamId: tm('HU')?.id, awayTeamId: tm('UZ')?.id, homeTeamName: 'Hungary',       awayTeamName: 'Uzbekistan',    matchDateUtc: new Date('2026-06-22T23:00:00Z'), status: 'SCHEDULED' as const, stage: 'Group K', matchDay: 1, venueName: "Levi's Stadium, Santa Clara" },
        { leagueId: wcLeagueId, homeTeamId: tm('CM')?.id, awayTeamId: tm('SA')?.id, homeTeamName: 'Cameroon',      awayTeamName: 'Saudi Arabia',  matchDateUtc: new Date('2026-06-23T02:00:00Z'), status: 'SCHEDULED' as const, stage: 'Group K', matchDay: 1, venueName: 'Arrowhead Stadium, Kansas City' },
        // ── Group L ──
        { leagueId: wcLeagueId, homeTeamId: tm('SC')?.id, awayTeamId: tm('AT')?.id, homeTeamName: 'Scotland',      awayTeamName: 'Austria',       matchDateUtc: new Date('2026-06-23T20:00:00Z'), status: 'SCHEDULED' as const, stage: 'Group L', matchDay: 1, venueName: 'Arrowhead Stadium, Kansas City' },
        { leagueId: wcLeagueId, homeTeamId: tm('QA')?.id, awayTeamId: tm('DK')?.id, homeTeamName: 'Qatar',         awayTeamName: 'Denmark',       matchDateUtc: new Date('2026-06-23T23:00:00Z'), status: 'SCHEDULED' as const, stage: 'Group L', matchDay: 1, venueName: 'MetLife Stadium, East Rutherford' },
        // ── Matchday 2 highlights ──
        { leagueId: wcLeagueId, homeTeamId: tm('US')?.id, awayTeamId: tm('DZ')?.id, homeTeamName: 'United States', awayTeamName: 'Algeria',       matchDateUtc: new Date('2026-06-25T20:00:00Z'), status: 'SCHEDULED' as const, stage: 'Group A', matchDay: 2, venueName: 'NRG Stadium, Houston' },
        { leagueId: wcLeagueId, homeTeamId: tm('MX')?.id, awayTeamId: tm('MA')?.id, homeTeamName: 'Mexico',        awayTeamName: 'Morocco',       matchDateUtc: new Date('2026-06-26T20:00:00Z'), status: 'SCHEDULED' as const, stage: 'Group B', matchDay: 2, venueName: 'Estadio BBVA, Monterrey' },
        { leagueId: wcLeagueId, homeTeamId: tm('BR')?.id, awayTeamId: tm('BE')?.id, homeTeamName: 'Brazil',        awayTeamName: 'Belgium',       matchDateUtc: new Date('2026-06-27T20:00:00Z'), status: 'SCHEDULED' as const, stage: 'Group C', matchDay: 2, venueName: 'SoFi Stadium, Inglewood' },
        { leagueId: wcLeagueId, homeTeamId: tm('DE')?.id, awayTeamId: tm('JP')?.id, homeTeamName: 'Germany',       awayTeamName: 'Japan',         matchDateUtc: new Date('2026-06-29T20:00:00Z'), status: 'SCHEDULED' as const, stage: 'Group E', matchDay: 2, venueName: 'MetLife Stadium, East Rutherford' },
        { leagueId: wcLeagueId, homeTeamId: tm('ES')?.id, awayTeamId: tm('CO')?.id, homeTeamName: 'Spain',         awayTeamName: 'Colombia',      matchDateUtc: new Date('2026-06-30T20:00:00Z'), status: 'SCHEDULED' as const, stage: 'Group F', matchDay: 2, venueName: 'Lincoln Financial Field, Philadelphia' },
        { leagueId: wcLeagueId, homeTeamId: tm('AR')?.id, awayTeamId: tm('NZ')?.id, homeTeamName: 'Argentina',     awayTeamName: 'New Zealand',   matchDateUtc: new Date('2026-06-26T23:00:00Z'), status: 'SCHEDULED' as const, stage: 'Group B', matchDay: 2, venueName: 'AT&T Stadium, Arlington' },
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
