/**
 * enrichVenuesFromGoogle.ts
 *
 * For every venue imported by the crawler (has metadata.importedPlaceId):
 *   1. Calls Google Place Details to fetch:
 *        - editorial_summary  → stored as venue description
 *        - photos (up to 5)   → Google photo URLs stored in coverImageUrl + metadata.galleryUrls
 *        - rating, user_ratings_total → refreshes averageRating
 *   2. Updates the venues row in DB
 *
 * Google Photo URL format (no download needed, serves directly):
 *   https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photoreference=REF&key=KEY
 *
 * Usage:
 *   npx tsx src/scripts/enrichVenuesFromGoogle.ts
 *   npx tsx src/scripts/enrichVenuesFromGoogle.ts --dry-run
 *   npx tsx src/scripts/enrichVenuesFromGoogle.ts --limit=10
 */

import 'dotenv/config';
import { Client as GoogleMapsClient } from '@googlemaps/google-maps-services-js';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { venues } from '../db/schema.js';

// ─── Config ───────────────────────────────────────────────────────────────────

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY ?? '';
const PHOTO_MAX_WIDTH = 1200;
const MAX_PHOTOS_PER_VENUE = 5;

function parseArgs(argv: string[]): Record<string, string | boolean> {
    const out: Record<string, string | boolean> = {};
    for (const raw of argv) {
        if (!raw.startsWith('--')) continue;
        const [k, v] = raw.slice(2).split('=', 2);
        out[k] = v ?? true;
    }
    return out;
}

const cliArgs = parseArgs(process.argv.slice(2));
const DRY_RUN = Boolean(cliArgs['dry-run']);
const LIMIT = cliArgs['limit'] ? Number(cliArgs['limit']) : undefined;

function sleep(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)); }

// ─── Google Photo URL Builder ─────────────────────────────────────────────────

function buildPhotoUrl(photoReference: string, maxWidth = PHOTO_MAX_WIDTH): string {
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${GOOGLE_API_KEY}`;
}

// ─── Place Details Fetcher ────────────────────────────────────────────────────

interface PlaceEnrichment {
    description?: string;
    coverImageUrl?: string;
    galleryUrls: string[];
    rating?: number;
    totalReviews?: number;
}

async function fetchPlaceEnrichment(
    googleClient: GoogleMapsClient,
    placeId: string,
): Promise<PlaceEnrichment> {
    const res = await googleClient.placeDetails({
        params: {
            place_id: placeId,
            fields: [
                'editorial_summary',
                'photos',
                'rating',
                'user_ratings_total',
                'name',
            ],
            key: GOOGLE_API_KEY,
        },
    });

    const result = res.data.result;
    if (!result) return { galleryUrls: [] };

    // Description from editorial_summary
    const description = (result as any).editorial_summary?.overview as string | undefined;

    // Photos → build Google photo URLs (no download, serve directly)
    const photoRefs: string[] = ((result.photos ?? []) as any[])
        .slice(0, MAX_PHOTOS_PER_VENUE)
        .map((p: any) => p.photo_reference)
        .filter(Boolean);

    const photoUrls = photoRefs.map((ref) => buildPhotoUrl(ref));
    const coverImageUrl = photoUrls[0];
    const galleryUrls = photoUrls.slice(1);

    return {
        description,
        coverImageUrl,
        galleryUrls,
        rating: result.rating,
        totalReviews: (result as any).user_ratings_total,
    };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    if (!GOOGLE_API_KEY) throw new Error('Missing GOOGLE_PLACES_API_KEY in .env');

    console.log('\n📸  MatchWatch — Google Business Enrichment');
    console.log('════════════════════════════════════════════');
    console.log(`Mode:    ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
    console.log(`Photos:  up to ${MAX_PHOTOS_PER_VENUE} per venue (Google Places URLs)`);
    if (LIMIT) console.log(`Limit:   ${LIMIT} venues`);
    console.log('════════════════════════════════════════════\n');

    // Load all imported venues that have a Google place ID
    const allVenues = await db
        .select({
            id: venues.id,
            name: venues.name,
            city: venues.city,
            metadata: venues.metadata,
            description: venues.description,
            coverImageUrl: venues.coverImageUrl,
        })
        .from(venues)
        .where(sql`metadata->>'importedPlaceId' IS NOT NULL`);

    const toEnrich = LIMIT ? allVenues.slice(0, LIMIT) : allVenues;
    console.log(`Found ${allVenues.length} imported venues — enriching ${toEnrich.length}\n`);

    const googleClient = new GoogleMapsClient({});

    let enriched = 0;
    let noDescription = 0;
    let noPhotos = 0;
    let errors = 0;

    for (const [i, venue] of toEnrich.entries()) {
        const meta = venue.metadata as Record<string, unknown>;
        const placeId = meta?.importedPlaceId as string;

        process.stdout.write(`[${i + 1}/${toEnrich.length}] ${venue.name} (${venue.city}) ... `);

        let enrichment: PlaceEnrichment;
        try {
            enrichment = await fetchPlaceEnrichment(googleClient, placeId);
        } catch (err) {
            console.log(`❌ API error: ${(err as Error).message.slice(0, 80)}`);
            errors++;
            await sleep(500);
            continue;
        }

        const hasDesc = Boolean(enrichment.description);
        const photoCount = (enrichment.coverImageUrl ? 1 : 0) + enrichment.galleryUrls.length;

        console.log(
            `${hasDesc ? '📝' : '—'} desc  ${photoCount > 0 ? `📸 ${photoCount} photos` : '— no photos'}  ⭐ ${enrichment.rating ?? 'n/a'}`,
        );

        if (!hasDesc) noDescription++;
        if (photoCount === 0) noPhotos++;

        if (DRY_RUN) { enriched++; await sleep(200); continue; }

        // Build updated metadata preserving existing fields
        const updatedMeta = {
            ...meta,
            galleryUrls: enrichment.galleryUrls,
            googleEnrichedAt: new Date().toISOString(),
            ...(enrichment.totalReviews !== undefined && { googleTotalReviews: enrichment.totalReviews }),
        };

        try {
            await db
                .update(venues)
                .set({
                    description: enrichment.description ?? venue.description ?? null,
                    shortDescription: enrichment.description
                        ? enrichment.description.slice(0, 280)
                        : undefined,
                    coverImageUrl: enrichment.coverImageUrl ?? venue.coverImageUrl ?? null,
                    averageRating: enrichment.rating !== undefined
                        ? String(enrichment.rating)
                        : undefined,
                    totalReviews: enrichment.totalReviews ?? undefined,
                    metadata: updatedMeta,
                    updatedAt: new Date(),
                })
                .where(eq(venues.id, venue.id));
            enriched++;
        } catch (err) {
            console.log(`  ❌ DB update failed: ${(err as Error).message.slice(0, 80)}`);
            errors++;
        }

        // Respect Google Places API rate limit (~10 req/s)
        await sleep(150);
    }

    // ── Summary ──────────────────────────────────────────────────────────────
    console.log('\n════════════════════════════════════════════');
    console.log('📊  ENRICHMENT COMPLETE');
    console.log('════════════════════════════════════════════');
    console.log(`✅  Enriched:          ${enriched}`);
    console.log(`📝  No description:    ${noDescription} (not all venues have editorial summary)`);
    console.log(`📸  No photos:         ${noPhotos}`);
    console.log(`❌  Errors:            ${errors}`);
    console.log('════════════════════════════════════════════\n');

    if (DRY_RUN) console.log('⚠️  DRY RUN — nothing written to DB.\n');
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('\n❌ Fatal:', err instanceof Error ? err.message : err);
        process.exit(1);
    });
