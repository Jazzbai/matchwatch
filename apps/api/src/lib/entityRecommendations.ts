import { and, asc, eq, ilike } from 'drizzle-orm';
import { db } from '../db/client';
import { drivers, entrants, eventEntries, leagues, manufacturers, matches, players, teams } from '../db/schema';
import { logger } from './logger';

export type RecommendationEntityType = 'team' | 'player' | 'driver' | 'entrant' | 'manufacturer';
export type RecommendationSourceType = 'catalog' | 'provider' | 'existing-db' | 'external';
export type RecommendationConfidence = 'high' | 'medium' | 'low';

export type RecommendationItem = {
    id: string;
    name: string;
    shortName?: string | null;
    leagueId?: string | null;
    leagueLabel?: string | null;
    sourceType: RecommendationSourceType;
    confidence: RecommendationConfidence;
    externalId?: string | null;
    website?: string | null;
    imageCandidates?: string[];
    aliases?: string[];
    alreadyExists?: { id: string; slug?: string | null; name: string } | null;
    prefill?: {
        brandColor?: string | null;
        nationality?: string | null;
        countryCode?: string | null;
        shortDescription?: string | null;
        description?: string | null;
    };
};

type RecommendationQuery = {
    entityType: RecommendationEntityType;
    leagueId?: string | null;
    q?: string | null;
};

type CatalogEntry = Omit<RecommendationItem, 'alreadyExists' | 'leagueId' | 'leagueLabel'> & {
    leagueAliases?: string[];
};

const F1_ENTRANTS: CatalogEntry[] = [
    { id: 'f1:entrant:mclaren', name: 'McLaren', shortName: 'McLaren', sourceType: 'catalog', confidence: 'high', website: 'https://www.mclaren.com/racing/formula-1/', aliases: ['McLaren Formula 1 Team'], prefill: { brandColor: '#FF8700', shortDescription: 'McLaren is a motorsport team active in Formula 1.' } },
    { id: 'f1:entrant:ferrari', name: 'Ferrari', shortName: 'Ferrari', sourceType: 'catalog', confidence: 'high', website: 'https://www.ferrari.com/en-EN/formula1', aliases: ['Scuderia Ferrari'], prefill: { brandColor: '#DC0000', shortDescription: 'Ferrari is a motorsport team active in Formula 1.' } },
    { id: 'f1:entrant:red-bull-racing', name: 'Red Bull Racing', shortName: 'Red Bull', sourceType: 'catalog', confidence: 'high', website: 'https://www.redbullracing.com/', aliases: ['Oracle Red Bull Racing'], prefill: { brandColor: '#1E5BC6', shortDescription: 'Red Bull Racing is a motorsport team active in Formula 1.' } },
    { id: 'f1:entrant:mercedes', name: 'Mercedes', shortName: 'Mercedes', sourceType: 'catalog', confidence: 'high', website: 'https://www.mercedesamgf1.com/', aliases: ['Mercedes-AMG PETRONAS F1 Team'], prefill: { brandColor: '#00D2BE', shortDescription: 'Mercedes is a motorsport team active in Formula 1.' } },
    { id: 'f1:entrant:aston-martin', name: 'Aston Martin', shortName: 'Aston Martin', sourceType: 'catalog', confidence: 'high', website: 'https://www.astonmartinf1.com/', aliases: ['Aston Martin Aramco Formula One Team'], prefill: { brandColor: '#006F62', shortDescription: 'Aston Martin is a motorsport team active in Formula 1.' } },
    { id: 'f1:entrant:alpine', name: 'Alpine', shortName: 'Alpine', sourceType: 'catalog', confidence: 'high', website: 'https://www.alpinef1.com/', aliases: ['BWT Alpine F1 Team'], prefill: { brandColor: '#0090FF', shortDescription: 'Alpine is a motorsport team active in Formula 1.' } },
    { id: 'f1:entrant:haas', name: 'Haas', shortName: 'Haas', sourceType: 'catalog', confidence: 'high', website: 'https://www.haasf1team.com/', aliases: ['MoneyGram Haas F1 Team'], prefill: { brandColor: '#B6BABD', shortDescription: 'Haas is a motorsport team active in Formula 1.' } },
    { id: 'f1:entrant:racing-bulls', name: 'Racing Bulls', shortName: 'Racing Bulls', sourceType: 'catalog', confidence: 'high', website: 'https://www.visacashapprb.com/', aliases: ['Visa Cash App Racing Bulls'], prefill: { brandColor: '#1E41FF', shortDescription: 'Racing Bulls is a motorsport team active in Formula 1.' } },
    { id: 'f1:entrant:williams', name: 'Williams', shortName: 'Williams', sourceType: 'catalog', confidence: 'high', website: 'https://www.williamsf1.com/', aliases: ['Atlassian Williams Racing'], prefill: { brandColor: '#005AFF', shortDescription: 'Williams is a motorsport team active in Formula 1.' } },
    { id: 'f1:entrant:sauber', name: 'Sauber', shortName: 'Sauber', sourceType: 'catalog', confidence: 'high', website: 'https://www.sauber-group.com/motorsport/', aliases: ['Stake F1 Team Kick Sauber'], prefill: { brandColor: '#52E252', shortDescription: 'Sauber is a motorsport team active in Formula 1.' } },
];

