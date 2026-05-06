import 'dotenv/config';
import { db } from '../db/client.js';
import { venues } from '../db/schema.js';
import { sql } from 'drizzle-orm';

const rows = await db.select({ name: venues.name, metadata: venues.metadata })
  .from(venues)
  .where(sql`metadata->>'importedPlaceId' IS NOT NULL`)
  .limit(3);

for (const r of rows) {
  const m = r.metadata as any;
  console.log('---', r.name);
  console.log('  keys:', Object.keys(m || {}));
  console.log('  galleryUrls length:', (m?.galleryUrls || []).length);
  console.log('  sample:', JSON.stringify((m?.galleryUrls || []).slice(0, 1)));
}
process.exit(0);
