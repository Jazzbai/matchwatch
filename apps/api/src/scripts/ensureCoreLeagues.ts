import 'dotenv/config';

import { ensureLeaguesSeeded, ensureSportsSeeded } from '../db/seed';

async function main() {
    const insertedSports = await ensureSportsSeeded();
    const insertedLeagues = await ensureLeaguesSeeded();
    console.log(JSON.stringify({
        insertedSportsCount: insertedSports.length,
        insertedLeaguesCount: insertedLeagues.length,
        insertedSports,
        insertedLeagues,
    }, null, 2));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
    });