const F1_DRIVERS: CatalogEntry[] = [
    { id: 'f1:driver:max-verstappen', name: 'Max Verstappen', shortName: 'Verstappen', sourceType: 'catalog', confidence: 'high', aliases: ['Max Emilian Verstappen'], prefill: { nationality: 'Netherlands', countryCode: 'NED', shortDescription: 'Max Verstappen is a racing driver competing in Formula 1.' } },
    { id: 'f1:driver:sergio-perez', name: 'Sergio Perez', shortName: 'Perez', sourceType: 'catalog', confidence: 'medium', aliases: ['Checo Perez'], prefill: { nationality: 'Mexico', countryCode: 'MEX', shortDescription: 'Sergio Perez is a racing driver associated with Formula 1.' } },
    { id: 'f1:driver:lando-norris', name: 'Lando Norris', shortName: 'Norris', sourceType: 'catalog', confidence: 'high', prefill: { nationality: 'United Kingdom', countryCode: 'GBR', shortDescription: 'Lando Norris is a racing driver competing in Formula 1.' } },
    { id: 'f1:driver:oscar-piastri', name: 'Oscar Piastri', shortName: 'Piastri', sourceType: 'catalog', confidence: 'high', prefill: { nationality: 'Australia', countryCode: 'AUS', shortDescription: 'Oscar Piastri is a racing driver competing in Formula 1.' } },
    { id: 'f1:driver:charles-leclerc', name: 'Charles Leclerc', shortName: 'Leclerc', sourceType: 'catalog', confidence: 'high', prefill: { nationality: 'Monaco', countryCode: 'MCO', shortDescription: 'Charles Leclerc is a racing driver competing in Formula 1.' } },
    { id: 'f1:driver:carlos-sainz', name: 'Carlos Sainz Jr.', shortName: 'Sainz', sourceType: 'catalog', confidence: 'medium', aliases: ['Carlos Sainz'], prefill: { nationality: 'Spain', countryCode: 'ESP', shortDescription: 'Carlos Sainz Jr. is a racing driver associated with Formula 1.' } },
    { id: 'f1:driver:lewis-hamilton', name: 'Lewis Hamilton', shortName: 'Hamilton', sourceType: 'catalog', confidence: 'high', prefill: { nationality: 'United Kingdom', countryCode: 'GBR', shortDescription: 'Lewis Hamilton is a racing driver competing in Formula 1.' } },
    { id: 'f1:driver:george-russell', name: 'George Russell', shortName: 'Russell', sourceType: 'catalog', confidence: 'high', prefill: { nationality: 'United Kingdom', countryCode: 'GBR', shortDescription: 'George Russell is a racing driver competing in Formula 1.' } },
    { id: 'f1:driver:fernando-alonso', name: 'Fernando Alonso', shortName: 'Alonso', sourceType: 'catalog', confidence: 'high', prefill: { nationality: 'Spain', countryCode: 'ESP', shortDescription: 'Fernando Alonso is a racing driver competing in Formula 1.' } },
    { id: 'f1:driver:lance-stroll', name: 'Lance Stroll', shortName: 'Stroll', sourceType: 'catalog', confidence: 'high', prefill: { nationality: 'Canada', countryCode: 'CAN', shortDescription: 'Lance Stroll is a racing driver competing in Formula 1.' } },
    { id: 'f1:driver:pierre-gasly', name: 'Pierre Gasly', shortName: 'Gasly', sourceType: 'catalog', confidence: 'high', prefill: { nationality: 'France', countryCode: 'FRA', shortDescription: 'Pierre Gasly is a racing driver competing in Formula 1.' } },
    { id: 'f1:driver:esteban-ocon', name: 'Esteban Ocon', shortName: 'Ocon', sourceType: 'catalog', confidence: 'high', prefill: { nationality: 'France', countryCode: 'FRA', shortDescription: 'Esteban Ocon is a racing driver competing in Formula 1.' } },
];

