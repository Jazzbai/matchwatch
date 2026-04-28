/**
 * fetchVenueImages.ts
 *
 * For every venue without a cover image:
 *   1. Text-searches Google Places by "name, city"
 *   2. Fetches photos from the top result
 *   3. Sets cover_image_url to the Google photo URL (serves directly, no download)
 *
 * Usage:
 *   npx tsx src/scripts/fetchVenueImages.ts
 *   npx tsx src/scripts/fetchVenueImages.ts --dry-run
 *   npx tsx src/scripts/fetchVenueImages.ts --limit=20
 */

import 'dotenv/config';
import { eq, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { venues } from '../db/schema.js';

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY ?? '';
const PHOTO_MAX_WIDTH = 1200;

function parseArgs(argv: string[]): Record<string, string | boolean> {
    const out: Record<string, string | boolean> = {};
    for (const raw of argv) {
        if (!raw.startsWith('--')) continue;
        const [k, v] = raw.slice(2).split('=', 2);
        out[k] = v ?? true;
    }
    return out;
}

const args = parseArgs(process.argv.slice(2));
const DRY_RUN = Boolean(args['dry-run']);
const LIMIT = args['limit'] ? Number(args['limit']) : undefined;

function sleep(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)); }

async function searchPlace(name: string, city: string): Promise<string | null> {
    const query = encodeURIComponent(`${name} ${city}`);
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&type=bar|restaurant&key=${GOOGLE_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json() as any;
    if (data.status !== 'OK' || !data.results?.length) return null;
    return data.results[0].place_id as string;
}

async function getPlacePhoto(placeId: string): Promise<string | null> {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${GOOGLE_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json() as any;
    const photos = data.result?.photos;
    if (!photos?.length) return null;
    const ref = photos[0].photo_reference;
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${PHOTO_MAX_WIDTH}&photoreference=${ref}&key=${GOOGLE_API_KEY}`;
}

async function main() {
    if (!GOOGLE_API_KEY) throw new Error('Missing GOOGLE_PLACES_API_KEY');

    console.log(`\nMatchWatch — Venue Image Fetcher (${DRY_RUN ? 'DRY RUN' : 'LIVE'})\n`);

    const allVenues = await db
        .select({ id: venues.id, name: venues.name, city: venues.city, addressLine1: venues.addressLine1 })
        .from(venues)
        .where(isNull(venues.coverImageUrl));

    const toProcess = LIMIT ? allVenues.slice(0, LIMIT) : allVenues;
    console.log(`Venues without cover image: ${allVenues.length}, processing: ${toProcess.length}\n`);

    let updated = 0;
    let noResults = 0;
    let errors = 0;

    for (const [i, venue] of toProcess.entries()) {
        process.stdout.write(`[${i + 1}/${toProcess.length}] ${venue.name} (${venue.city}) ... `);

        try {
            const placeId = await searchPlace(venue.name, venue.city);
            if (!placeId) { console.log('no search results'); noResults++; await sleep(200); continue; }

            const photoUrl = await getPlacePhoto(placeId);
            if (!photoUrl) { console.log('no photos'); noResults++; await sleep(200); continue; }

            console.log('✓ got photo');

            if (!DRY_RUN) {
                await db.update(venues)
                    .set({ coverImageUrl: photoUrl, updatedAt: new Date() })
                    .where(eq(venues.id, venue.id));
            }
            updated++;
        } catch (err) {
            console.log(`error: ${(err as Error).message.slice(0, 60)}`);
            errors++;
        }

        await sleep(200); // ~5 req/s, well within Google's limit
    }

    console.log(`\nDone. Updated: ${updated}, No results: ${noResults}, Errors: ${errors}`);
    if (DRY_RUN) console.log('DRY RUN — nothing written to DB.');
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
