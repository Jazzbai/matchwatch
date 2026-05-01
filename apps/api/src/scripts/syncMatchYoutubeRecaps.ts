import 'dotenv/config';
import { processRecentFinishedMatchRecaps } from '../lib/youtubeRecaps';

function getArgValue(name: string) {
    const prefix = `--${name}=`;
    const arg = process.argv.find((value) => value.startsWith(prefix));
    return arg ? arg.slice(prefix.length) : null;
}

async function main() {
    const matchId = getArgValue('matchId');
    const limit = Number(getArgValue('limit') || 10);
    const lookbackDays = Number(getArgValue('lookbackDays') || 21);
    const league = getArgValue('league') || 'mls';
    const forceRefresh = process.argv.includes('--force');

    const result = await processRecentFinishedMatchRecaps({
        limit: Number.isFinite(limit) ? limit : 10,
        lookbackDays: Number.isFinite(lookbackDays) ? lookbackDays : 21,
        leagueSlugs: league
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
        forceRefresh,
        matchIds: matchId ? [matchId] : undefined,
    });

    console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