const F1_MANUFACTURERS: CatalogEntry[] = [
    { id: 'f1:manufacturer:ferrari', name: 'Ferrari', shortName: 'Ferrari', sourceType: 'catalog', confidence: 'high', website: 'https://www.ferrari.com/en-EN/formula1', aliases: ['Scuderia Ferrari'], prefill: { shortDescription: 'Ferrari is a motorsport manufacturer associated with Formula 1.' } },
    { id: 'f1:manufacturer:mercedes', name: 'Mercedes', shortName: 'Mercedes', sourceType: 'catalog', confidence: 'high', website: 'https://www.mercedesamgf1.com/', aliases: ['Mercedes-AMG'], prefill: { shortDescription: 'Mercedes is a motorsport manufacturer associated with Formula 1.' } },
    { id: 'f1:manufacturer:honda-rbpt', name: 'Honda RBPT', shortName: 'Honda RBPT', sourceType: 'catalog', confidence: 'high', website: 'https://www.honda.racing/f1', aliases: ['Red Bull Powertrains'], prefill: { shortDescription: 'Honda RBPT is a motorsport manufacturer associated with Formula 1.' } },
    { id: 'f1:manufacturer:renault', name: 'Renault', shortName: 'Renault', sourceType: 'catalog', confidence: 'high', website: 'https://www.renaultgroup.com/', prefill: { shortDescription: 'Renault is a motorsport manufacturer associated with Formula 1.' } },
];

function normalize(value?: string | null) {
    return (value || '').trim().toLowerCase();
}

function matchesQuery(item: { name: string; shortName?: string | null; aliases?: string[] }, q?: string | null) {
    const query = normalize(q);
    if (!query) return true;
    return [item.name, item.shortName, ...(item.aliases || [])]
        .map((value) => normalize(value))
        .some((value) => value.includes(query));
}

async function getLeagueContext(leagueId?: string | null) {
    if (!leagueId) return null;
    const [league] = await db.select({ id: leagues.id, name: leagues.name, slug: leagues.slug, shortName: leagues.shortName }).from(leagues).where(eq(leagues.id, leagueId)).limit(1);
    return league || null;
}

function isFormulaOneLeague(league?: { name?: string | null; slug?: string | null; shortName?: string | null } | null) {
    const haystack = [league?.name, league?.slug, league?.shortName].map(normalize).join(' ');
    return haystack.includes('formula 1') || haystack.includes('formula-1') || haystack === 'f1' || haystack.includes(' f1');
}

