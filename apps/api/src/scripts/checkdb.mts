import 'dotenv/config';
import { db } from '../db/client.js';
import { venues } from '../db/schema.js';

const rows = await db.select({ name: venues.name, meta: venues.metadata }).from(venues).limit(5);
for (const r of rows) {
  const meta = r.meta as any;
  console.log(r.name, '|', meta?.importedPlaceId ?? 'no-place-id');
}
process.exit(0);
