import 'dotenv/config';
import { db } from '../db/client.js';
import { venues } from '../db/schema.js';
import { inArray } from 'drizzle-orm';

const JUNK = [
    'Beat The Bomb Philadelphia',
    'Crystal Tea Room',
    'Cheba Hut "Toasted" Subs',
    "Domino's Pizza",
    'Total Wine & More',
];

async function main() {
    const deleted = await db
        .delete(venues)
        .where(inArray(venues.name, JUNK))
        .returning({ id: venues.id, name: venues.name, city: venues.city });

    if (!deleted.length) {
        console.log('None of those venues found (already removed or name mismatch).');
    } else {
        for (const v of deleted) console.log(`Deleted: ${v.name} | ${v.city}`);
        console.log(`Total removed: ${deleted.length}`);
    }
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