async function loadExistingRecommendations(query: RecommendationQuery, leagueLabel?: string | null): Promise<RecommendationItem[]> {
    const search = query.q?.trim();
    if (query.entityType === 'team') {
        const rows = await db.select({ id: teams.id, name: teams.name, slug: teams.slug, shortName: teams.shortName, website: teams.website, aliases: teams.aliases }).from(teams).where(and(
            query.leagueId ? eq(teams.leagueId, query.leagueId) : undefined,
            search ? ilike(teams.name, `%${search}%`) : undefined,
        ) as any).orderBy(teams.name).limit(12);
        return rows.map((row) => ({ id: `existing:team:${row.id}`, name: row.name, shortName: row.shortName, website: row.website, aliases: row.aliases || [], sourceType: 'existing-db', confidence: 'high', leagueId: query.leagueId || null, leagueLabel, alreadyExists: { id: row.id, slug: row.slug, name: row.name } }));
    }
    if (query.entityType === 'player') {
        const rows = await db.select({ id: players.id, name: players.name, slug: players.slug, shortName: players.shortName, website: players.website, aliases: players.aliases }).from(players).where(and(
            query.leagueId ? eq(players.leagueId, query.leagueId) : undefined,
            search ? ilike(players.name, `%${search}%`) : undefined,
        ) as any).orderBy(players.name).limit(12);
        return rows.map((row) => ({ id: `existing:player:${row.id}`, name: row.name, shortName: row.shortName, website: row.website, aliases: row.aliases || [], sourceType: 'existing-db', confidence: 'high', leagueId: query.leagueId || null, leagueLabel, alreadyExists: { id: row.id, slug: row.slug, name: row.name } }));
    }
    if (query.entityType === 'driver') {
        const rows = query.leagueId
            ? await db.select({ id: drivers.id, name: drivers.name, slug: drivers.slug, shortName: drivers.shortName, website: drivers.website, aliases: drivers.aliases })
                .from(eventEntries)
                .innerJoin(drivers, eq(eventEntries.driverId, drivers.id))
                .innerJoin(matches, eq(eventEntries.matchId, matches.id))
                .where(and(eq(matches.leagueId, query.leagueId), search ? ilike(drivers.name, `%${search}%`) : undefined) as any)
                .limit(20)
            : await db.select({ id: drivers.id, name: drivers.name, slug: drivers.slug, shortName: drivers.shortName, website: drivers.website, aliases: drivers.aliases })
                .from(drivers)
                .where(search ? ilike(drivers.name, `%${search}%`) : undefined as any)
                .orderBy(drivers.name)
                .limit(12);
        const deduped = Array.from(new Map(rows.map((row) => [row.id, row])).values());
        return deduped.map((row) => ({ id: `existing:driver:${row.id}`, name: row.name, shortName: row.shortName, website: row.website, aliases: row.aliases || [], sourceType: 'existing-db', confidence: 'high', leagueId: query.leagueId || null, leagueLabel, alreadyExists: { id: row.id, slug: row.slug, name: row.name } }));
    }
    if (query.entityType === 'entrant') {
        const rows = await db.select({ id: entrants.id, name: entrants.name, slug: entrants.slug, shortName: entrants.shortName, website: entrants.website, aliases: entrants.aliases }).from(entrants).where(and(
            query.leagueId ? eq(entrants.leagueId, query.leagueId) : undefined,
            search ? ilike(entrants.name, `%${search}%`) : undefined,
        ) as any).orderBy(entrants.name).limit(12);
        return rows.map((row) => ({ id: `existing:entrant:${row.id}`, name: row.name, shortName: row.shortName, website: row.website, aliases: row.aliases || [], sourceType: 'existing-db', confidence: 'high', leagueId: query.leagueId || null, leagueLabel, alreadyExists: { id: row.id, slug: row.slug, name: row.name } }));
    }
    const rows = await db.select({ id: manufacturers.id, name: manufacturers.name, slug: manufacturers.slug, shortName: manufacturers.shortName, website: manufacturers.website, aliases: manufacturers.aliases }).from(manufacturers).where(and(
        query.leagueId ? eq(manufacturers.leagueId, query.leagueId) : undefined,
        search ? ilike(manufacturers.name, `%${search}%`) : undefined,
    ) as any).orderBy(manufacturers.name).limit(12);
    return rows.map((row) => ({ id: `existing:manufacturer:${row.id}`, name: row.name, shortName: row.shortName, website: row.website, aliases: row.aliases || [], sourceType: 'existing-db', confidence: 'high', leagueId: query.leagueId || null, leagueLabel, alreadyExists: { id: row.id, slug: row.slug, name: row.name } }));
}

