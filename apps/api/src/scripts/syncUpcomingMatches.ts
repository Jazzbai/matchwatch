import 'dotenv/config';

import { and, asc, count, eq, gte, inArray } from 'drizzle-orm';
import { db } from '../db/client';
import { leagues, matches, sports } from '../db/schema';
import { resolveMatchSyncProvider, runMatchSyncOnce } from '../workers/matchSync';

type Provider = 'API_FOOTBALL' | 'FOOTBALL_DATA' | 'THE_SPORTS_DB' | 'ESPN';

function parseArgs(argv: string[]) {
    const args = new Map<string, string | boolean>();
    for (const raw of argv) {
        if (!raw.startsWith('--')) continue;
        const [key, value] = raw.slice(2).split('=', 2);
        args.set(key, value === undefined ? true : value);
    }
    return args;
}

function asProvider(value: string | boolean | undefined): Provider | undefined {
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim().toUpperCase().replace('-', '_');
    if (normalized === 'API_FOOTBALL' || normalized === 'FOOTBALL_DATA' || normalized === 'THE_SPORTS_DB' || normalized === 'ESPN') {
        return normalized;
    }
    throw new Error(`Unsupported provider override: ${value}`);
}

async function getActiveSportsAndLeagues(sportSlug: string) {
    const sportRows = await db.select({
        id: sports.id,
        name: sports.name,
        slug: sports.slug,
        shortName: sports.shortName,
        isActive: sports.isActive,
        sortOrder: sports.sortOrder,
    }).from(sports).orderBy(asc(sports.sortOrder), asc(sports.name));

    const leagueRows = await db.select({
        id: leagues.id,
        sportId: leagues.sportId,
        name: leagues.name,
        shortName: leagues.shortName,
        externalId: leagues.externalId,
        country: leagues.country,
        isActive: leagues.isActive,
        sortOrder: leagues.sortOrder,
        sportSlug: sports.slug,
    })
        .from(leagues)
        .innerJoin(sports, eq(leagues.sportId, sports.id))
        .orderBy(asc(leagues.sortOrder), asc(leagues.name));

    return {
        sports: sportRows,
        leagues: leagueRows,
        syncTargets: leagueRows.filter((row) => row.isActive && row.sportSlug === sportSlug),
    };
}

async function getUpcomingCounts() {
    const now = new Date();
    const [totalMatches] = await db.select({ count: count() }).from(matches);
    const [upcomingMatches] = await db.select({ count: count() })
        .from(matches)
        .where(and(
            gte(matches.matchDateUtc, now),
            inArray(matches.status, ['SCHEDULED', 'TIMED', 'IN_PLAY', 'PAUSED']),
        ));

    return {
        totalMatches: Number(totalMatches?.count || 0),
        upcomingMatches: Number(upcomingMatches?.count || 0),
    };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const sportSlug = typeof args.get('sport') === 'string' ? String(args.get('sport')).trim() : 'soccer';
    const providerOverride = asProvider(args.get('provider'));
    const listOnly = args.has('list-only');

    const provider = providerOverride || resolveMatchSyncProvider();
    const hasApiFootball = Boolean(process.env.API_FOOTBALL_API_KEY);
    const hasFootballData = Boolean(process.env.FOOTBALL_DATA_API_KEY);

    const inventory = await getActiveSportsAndLeagues(sportSlug);
    const before = await getUpcomingCounts();

    console.log(JSON.stringify({
        provider: {
            configured: process.env.MATCH_SYNC_PROVIDER || null,
            override: providerOverride || null,
            resolved: provider,
            hasApiFootball,
            hasFootballData,
        },
        database: {
            sports: inventory.sports,
            leagues: inventory.leagues,
            syncTargets: inventory.syncTargets.map((league) => ({
                id: league.id,
                name: league.name,
                shortName: league.shortName,
                externalId: league.externalId,
                country: league.country,
                isActive: league.isActive,
            })),
            before,
        },
    }, null, 2));

    if (listOnly) return;

    const syncResults = await runMatchSyncOnce({
        providerOverride,
        sportSlug,
        writeHistory: true,
    });
    const after = await getUpcomingCounts();

    console.log(JSON.stringify({
        syncResults,
        after,
        delta: {
            totalMatches: after.totalMatches - before.totalMatches,
            upcomingMatches: after.upcomingMatches - before.upcomingMatches,
        },
    }, null, 2));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
    });
