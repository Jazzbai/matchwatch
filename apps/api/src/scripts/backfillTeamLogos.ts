import 'dotenv/config';

import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { leagues, teams } from '../db/schema';
import { fetchFootballDataCompetitionTeams } from '../workers/matchSync';

function parseArgs(argv: string[]) {
    const args = new Map<string, string | boolean>();
    for (const raw of argv) {
        if (!raw.startsWith('--')) continue;
        const [key, value] = raw.slice(2).split('=', 2);
        args.set(key, value === undefined ? true : value);
    }
    return args;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const leagueCode = typeof args.get('league') === 'string' ? String(args.get('league')).trim().toUpperCase() : 'WC';
    const createMissing = args.get('create-missing') === true;
    const apiKey = process.env.FOOTBALL_DATA_API_KEY;
    if (!apiKey) {
        throw new Error('FOOTBALL_DATA_API_KEY is required for logo backfill');
    }

    const [league] = await db.select({
        id: leagues.id,
        name: leagues.name,
        externalId: leagues.externalId,
    }).from(leagues).where(eq(leagues.externalId, leagueCode)).limit(1);

    if (!league) {
        throw new Error(`No league found with externalId=${leagueCode}`);
    }

    const remoteTeams = await fetchFootballDataCompetitionTeams(leagueCode, apiKey);
    const localTeams = await db.select({
        id: teams.id,
        name: teams.name,
        shortName: teams.shortName,
        crestUrl: teams.crestUrl,
    }).from(teams)
        .where(eq(teams.leagueId, league.id))
        .orderBy(asc(teams.name));

    const localByLowerName = new Map(localTeams.map((team) => [team.name.toLowerCase(), team]));
    let updated = 0;
    let skipped = 0;
    let created = 0;
    const unmatchedRemote: string[] = [];

    for (const remote of remoteTeams) {
        const local = localByLowerName.get(remote.name.toLowerCase());
        if (!local) {
            if (createMissing) {
                const [inserted] = await db.insert(teams).values({
                    leagueId: league.id,
                    name: remote.name,
                    shortName: remote.shortName || remote.name,
                    crestUrl: remote.crest || null,
                    externalId: String(remote.id),
                }).onConflictDoNothing().returning({
                    id: teams.id,
                    name: teams.name,
                    shortName: teams.shortName,
                    crestUrl: teams.crestUrl,
                });

                if (inserted) {
                    localByLowerName.set(inserted.name.toLowerCase(), inserted);
                    created += 1;
                    continue;
                }
            }
            unmatchedRemote.push(remote.name);
            continue;
        }
        if (!remote.crest) {
            skipped += 1;
            continue;
        }
        await db.update(teams).set({
            shortName: remote.shortName || local.shortName,
            crestUrl: remote.crest,
        }).where(eq(teams.id, local.id));
        updated += 1;
    }

    const remainingWithoutLogos = await db.select({
        id: teams.id,
        name: teams.name,
        shortName: teams.shortName,
    }).from(teams)
        .where(and(
            eq(teams.leagueId, league.id),
            sql`${teams.crestUrl} IS NULL`,
        ))
        .orderBy(asc(teams.name));

    console.log(JSON.stringify({
        league,
        remoteTeamCount: remoteTeams.length,
        localTeamCount: localTeams.length,
        updated,
        created,
        skipped,
        createMissing,
        unmatchedRemote,
        remainingWithoutLogos,
    }, null, 2));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
    });