async function findExactExisting(entityType: RecommendationEntityType, leagueId: string | null | undefined, name: string) {
    if (entityType === 'team') {
        const [row] = await db.select({ id: teams.id, slug: teams.slug, name: teams.name }).from(teams).where(and(eq(teams.name, name), leagueId ? eq(teams.leagueId, leagueId) : undefined) as any).limit(1);
        return row || null;
    }
    if (entityType === 'player') {
        const [row] = await db.select({ id: players.id, slug: players.slug, name: players.name }).from(players).where(and(eq(players.name, name), leagueId ? eq(players.leagueId, leagueId) : undefined) as any).limit(1);
        return row || null;
    }
    if (entityType === 'driver') {
        const [row] = await db.select({ id: drivers.id, slug: drivers.slug, name: drivers.name }).from(drivers).where(eq(drivers.name, name)).limit(1);
        return row || null;
    }
    if (entityType === 'entrant') {
        const [row] = await db.select({ id: entrants.id, slug: entrants.slug, name: entrants.name }).from(entrants).where(and(eq(entrants.name, name), leagueId ? eq(entrants.leagueId, leagueId) : undefined) as any).limit(1);
        return row || null;
    }
    const [row] = await db.select({ id: manufacturers.id, slug: manufacturers.slug, name: manufacturers.name }).from(manufacturers).where(and(eq(manufacturers.name, name), leagueId ? eq(manufacturers.leagueId, leagueId) : undefined) as any).limit(1);
    return row || null;
}

async function loadCatalogRecommendations(query: RecommendationQuery, league: Awaited<ReturnType<typeof getLeagueContext>>): Promise<RecommendationItem[]> {
    if (!isFormulaOneLeague(league)) return [];

    const catalog = query.entityType === 'entrant'
        ? F1_ENTRANTS
        : query.entityType === 'driver'
            ? F1_DRIVERS
            : query.entityType === 'manufacturer'
                ? F1_MANUFACTURERS
                : [];

    const filtered = catalog.filter((item) => matchesQuery(item, query.q)).slice(0, 12);
    return Promise.all(filtered.map(async (item) => ({
        ...item,
        leagueId: league?.id || query.leagueId || null,
        leagueLabel: league?.name || null,
        alreadyExists: await findExactExisting(query.entityType, league?.id || query.leagueId, item.name),
    })));
}

export async function getRecommendations(query: RecommendationQuery) {
    const league = await getLeagueContext(query.leagueId);
    const [catalog, existing] = await Promise.all([
        loadCatalogRecommendations(query, league),
        loadExistingRecommendations(query, league?.name || null),
    ]);

    const merged = new Map<string, RecommendationItem>();
    for (const item of [...catalog, ...existing]) {
        const key = normalize(item.name);
        if (!merged.has(key)) merged.set(key, item);
        else if (merged.get(key)?.sourceType !== 'catalog' && item.sourceType === 'catalog') merged.set(key, item);
    }

    const results = Array.from(merged.values()).sort((a, b) => {
        const sourceRank = (value: RecommendationSourceType) => value === 'catalog' ? 0 : value === 'existing-db' ? 1 : 2;
        return sourceRank(a.sourceType) - sourceRank(b.sourceType) || a.name.localeCompare(b.name);
    }).slice(0, 12);

    logger.info({ entityType: query.entityType, leagueId: query.leagueId || null, query: query.q || null, candidateCount: results.length, highConfidenceCount: results.filter((item) => item.confidence === 'high').length }, 'Entity recommendations loaded');
    return results;
}

export async function getRecommendationPreview(query: RecommendationQuery & { recommendationId: string }) {
    const recommendations = await getRecommendations(query);
    const recommendation = recommendations.find((item) => item.id === query.recommendationId);
    if (!recommendation) return null;

    return {
        recommendation,
        prefill: {
            name: recommendation.name,
            shortName: recommendation.shortName || '',
            website: recommendation.website || '',
            aliases: recommendation.aliases || [],
            externalId: recommendation.externalId || '',
            imageCandidates: recommendation.imageCandidates || [],
            brandColor: recommendation.prefill?.brandColor || '',
            nationality: recommendation.prefill?.nationality || '',
            countryCode: recommendation.prefill?.countryCode || '',
            shortDescription: recommendation.prefill?.shortDescription || `${recommendation.name} is tracked by MatchWatch in ${recommendation.leagueLabel || 'this competition'}.`,
            description: recommendation.prefill?.description || `${recommendation.name} is part of the ${recommendation.leagueLabel || 'selected competition'} catalog in MatchWatch. Review the suggested metadata, then save explicitly to persist the record.`,
        },
    };
}
