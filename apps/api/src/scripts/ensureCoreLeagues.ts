import 'dotenv/config';

import { ensureLeaguesSeeded } from '../db/seed';

async function main() {
    const inserted = await ensureLeaguesSeeded();
    console.log(JSON.stringify({ insertedCount: inserted.length, inserted }, null, 2));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
    });
