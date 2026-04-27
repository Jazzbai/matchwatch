import 'dotenv/config';
import { db } from '../db/client.js';
import { venues } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

async function main() {
    const updated = await db
        .update(venues)
        .set({ approvalStatus: 'APPROVED', approvedAt: new Date() })
        .where(and(eq(venues.approvalStatus, 'PENDING'), eq(venues.isActive, true)))
        .returning({ id: venues.id, name: venues.name, city: venues.city });

    console.log(`✅ Approved ${updated.length} venues:`);
    for (const v of updated) {
        console.log(`  • ${v.name} (${v.city}) — ${v.id}`);
    }
    process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
