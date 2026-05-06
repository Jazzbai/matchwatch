/**
 * importVenuesFromPlaces.ts
 *
 * Pipeline: Google Places API → Firecrawl → matchwatch DB
 *
 * Usage:
 *   tsx src/scripts/importVenuesFromPlaces.ts --city="Houston, TX" --type="sports_bar"
 *   tsx src/scripts/importVenuesFromPlaces.ts --city="Houston, TX" --type="beer_garden"
 *   tsx src/scripts/importVenuesFromPlaces.ts --city="Houston, TX" --type="sports_bar" --dry-run
 *   tsx src/scripts/importVenuesFromPlaces.ts --city="Houston, TX" --radius=10000 --max=50
 */

import 'dotenv/config';
import { Client, PlaceType2 } from '@googlemaps/google-maps-services-js';
import FirecrawlApp from '@mendable/firecrawl-js';
import { db } from '../db/client.js';
import { venues, users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

// ─── Config ─────────────────────────────────────────────────────────────────

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY ?? '';
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY ?? '';
const SYSTEM_OWNER_EMAIL = process.env.SYSTEM_OWNER_EMAIL ?? 'admin@matchwatch.us';

// Google Place types → our amenity/vibe slugs
const PLACE_TYPE_AMENITY_MAP: Record<string, string[]> = {
    bar:          ['BAR', 'ALCOHOLIC'],
    night_club:   ['BAR', 'ALCOHOLIC'],
    restaurant:   ['FOOD'],
    cafe:         ['FOOD', 'WIFI'],
    lodging:      ['WIFI', 'PARKING'],
};

const SEARCH_TYPE_AMENITY_MAP: Record<string, string[]> = {
    sports_bar:  ['SPORTS_BAR', 'TV', 'BIG_SCREEN', 'BAR', 'ALCOHOLIC', 'FOOD'],
    beer_garden: ['BEER_GARDEN', 'OUTDOOR', 'BAR', 'ALCOHOLIC', 'FOOD'],
    pub:         ['BAR', 'ALCOHOLIC', 'TV', 'FOOD'],
    bar:         ['BAR', 'ALCOHOLIC'],
};

const SEARCH_TYPE_VIBE_MAP: Record<string, string[]> = {
    sports_bar:  ['SPORTS_BAR', 'GAME_DAY', 'LIVELY'],
    beer_garden: ['BEER_GARDEN', 'CASUAL', 'LIVELY'],
    pub:         ['NEIGHBORHOOD', 'CASUAL'],
    bar:         ['LIVELY'],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(name: string, city: string): string {
    const base = `${name} ${city}`
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 180);
    const suffix = Math.random().toString(36).slice(2, 7);
    return `${base}-${suffix}`;
}

function priceRangeFromLevel(level?: number): 'BUDGET' | 'MID' | 'UPSCALE' | 'LUXURY' {
    if (level === undefined || level === null) return 'MID';
    if (level <= 1) return 'BUDGET';
    if (level === 2) return 'MID';
    if (level === 3) return 'UPSCALE';
    return 'LUXURY';
}

function dedupeAmenities(...arrays: string[][]): string[] {
    return [...new Set(arrays.flat())];
}

function parseArgs(argv: string[]) {
    const args: Record<string, string | boolean> = {};
    for (const raw of argv) {
        if (!raw.startsWith('--')) continue;
        const [key, value] = raw.slice(2).split('=', 2);
        args[key] = value ?? true;
    }
    return args;
}

// ─── Google Places ───────────────────────────────────────────────────────────

interface PlaceResult {
    placeId: string;
    name: string;
    address: string;
    city: string;
    lat: number;
    lng: number;
    phone?: string;
    website?: string;
    rating?: number;
    priceLevel?: number;
    types: string[];
    photoRef?: string;
    openNow?: boolean;
}

async function searchPlaces(
    client: Client,
    query: string,
    city: string,
    radiusMeters: number,
    maxResults: number,
): Promise<PlaceResult[]> {
    // Step 1: geocode the city to get lat/lng centre
    const geocodeRes = await client.geocode({
        params: { address: city, key: GOOGLE_API_KEY },
    });

    if (!geocodeRes.data.results.length) {
        throw new Error(`Could not geocode city: ${city}`);
    }

    const { lat, lng } = geocodeRes.data.results[0].geometry.location;
    console.log(`  📍 Searching near ${city} (${lat}, ${lng}) radius ${radiusMeters}m`);

    // Step 2: Nearby Search
    const results: PlaceResult[] = [];
    let pageToken: string | undefined;

    do {
        const nearbyRes = await client.placesNearby({
            params: {
                location: { lat, lng },
                radius: radiusMeters,
                keyword: query,
                type: 'bar',
                key: GOOGLE_API_KEY,
                ...(pageToken ? { pagetoken: pageToken } : {}),
            },
        });

        if (nearbyRes.data.status !== 'OK' && nearbyRes.data.status !== 'ZERO_RESULTS') {
            console.error('  ⚠️  Places API status:', nearbyRes.data.status);
            break;
        }

        for (const place of nearbyRes.data.results) {
            if (!place.place_id || !place.name) continue;

            // Extract city from vicinity (last part after last comma)
            const vicinity = place.vicinity ?? '';
            const cityGuess = vicinity.split(',').pop()?.trim() ?? city.split(',')[0].trim();

            results.push({
                placeId: place.place_id,
                name: place.name,
                address: vicinity,
                city: cityGuess,
                lat: place.geometry?.location.lat ?? 0,
                lng: place.geometry?.location.lng ?? 0,
                rating: place.rating,
                priceLevel: place.price_level,
                types: place.types ?? [],
                photoRef: place.photos?.[0]?.photo_reference,
                openNow: place.opening_hours?.open_now,
            });

            if (results.length >= maxResults) break;
        }

        pageToken = nearbyRes.data.next_page_token;

        // Google requires short wait before using next_page_token
        if (pageToken && results.length < maxResults) {
            await new Promise((r) => setTimeout(r, 2000));
        }
    } while (pageToken && results.length < maxResults);

    return results;
}

async function enrichWithPlaceDetails(client: Client, placeId: string): Promise<{
    phone?: string;
    website?: string;
    addressComponents?: { long_name: string; types: string[] }[];
}> {
    try {
        const detailRes = await client.placeDetails({
            params: {
                place_id: placeId,
                fields: ['formatted_phone_number', 'website', 'address_components'],
                key: GOOGLE_API_KEY,
            },
        });
        const result = detailRes.data.result;
        return {
            phone: result.formatted_phone_number,
            website: result.website,
            addressComponents: result.address_components as any,
        };
    } catch {
        return {};
    }
}

// ─── Firecrawl Enrichment ────────────────────────────────────────────────────

interface ScrapedVenueData {
    description?: string;
    hasMenuPage?: boolean;
    mentionsBigScreen?: boolean;
    mentionsSportsBar?: boolean;
    mentionsBeerGarden?: boolean;
    mentionsOutdoor?: boolean;
    mentionsLiveMusic?: boolean;
    mentionsHookah?: boolean;
    mentionsPrivateRoom?: boolean;
    mentionsParking?: boolean;
    socialLinks?: { instagram?: string };
}

async function scrapeVenueWebsite(
    firecrawl: FirecrawlApp,
    url: string,
    venueName: string,
): Promise<ScrapedVenueData> {
    try {
        console.log(`    🕷  Scraping ${url}`);
        const result = await firecrawl.scrape(url, {
            formats: ['markdown'],
            onlyMainContent: true,
        }) as { markdown?: string };

        if (!result.markdown) return {};

        const md = result.markdown.toLowerCase();

        // Extract description: first paragraph-like content mentioning the venue name
        const nameToken = venueName.toLowerCase().split(' ')[0];
        const sentences = result.markdown
            .replace(/#+\s/g, '')
            .split(/[.\n]/)
            .map((s: string) => s.trim())
            .filter((s: string) => s.length > 40 && s.length < 400);

        const descSentence = sentences.find((s: string) =>
            s.toLowerCase().includes(nameToken) ||
            s.toLowerCase().includes('sports bar') ||
            s.toLowerCase().includes('beer garden') ||
            s.toLowerCase().includes('watch party') ||
            s.toLowerCase().includes('watch the game'),
        );

        // Instagram handle
        const igMatch = result.markdown.match(/instagram\.com\/([a-z0-9_.]+)/i);

        return {
            description: descSentence,
            hasMenuPage: md.includes('menu') || md.includes('food'),
            mentionsBigScreen: md.includes('big screen') || md.includes('large screen') || md.includes('giant screen') || md.includes('hd screen'),
            mentionsSportsBar: md.includes('sports bar') || md.includes('sportsbar'),
            mentionsBeerGarden: md.includes('beer garden') || md.includes('biergarten') || md.includes('beer garden'),
            mentionsOutdoor: md.includes('outdoor') || md.includes('patio') || md.includes('terrace') || md.includes('rooftop'),
            mentionsLiveMusic: md.includes('live music') || md.includes('live band'),
            mentionsHookah: md.includes('hookah') || md.includes('shisha'),
            mentionsPrivateRoom: md.includes('private room') || md.includes('private event') || md.includes('private dining'),
            mentionsParking: md.includes('parking') || md.includes('valet'),
            socialLinks: { instagram: igMatch?.[1] },
        };
    } catch (err) {
        console.log(`    ⚠️  Scrape failed: ${(err as Error).message}`);
        return {};
    }
}

function buildAmenitiesFromScrape(
    scraped: ScrapedVenueData,
    baseAmenities: string[],
): string[] {
    const extra: string[] = [];
    if (scraped.mentionsBigScreen) extra.push('BIG_SCREEN');
    if (scraped.mentionsSportsBar) extra.push('SPORTS_BAR');
    if (scraped.mentionsBeerGarden) extra.push('BEER_GARDEN', 'OUTDOOR');
    if (scraped.mentionsOutdoor) extra.push('OUTDOOR');
    if (scraped.mentionsLiveMusic) extra.push('LIVE_MUSIC');
    if (scraped.mentionsHookah) extra.push('HOOKAH');
    if (scraped.mentionsPrivateRoom) extra.push('PRIVATE_ROOM');
    if (scraped.mentionsParking) extra.push('PARKING');
    if (scraped.hasMenuPage) extra.push('FOOD');
    return dedupeAmenities(baseAmenities, extra);
}

// ─── DB Insert ───────────────────────────────────────────────────────────────

async function getSystemOwner(): Promise<string> {
    const [owner] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, SYSTEM_OWNER_EMAIL))
        .limit(1);

    if (!owner) throw new Error(`System owner not found: ${SYSTEM_OWNER_EMAIL}`);
    return owner.id;
}

