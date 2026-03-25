import 'dotenv/config';
import { db } from '../db/client.js';
import { venues } from '../db/schema.js';
import { sql } from 'drizzle-orm';

const BAR_TYPES = ['bar', 'night_club', 'restaurant', 'food', 'cafe', 'meal_takeaway', 'meal_delivery'];

async function main() {
    const all = await db.select({ id: venues.id, name: venues.name, city: venues.city, metadata: venues.metadata })
        .from(venues)
        .where(sql`metadata->>'importedPlaceId' IS NOT NULL`);

    const junk = all.filter(v => {
        const types: string[] = (v.metadata as any)?.googleTypes ?? [];
        return !types.some(t => BAR_TYPES.includes(t));
    });

    if (!junk.length) { console.log('No junk venues found.'); process.exit(0); }

    console.log(`Deleting ${junk.length} junk venues:`);
    for (const v of junk) {
        console.log(`  - ${v.name} | ${v.city}`);
        await db.delete(venues).where(sql`id = ${v.id}`);
    }
    console.log(`\nDone. ${junk.length} venues removed.`);
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
