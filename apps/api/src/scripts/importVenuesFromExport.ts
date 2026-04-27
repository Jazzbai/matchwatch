import 'dotenv/config';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { db } from '../db/client.js';
import { venues, users } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';

const SYSTEM_OWNER_EMAIL = process.env.SYSTEM_OWNER_EMAIL ?? 'admin@matchwatch.us';
const EXPORT_PATH = resolve(process.cwd(), 'venues-export.json');

interface ExportVenue {
    id: string;
    name: string;
    slug: string;
    address: {
        line1: string;
        line2: string | null;
        city: string;
        state: string;
        country: string;
        postalCode: string | null;
        lat: string;
        lng: string;
        timezone: string;
    };
    owner: { email: string; name: string };
    phone: string | null;
    website: string | null;
    description: string | null;
    shortDescription: string | null;
    coverImageUrl: string | null;
    galleryImageUrls: string[];
    amenities: string[];
    cuisineTags: string[];
    priceRange: 'BUDGET' | 'MID' | 'UPSCALE' | 'LUXURY';
    capacity: number | null;
    averageRating: string;
    totalReviews: number;
    isVerified: boolean;
    isActive: boolean;
    googlePlaceId: string | null;
}

// Vibes that should go in the vibes column, not amenities
const VIBE_TAGS = new Set(['SPORTS_BAR', 'BEER_GARDEN', 'GAME_DAY', 'LIVELY', 'CASUAL', 'NEIGHBORHOOD', 'SOCCER', 'WATCH_PARTY', 'ROOFTOP', 'LIVE_MUSIC']);

function splitAmenitiesVibes(tags: string[]): { amenities: string[]; vibes: string[] } {
    const amenities: string[] = [];
    const vibes: string[] = [];
    for (const tag of tags) {
        if (VIBE_TAGS.has(tag)) vibes.push(tag);
        else amenities.push(tag);
    }
    return { amenities, vibes };
}

async function main() {
    const exportData: ExportVenue[] = JSON.parse(readFileSync(EXPORT_PATH, 'utf8'));
    console.log(`📂 Loaded ${exportData.length} venues from export`);

    // Get system owner
    const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.email, SYSTEM_OWNER_EMAIL)).limit(1);
    if (!owner) throw new Error(`System owner not found: ${SYSTEM_OWNER_EMAIL}`);
    console.log(`👤 System owner: ${owner.id}`);

    // Find existing slugs to skip duplicates
    const slugs = exportData.map(v => v.slug);
    const existingRows = await db.select({ slug: venues.slug }).from(venues).where(inArray(venues.slug, slugs));
    const existingSlugs = new Set(existingRows.map(r => r.slug));
    console.log(`⏭  Skipping ${existingSlugs.size} already-existing venues`);

    const toInsert = exportData.filter(v => !existingSlugs.has(v.slug));
    console.log(`⬆️  Inserting ${toInsert.length} new venues...\n`);

    let inserted = 0;
    let failed = 0;

    for (const v of toInsert) {
        try {
            const { amenities, vibes } = splitAmenitiesVibes(v.amenities);
            await db.insert(venues).values({
                ownerId: owner.id,
                name: v.name,
                slug: v.slug,
                description: v.description ?? null,
                shortDescription: v.shortDescription ?? null,
                addressLine1: v.address.line1,
                addressLine2: v.address.line2 ?? null,
                city: v.address.city,
                stateProvince: v.address.state ?? null,
                country: v.address.country,
                postalCode: v.address.postalCode ?? null,
                lat: v.address.lat,
                lng: v.address.lng,
                timezone: v.address.timezone,
                phone: v.phone ?? null,
                website: v.website ?? null,
                coverImageUrl: v.coverImageUrl ?? null,
                amenities,
                vibes,
                cuisineTags: v.cuisineTags,
                priceRange: v.priceRange,
                capacity: v.capacity ?? null,
                averageRating: v.averageRating,
                ratingOverride: v.averageRating,
                totalReviews: v.totalReviews,
                reviewCountOverride: v.totalReviews,
                isVerified: v.isVerified,
                isActive: true,
                isFeatured: false,
                googlePlaceId: v.googlePlaceId ?? null,
                approvalStatus: 'APPROVED',
                approvedAt: new Date(),
                metadata: { importedFrom: 'venues-export.json', importedAt: new Date().toISOString() },
            });
            console.log(`  ✅ ${v.name} (${v.address.city})`);
            inserted++;
        } catch (err) {
            console.error(`  ❌ ${v.name} — ${(err as Error).message}`);
            failed++;
        }
    }

    console.log(`\n🏁 Done. ${inserted} inserted, ${failed} failed, ${existingSlugs.size} skipped.`);

    // Summary by city
    const cityGroups: Record<string, number> = {};
    for (const v of toInsert) {
        cityGroups[v.address.city] = (cityGroups[v.address.city] ?? 0) + 1;
    }
    console.log('\nBy city:');
    for (const [city, count] of Object.entries(cityGroups).sort()) {
        console.log(`  ${city}: ${count}`);
    }

    process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