async function insertVenue(params: {
    ownerId: string;
    name: string;
    slug: string;
    address: string;
    city: string;
    country: string;
    lat: number;
    lng: number;
    phone?: string;
    website?: string;
    instagramHandle?: string;
    description?: string;
    amenities: string[];
    cuisineTags: string[];
    priceRange: 'BUDGET' | 'MID' | 'UPSCALE' | 'LUXURY';
    averageRating?: number;
}): Promise<string> {
    const [row] = await db.insert(venues).values({
        ownerId: params.ownerId,
        name: params.name,
        slug: params.slug,
        addressLine1: params.address,
        city: params.city,
        country: params.country,
        timezone: 'America/Chicago', // default; improve with timezone API if needed
        lat: String(params.lat),
        lng: String(params.lng),
        phone: params.phone,
        website: params.website,
        instagramHandle: params.instagramHandle,
        description: params.description ?? null,
        shortDescription: params.description ? params.description.slice(0, 280) : null,
        amenities: params.amenities,
        cuisineTags: params.cuisineTags,
        priceRange: params.priceRange,
        averageRating: params.averageRating ? String(params.averageRating) : '0',
        isVerified: false,
        isActive: true,
        isFeatured: false,
        approvalStatus: 'APPROVED',
        approvedAt: new Date(),
        metadata: { importedFrom: 'google_places', importedAt: new Date().toISOString() },
    }).returning({ id: venues.id });

    return row.id;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    const args = parseArgs(process.argv.slice(2));

    const city = String(args.city ?? 'Houston, TX');
    const searchType = String(args.type ?? 'sports_bar'); // sports_bar | beer_garden | pub | bar
    const radiusMeters = Number(args.radius ?? 8000);
    const maxResults = Number(args.max ?? 20);
    const dryRun = Boolean(args['dry-run']);
    const skipScrape = Boolean(args['skip-scrape']);

    console.log('\n🏟  MatchWatch — Venue Import Pipeline');
    console.log('─────────────────────────────────────────');
    console.log(`City:      ${city}`);
    console.log(`Type:      ${searchType}`);
    console.log(`Radius:    ${radiusMeters}m`);
    console.log(`Max:       ${maxResults}`);
    console.log(`Dry run:   ${dryRun}`);
    console.log(`Scraping:  ${!skipScrape}`);
    console.log('─────────────────────────────────────────\n');

    if (!GOOGLE_API_KEY) throw new Error('Missing GOOGLE_PLACES_API_KEY in .env');
    if (!FIRECRAWL_API_KEY && !skipScrape) {
        console.warn('⚠️  FIRECRAWL_API_KEY not set — website scraping will be skipped');
    }

    const googleClient = new Client({});
    const firecrawl = FIRECRAWL_API_KEY ? new FirecrawlApp({ apiKey: FIRECRAWL_API_KEY }) : null;

    // ── Step 1: Google Places search ─────────────────────────────────────────
    console.log(`🔍 Step 1: Searching Google Places for "${searchType}" in ${city}...`);
    const places = await searchPlaces(googleClient, searchType.replace('_', ' '), city, radiusMeters, maxResults);
    console.log(`   Found ${places.length} places\n`);

    const ownerId = dryRun ? 'dry-run' : await getSystemOwner();
    const baseAmenities = SEARCH_TYPE_AMENITY_MAP[searchType] ?? ['TV', 'BAR'];
    const baseVibes = SEARCH_TYPE_VIBE_MAP[searchType] ?? ['LIVELY'];
    const results: { name: string; status: 'inserted' | 'skipped' | 'error'; id?: string; reason?: string }[] = [];

    for (const [i, place] of places.entries()) {
        console.log(`\n[${i + 1}/${places.length}] ${place.name}`);
        console.log(`   📍 ${place.address}`);
        console.log(`   ⭐ ${place.rating ?? 'n/a'}  💰 ${'$'.repeat(place.priceLevel ?? 1)}`);

        // ── Step 2: Place Details (phone + website) ───────────────────────
        const details = await enrichWithPlaceDetails(googleClient, place.placeId);
        const website = details.website ?? place.website;
        console.log(`   🌐 ${website ?? 'no website'}`);
        console.log(`   📞 ${details.phone ?? 'no phone'}`);

        // ── Step 3: Firecrawl website scrape ──────────────────────────────
        let scraped: ScrapedVenueData = {};
        if (firecrawl && !skipScrape && website) {
            scraped = await scrapeVenueWebsite(firecrawl, website, place.name);
            console.log(`   🕷  Scraped: bigScreen=${scraped.mentionsBigScreen} outdoor=${scraped.mentionsOutdoor} description=${scraped.description ? 'yes' : 'no'}`);
        }

        // ── Step 4: Build final amenity list ──────────────────────────────
        // Pull amenities from: base type + Google place types + Firecrawl scrape
        const fromGoogleTypes = place.types.flatMap((t) => PLACE_TYPE_AMENITY_MAP[t] ?? []);
        const amenities = buildAmenitiesFromScrape(
            scraped,
            dedupeAmenities(baseAmenities, fromGoogleTypes, baseVibes),
        );

        const slug = slugify(place.name, place.city);
        const priceRange = priceRangeFromLevel(place.priceLevel);
        const country = 'US'; // improve: extract from address_components

        console.log(`   🏷  Amenities: ${amenities.join(', ')}`);
        console.log(`   🔗 Slug: ${slug}`);

        if (dryRun) {
            console.log(`   ✅ [DRY RUN] Would insert`);
            results.push({ name: place.name, status: 'skipped', reason: 'dry-run' });
            continue;
        }

        // ── Step 5: Insert into DB ────────────────────────────────────────
        try {
            const id = await insertVenue({
                ownerId,
                name: place.name,
                slug,
                address: place.address,
                city: place.city,
                country,
                lat: place.lat,
                lng: place.lng,
                phone: details.phone,
                website,
                instagramHandle: scraped.socialLinks?.instagram,
                description: scraped.description,
                amenities,
                cuisineTags: ['AMERICAN'], // default; improve with scrape
                priceRange,
                averageRating: place.rating,
            });
            console.log(`   ✅ Inserted → ${id}`);
            results.push({ name: place.name, status: 'inserted', id });
        } catch (err) {
            const msg = (err as Error).message;
            console.log(`   ❌ Error: ${msg}`);
            results.push({ name: place.name, status: 'error', reason: msg });
        }

        // Be polite to APIs
        await new Promise((r) => setTimeout(r, 500));
    }

    // ── Summary ───────────────────────────────────────────────────────────
    console.log('\n─────────────────────────────────────────');
    console.log('📊 Summary');
    const inserted = results.filter((r) => r.status === 'inserted').length;
    const errors = results.filter((r) => r.status === 'error').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;
    console.log(`   ✅ Inserted: ${inserted}`);
    console.log(`   ⚠️  Errors:  ${errors}`);
    console.log(`   ⏭  Skipped: ${skipped}`);
    console.log('─────────────────────────────────────────\n');

    if (errors) {
        console.log('Errors:');
        results.filter((r) => r.status === 'error').forEach((r) => console.log(`  ${r.name}: ${r.reason}`));
    }
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err instanceof Error ? err.message : err);
        process.exit(1);
    });
