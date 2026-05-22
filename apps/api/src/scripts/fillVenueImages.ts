/**
 * fillVenueImages.ts
 *
 * For every venue without a coverImageUrl that has an importedPlaceId in metadata,
 * fetches a Google Places photo reference and stores the photo URL.
 *
 * Cost: ~$17 per 1000 Place Details calls (only fields: photos)
 *
 * Usage:
 *   npx tsx apps/api/src/scripts/fillVenueImages.ts --dry-run
 *   npx tsx apps/api/src/scripts/fillVenueImages.ts
 *   npx tsx apps/api/src/scripts/fillVenueImages.ts --city=Houston
 *   npx tsx apps/api/src/scripts/fillVenueImages.ts --limit=50
 */

import 'dotenv/config';
import { Client as GoogleMapsClient } from '@googlemaps/google-maps-services-js';
import { isNull, or, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { venues } from '../db/schema.js';

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY ?? '';
const MAX_WIDTH = 1200;

function parseArgs(argv: string[]) {
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
const CITY_FILTER = args['city'] ? String(args['city']).toLowerCase() : null;
const LIMIT = args['limit'] ? Number(args['limit']) : 500;

function sleep(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)); }

async function main() {
    if (!GOOGLE_API_KEY) throw new Error('Missing GOOGLE_PLACES_API_KEY');

    console.log('\n📸  MatchWatch — Venue Image Filler');
    console.log('════════════════════════════════════════');
    console.log(`Mode:   ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
    console.log(`Filter: ${CITY_FILTER ?? 'all cities'}`);
    console.log(`Limit:  ${LIMIT}`);
    console.log('════════════════════════════════════════\n');

    const googleClient = new GoogleMapsClient({});

    // Load venues without cover images that have importedPlaceId
    const allVenues = await db.select({
        id: venues.id,
        name: venues.name,
        city: venues.city,
        coverImageUrl: venues.coverImageUrl,
        metadata: venues.metadata,
    }).from(venues)
        .where(
            or(
                isNull(venues.coverImageUrl),
                eq(venues.coverImageUrl, ''),
            )
        )
        .limit(LIMIT * 3); // over-fetch, filter below

    // Filter to only those with importedPlaceId and optionally by city
    const targets = allVenues.filter((v) => {
        const meta = v.metadata as Record<string, unknown> | null;
        if (!meta?.importedPlaceId) return false;
        if (CITY_FILTER && !v.city?.toLowerCase().includes(CITY_FILTER)) return false;
        return true;
    }).slice(0, LIMIT);

    console.log(`Venues needing images: ${targets.length}\n`);

    let updated = 0, failed = 0, skipped = 0;
    const byCityStats: Record<string, { updated: number; failed: number }> = {};

    for (const [i, venue] of targets.entries()) {
        const meta = venue.metadata as Record<string, unknown>;
        const placeId = meta.importedPlaceId as string;
        const cityKey = venue.city ?? 'Unknown';
        if (!byCityStats[cityKey]) byCityStats[cityKey] = { updated: 0, failed: 0 };

        process.stdout.write(`[${i + 1}/${targets.length}] ${venue.name} (${venue.city}) ... `);

        try {
            const res = await googleClient.placeDetails({
                params: {
                    place_id: placeId,
                    fields: ['photos'],
                    key: GOOGLE_API_KEY,
                },
            });

            const photos = res.data.result?.photos;
            if (!photos || photos.length === 0) {
                console.log('no photos on Google');
                byCityStats[cityKey].failed++;
                failed++;
                await sleep(100);
                continue;
            }

            // Pick the best photo (first one, highest resolution)
            const photoRef = photos[0].photo_reference;
            const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${MAX_WIDTH}&photoreference=${photoRef}&key=${GOOGLE_API_KEY}`;

            if (DRY_RUN) {
                console.log(`would set photo (ref: ${photoRef.slice(0, 30)}...)`);
                skipped++;
                await sleep(100);
                continue;
            }

            await db.update(venues)
                .set({ coverImageUrl: photoUrl })
                .where(eq(venues.id, venue.id));

            console.log(`✓ photo set`);
            byCityStats[cityKey].updated++;
            updated++;

        } catch (err) {
            console.log(`❌ ${(err as Error).message?.slice(0, 60)}`);
            byCityStats[cityKey].failed++;
            failed++;
        }

        // Rate limit: Places API allows 10 QPS, stay well under
        await sleep(120);
    }

    // Summary
    console.log('\n\n📸  COMPLETE');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`${'City'.padEnd(22)} ${'Updated'.padStart(8)} ${'Failed'.padStart(7)}`);
    console.log('─'.repeat(40));
    for (const [city, s] of Object.entries(byCityStats)) {
        if (s.updated + s.failed === 0) continue;
        console.log(`${city.padEnd(22)} ${String(s.updated).padStart(8)} ${String(s.failed).padStart(7)}`);
    }
    console.log('─'.repeat(40));
    console.log(`${'TOTAL'.padEnd(22)} ${String(updated).padStart(8)} ${String(failed).padStart(7)}`);
    console.log('═══════════════════════════════════════════════════════\n');

    if (DRY_RUN) console.log('⚠️  DRY RUN — nothing written.\n');
    else console.log(`✅  ${updated} venues now have cover images.\n`);
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('\n❌ Fatal:', (err as Error).message ?? err);
        process.exit(1);
    });
