/**
 * crawlSoccerWatchPartyVenues.ts
 *
 * Three-phase pipeline:
 *   Phase 1 — Firecrawl CLI search: discover soccer watch party venue names
 *             by running web searches per city via `npx firecrawl-cli search`
 *   Phase 2 — Firecrawl CLI scrape + Google Places: validate each name against
 *             Google Places to get official lat/lng, address, phone, rating
 *   Phase 3 — DB import: insert into venues table (skip duplicates by place_id)
 *
 * Usage (from apps/api/):
 *   npx tsx src/scripts/crawlSoccerWatchPartyVenues.ts
 *   npx tsx src/scripts/crawlSoccerWatchPartyVenues.ts --dry-run
 *   npx tsx src/scripts/crawlSoccerWatchPartyVenues.ts --city="Houston" --dry-run
 *   npx tsx src/scripts/crawlSoccerWatchPartyVenues.ts --skip-scrape
 */

import 'dotenv/config';
import { execSync } from 'child_process';
import { Client as GoogleMapsClient, PlaceInputType } from '@googlemaps/google-maps-services-js';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { venues, users } from '../db/schema.js';

// ─── City Targets ─────────────────────────────────────────────────────────────

interface CityTarget {
    name: string;
    searchQuery: string;   // for Google Places disambiguation
    timezone: string;
    state: string;
    country: string;
}

const MLS_CITIES: CityTarget[] = [
    { name: 'Atlanta',       searchQuery: 'Atlanta, GA',       timezone: 'America/New_York',    state: 'GA', country: 'US' },
    { name: 'Boston',        searchQuery: 'Boston, MA',        timezone: 'America/New_York',    state: 'MA', country: 'US' },
    { name: 'Dallas',        searchQuery: 'Dallas, TX',        timezone: 'America/Chicago',     state: 'TX', country: 'US' },
    { name: 'Houston',       searchQuery: 'Houston, TX',       timezone: 'America/Chicago',     state: 'TX', country: 'US' },
    { name: 'Kansas City',   searchQuery: 'Kansas City, MO',   timezone: 'America/Chicago',     state: 'MO', country: 'US' },
    { name: 'Los Angeles',   searchQuery: 'Los Angeles, CA',   timezone: 'America/Los_Angeles', state: 'CA', country: 'US' },
    { name: 'Miami',         searchQuery: 'Miami, FL',         timezone: 'America/New_York',    state: 'FL', country: 'US' },
    { name: 'New York',      searchQuery: 'New York, NY',      timezone: 'America/New_York',    state: 'NY', country: 'US' },
    { name: 'Philadelphia',  searchQuery: 'Philadelphia, PA',  timezone: 'America/New_York',    state: 'PA', country: 'US' },
    { name: 'San Francisco', searchQuery: 'San Francisco, CA', timezone: 'America/Los_Angeles', state: 'CA', country: 'US' },
    { name: 'Seattle',       searchQuery: 'Seattle, WA',       timezone: 'America/Los_Angeles', state: 'WA', country: 'US' },
];

// Search queries sent to `firecrawl-cli search` per city (2 queries keeps it focused)
function buildSearchQueries(city: CityTarget): string[] {
    return [
        `best soccer watch party bars in ${city.name}`,
        `futbol bar supporters watch party ${city.name}`,
    ];
}

// ─── Amenities ────────────────────────────────────────────────────────────────

const BASE_AMENITIES = ['TV', 'BIG_SCREEN', 'BAR', 'ALCOHOLIC', 'FOOD', 'SPORTS_BAR', 'SOCCER', 'WATCH_PARTY'];
const BASE_VIBES = ['SPORTS_BAR', 'GAME_DAY', 'LIVELY'];

// ─── Config & CLI Args ────────────────────────────────────────────────────────

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY ?? '';
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY ?? '';
const SYSTEM_OWNER_EMAIL = process.env.SYSTEM_OWNER_EMAIL ?? 'admin@matchwatch.us';

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
const SKIP_SCRAPE = Boolean(cliArgs['skip-scrape']);
const CITY_FILTER = cliArgs['city'] ? String(cliArgs['city']).toLowerCase() : null;
const MAX_TOTAL = Number(cliArgs['max-total'] ?? 50);
const MAX_PER_CITY = Math.ceil(MAX_TOTAL / MLS_CITIES.length); // ~5 per city

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)); }

function slugify(name: string, city: string): string {
    const base = `${name} ${city}`
        .toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim()
        .replace(/\s+/g, '-').slice(0, 180);
    return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

function priceRangeFromLevel(level?: number): 'BUDGET' | 'MID' | 'UPSCALE' | 'LUXURY' {
    if (!level) return 'MID';
    if (level <= 1) return 'BUDGET';
    if (level === 2) return 'MID';
    if (level === 3) return 'UPSCALE';
    return 'LUXURY';
}

function dedupeArr(...arrays: string[][]): string[] {
    return [...new Set(arrays.flat())];
}

// ─── Firecrawl CLI Wrappers ───────────────────────────────────────────────────

interface FirecrawlSearchResult {
    url: string;
    title?: string;
    description?: string;
    markdown?: string;
}

/**
 * Run `npx firecrawl-cli search "<query>" --format json`
 * Returns parsed results or [] on failure.
 */
function firecrawlSearch(query: string, limit = 10): FirecrawlSearchResult[] {
    try {
        const q = query.replace(/"/g, "'");
        const cmd = `npx firecrawl-cli --api-key ${FIRECRAWL_API_KEY} search "${q}" --limit ${limit} --scrape --scrape-formats markdown --only-main-content --json`;
        const output = execSync(cmd, { timeout: 90_000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        const parsed = JSON.parse(output);
        // CLI returns { success: true, data: { web: [...] } }
        if (Array.isArray(parsed?.data?.web)) return parsed.data.web;
        if (Array.isArray(parsed?.data)) return parsed.data;
        if (Array.isArray(parsed)) return parsed;
        return [];
    } catch {
        return [];
    }
}

/**
 * Run `npx firecrawl-cli scrape "<url>" --format markdown`
 * Returns markdown text or '' on failure.
 */
function firecrawlScrape(url: string): string {
    try {
        const cmd = `npx firecrawl-cli --api-key ${FIRECRAWL_API_KEY} scrape "${url}" --formats markdown --only-main-content --json`;
        const output = execSync(cmd, { timeout: 60_000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        try {
            const parsed = JSON.parse(output);
            return parsed?.markdown ?? parsed?.data?.markdown ?? parsed?.[0]?.markdown ?? '';
        } catch {
            return output;
        }
    } catch {
        return '';
    }
}

// ─── Phase 1: Name Extraction from Search Results ────────────────────────────

const NOISE_WORDS = [
    'click here', 'read more', 'sign up', 'learn more', 'see more', 'view all',
    'home', 'menu', 'contact', 'about', 'search', 'filter', 'sort by',
    'results for', 'showing', 'page', 'next', 'prev', 'categories',
    'reviews', 'photos', 'map', 'directions', 'open now',
];

function isLikelyVenueName(candidate: string, cityName: string): boolean {
    const lower = candidate.toLowerCase();
    if (NOISE_WORDS.some((w) => lower.includes(w))) return false;
    if (lower.trim() === cityName.toLowerCase()) return false;
    if (/^\d{4}/.test(candidate)) return false;         // year like "2024 best..."
    if (candidate.length < 3 || candidate.length > 80) return false;
    if (/^\d+$/.test(candidate)) return false;           // all numbers
    return true;
}

function extractVenueNamesFromText(text: string, cityName: string): string[] {
    const names = new Set<string>();
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

    for (const line of lines) {
        // "1. Bar Name" or "1) Bar Name"
        const numbered = line.match(/^\d+[\.\)]\s+(.{3,80})$/);
        if (numbered) {
            const c = numbered[1].replace(/\*+/g, '').split(' - ')[0].split(' – ')[0].trim();
            if (isLikelyVenueName(c, cityName)) names.add(c);
            continue;
        }

        // **Bold Name** or __Bold Name__
        const bold = line.match(/\*{2}([^*]{3,80})\*{2}|_{2}([^_]{3,80})_{2}/);
        if (bold) {
            const c = (bold[1] ?? bold[2]).trim();
            if (isLikelyVenueName(c, cityName)) names.add(c);
            continue;
        }

        // ## Heading
        const heading = line.match(/^#{1,4}\s+(.{3,80})$/);
        if (heading) {
            const c = heading[1].trim();
            if (isLikelyVenueName(c, cityName)) names.add(c);
            continue;
        }

        // [Link Text](http...)
        const linkMatches = [...line.matchAll(/\[([^\]]{3,80})\]\(http/g)];
        for (const m of linkMatches) {
            const c = m[1].trim();
            if (isLikelyVenueName(c, cityName)) names.add(c);
        }
    }

    return [...names];
}

// ─── Phase 1: Discover Venue Names via Firecrawl CLI ─────────────────────────

interface DiscoveredVenue { name: string; sourceUrl: string; }

async function discoverVenueNames(city: CityTarget): Promise<Map<string, DiscoveredVenue>> {
    const discovered = new Map<string, DiscoveredVenue>();
    const queries = buildSearchQueries(city);

    for (const query of queries) {
        process.stdout.write(`    search: "${query}" ... `);

        const results = firecrawlSearch(query, 10);
        let newNames = 0;

        for (const item of results) {
            const textToScan = [item.title ?? '', item.description ?? '', item.markdown ?? ''].join('\n');
            const names = extractVenueNamesFromText(textToScan, city.name);

            for (const name of names) {
                const key = name.toLowerCase();
                if (!discovered.has(key)) {
                    discovered.set(key, { name, sourceUrl: item.url });
                    newNames++;
                }
            }

            // Also try scraping pages that look like "best bars in [city]" lists
            const urlLower = (item.url ?? '').toLowerCase();
            const isListPage = urlLower.includes('yelp') || urlLower.includes('tripadvisor') ||
                               urlLower.includes('timeout') || urlLower.includes('thrillist') ||
                               urlLower.includes('eater') || urlLower.includes('reddit');

            if (isListPage && item.url && !item.markdown) {
                process.stdout.write(`\n      scraping list page: ${item.url.slice(0, 70)} ... `);
                await sleep(500);
                const md = firecrawlScrape(item.url);
                if (md) {
                    const moreNames = extractVenueNamesFromText(md, city.name);
                    for (const name of moreNames) {
                        const key = name.toLowerCase();
                        if (!discovered.has(key)) {
                            discovered.set(key, { name, sourceUrl: item.url });
                            newNames++;
                        }
                    }
                    process.stdout.write(`${moreNames.length} names\n    `);
                } else {
                    process.stdout.write('no content\n    ');
                }
            }
        }

        console.log(`${results.length} results → ${newNames} new names`);
        await sleep(1000);
    }

    return discovered;
}

// ─── Phase 2: Google Places Validation ───────────────────────────────────────

interface ValidatedVenue {
    placeId: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    phone?: string;
    website?: string;
    rating?: number;
    priceLevel?: number;
    types: string[];
}

async function validateWithGooglePlaces(
    googleClient: GoogleMapsClient,
    venueName: string,
    city: CityTarget,
): Promise<ValidatedVenue | null> {
    try {
        const res = await googleClient.findPlaceFromText({
            params: {
                input: `${venueName} ${city.searchQuery}`,
                inputtype: PlaceInputType.textQuery,
                fields: ['place_id', 'name', 'geometry', 'formatted_address', 'types', 'rating', 'price_level'],
                key: GOOGLE_API_KEY,
            },
        });

        const place = res.data.candidates?.[0];
        if (!place?.place_id || !place.geometry?.location) return null;

        const detailRes = await googleClient.placeDetails({
            params: {
                place_id: place.place_id,
                fields: ['formatted_phone_number', 'website'],
                key: GOOGLE_API_KEY,
            },
        });

        return {
            placeId: place.place_id,
            name: place.name ?? venueName,
            address: place.formatted_address ?? '',
            lat: place.geometry.location.lat,
            lng: place.geometry.location.lng,
            phone: detailRes.data.result?.formatted_phone_number,
            website: detailRes.data.result?.website,
            rating: place.rating,
            priceLevel: (place as any).price_level,
            types: place.types ?? [],
        };
    } catch {
        return null;
    }
}

// ─── Phase 2b: Website Scrape for Amenities ──────────────────────────────────

interface ScrapedAmenities {
    description?: string;
    extra: string[];
    instagramHandle?: string;
}

function extractAmenitiesFromMarkdown(md: string, venueName: string): ScrapedAmenities {
    const lower = md.toLowerCase();
    const extra: string[] = [];

    if (lower.includes('soccer') || lower.includes('futbol') || lower.includes('mls') || lower.includes('premier league')) extra.push('SOCCER');
    if (lower.includes('watch party') || lower.includes('watch the game') || lower.includes('watch the match')) extra.push('WATCH_PARTY');
    if (lower.includes('big screen') || lower.includes('large screen') || lower.includes('projection')) extra.push('BIG_SCREEN');
    if (lower.includes('outdoor') || lower.includes('patio') || lower.includes('rooftop')) extra.push('OUTDOOR');
    if (lower.includes('hookah') || lower.includes('shisha')) extra.push('HOOKAH');
    if (lower.includes('private room') || lower.includes('event space')) extra.push('PRIVATE_ROOM');
    if (lower.includes('parking') || lower.includes('valet')) extra.push('PARKING');
    if (lower.includes('live music') || lower.includes('live band')) extra.push('LIVE_MUSIC');
    if (lower.includes('happy hour')) extra.push('HAPPY_HOUR');
    if (lower.includes('wifi') || lower.includes('wi-fi')) extra.push('WIFI');
    if (lower.includes('vip')) extra.push('VIP');

    const igMatch = md.match(/instagram\.com\/([a-z0-9_.]+)/i);

    const sentences = md.replace(/#+\s/g, '').split(/[.\n]/)
        .map((s) => s.trim()).filter((s) => s.length > 40 && s.length < 400);
    const nameToken = venueName.toLowerCase().split(' ')[0];
    const descSentence = sentences.find((s) => {
        const sl = s.toLowerCase();
        return sl.includes('soccer') || sl.includes('watch party') || sl.includes('sports bar') ||
               sl.includes('futbol') || sl.includes(nameToken);
    });

    return { description: descSentence, extra, instagramHandle: igMatch?.[1] };
}

// ─── Phase 3: DB Import ───────────────────────────────────────────────────────

async function loadExistingPlaceIds(): Promise<Set<string>> {
    const rows = await db.select({ meta: venues.metadata }).from(venues);
    const ids = new Set<string>();
    for (const row of rows) {
        const meta = row.meta as Record<string, unknown> | null;
        if (typeof meta?.importedPlaceId === 'string') ids.add(meta.importedPlaceId);
    }
    return ids;
}

async function getSystemOwnerId(): Promise<string> {
    const [owner] = await db.select({ id: users.id }).from(users)
        .where(eq(users.email, SYSTEM_OWNER_EMAIL)).limit(1);
    if (!owner) throw new Error(`System owner not found: ${SYSTEM_OWNER_EMAIL}`);
    return owner.id;
}

async function importVenueToDB(params: {
    ownerId: string;
    validated: ValidatedVenue;
    city: CityTarget;
    description?: string;
    amenities: string[];
    instagramHandle?: string;
}): Promise<string> {
    const { validated: v, city } = params;
    const [row] = await db.insert(venues).values({
        ownerId: params.ownerId,
        name: v.name,
        slug: slugify(v.name, city.name),
        addressLine1: v.address.split(',')[0] ?? v.address,
        city: city.name,
        stateProvince: city.state,
        country: city.country,
        timezone: city.timezone,
        lat: String(v.lat),
        lng: String(v.lng),
        phone: v.phone,
        website: v.website,
        instagramHandle: params.instagramHandle,
        description: params.description ?? null,
        shortDescription: params.description ? params.description.slice(0, 280) : null,
        amenities: params.amenities,
        cuisineTags: ['AMERICAN'],
        priceRange: priceRangeFromLevel(v.priceLevel),
        averageRating: v.rating ? String(v.rating) : '0',
        isVerified: false,
        isActive: true,
        isFeatured: false,
        metadata: {
            importedFrom: 'firecrawl_cli+google_places',
            importedPlaceId: v.placeId,
            importedAt: new Date().toISOString(),
            importScript: 'crawlSoccerWatchPartyVenues',
            googleTypes: v.types,
        },
    }).returning({ id: venues.id });
    return row.id;
}

// ─── City Processor ───────────────────────────────────────────────────────────

interface CityStats {
    city: string;
    discovered: number;
    validated: number;
    inserted: number;
    skipped: number;
    errors: number;
}

async function processCity(
    city: CityTarget,
    googleClient: GoogleMapsClient,
    ownerId: string,
    existingPlaceIds: Set<string>,
    globalInserted: { count: number },
): Promise<CityStats> {
    const stats: CityStats = { city: city.name, discovered: 0, validated: 0, inserted: 0, skipped: 0, errors: 0 };

    console.log(`\n${'═'.repeat(65)}`);
    console.log(`  ⚽  ${city.name.toUpperCase()}  (${city.timezone})`);
    console.log(`${'═'.repeat(65)}`);

    // ── Phase 1: Firecrawl CLI web search ─────────────────────────────────
    console.log('\n  Phase 1: Discovering venues via Firecrawl CLI search...');
    const discoveredMap = await discoverVenueNames(city);
    stats.discovered = discoveredMap.size;
    console.log(`\n  → ${discoveredMap.size} unique candidate names found`);

    if (discoveredMap.size === 0) {
        console.log('  ⚠️  No venues discovered — skipping');
        return stats;
    }

    // ── Phase 2: Google Places validation ─────────────────────────────────
    console.log('\n  Phase 2: Validating names with Google Places...');
    const validatedVenues: ValidatedVenue[] = [];
    const seenInBatch = new Set<string>();

    for (const [, disc] of discoveredMap) {
        process.stdout.write(`    "${disc.name}" ... `);
        await sleep(200);

        const validated = await validateWithGooglePlaces(googleClient, disc.name, city);
        if (!validated) { console.log('not found on Google'); continue; }

        if (seenInBatch.has(validated.placeId)) { console.log(`dup (${validated.name})`); continue; }
        seenInBatch.add(validated.placeId);

        if (existingPlaceIds.has(validated.placeId)) {
            console.log(`already in DB`);
            stats.skipped++;
            continue;
        }

        // ── Strict type filter: only accept real bars/restaurants ──────────
        const BAR_TYPES = ['bar', 'night_club', 'restaurant', 'food', 'cafe', 'meal_takeaway'];
        const isRealVenue = validated.types.some(t => BAR_TYPES.includes(t));
        if (!isRealVenue) {
            console.log(`SKIP (not a bar: ${validated.types.slice(0,3).join(', ')})`);
            continue;
        }

        console.log(`✓  ${validated.name}`);
        validatedVenues.push(validated);
        stats.validated++;

        // Cap per city
        if (validatedVenues.length >= MAX_PER_CITY) {
            console.log(`  (per-city cap of ${MAX_PER_CITY} reached)`);
            break;
        }
    }

    console.log(`\n  → ${validatedVenues.length} new venues ready to import`);
    if (validatedVenues.length === 0) return stats;

    // ── Phase 3: Scrape venue websites + insert to DB ─────────────────────
    console.log('\n  Phase 3: Scraping venue websites + importing...');

    for (const [i, v] of validatedVenues.entries()) {
        console.log(`\n    [${i + 1}/${validatedVenues.length}] ${v.name}`);
        console.log(`      📍 ${v.address}`);
        console.log(`      ⭐ ${v.rating ?? 'n/a'}  💰 ${'$'.repeat(v.priceLevel ?? 1)}  🌐 ${v.website ?? 'no website'}`);

        let amenities = dedupeArr(BASE_AMENITIES, BASE_VIBES);
        let description: string | undefined;
        let instagramHandle: string | undefined;

        if (!SKIP_SCRAPE && v.website) {
            process.stdout.write('      Scraping website via Firecrawl CLI ... ');
            const md = firecrawlScrape(v.website);
            if (md) {
                const scraped = extractAmenitiesFromMarkdown(md, v.name);
                amenities = dedupeArr(amenities, scraped.extra);
                description = scraped.description;
                instagramHandle = scraped.instagramHandle;
                console.log(scraped.extra.length ? scraped.extra.join(', ') : 'no extra signals');
            } else {
                console.log('no content returned');
            }
            await sleep(500);
        }

        console.log(`      Amenities: ${amenities.join(', ')}`);

        if (DRY_RUN) {
            console.log('      [DRY RUN] would insert');
            stats.skipped++;
            continue;
        }

        try {
            const id = await importVenueToDB({ ownerId, validated: v, city, description, amenities, instagramHandle });
            console.log(`      ✅ Inserted → ${id}`);
            existingPlaceIds.add(v.placeId);
            stats.inserted++;
            globalInserted.count++;
        } catch (err) {
            console.log(`      ❌ ${(err as Error).message.slice(0, 100)}`);
            stats.errors++;
        }

        // Stop globally if we've hit the total cap
        if (globalInserted.count >= MAX_TOTAL) {
            console.log(`\n  🏁 Global cap of ${MAX_TOTAL} venues reached — stopping.`);
            break;
        }

        await sleep(300);
    }

    return stats;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('\n⚽  MatchWatch — Soccer Watch Party Venue Crawler');
    console.log('════════════════════════════════════════════════════════');
    console.log(`Mode:     ${DRY_RUN ? 'DRY RUN (no DB writes)' : 'LIVE'}`);
    console.log(`Cities:   ${CITY_FILTER ?? 'all 11 MLS cities'}`);
    console.log(`Cap:      ${MAX_TOTAL} venues total (~${MAX_PER_CITY} per city)`);
    console.log(`Scraping: ${SKIP_SCRAPE ? 'disabled' : 'enabled (Firecrawl CLI)'}`);
    console.log('════════════════════════════════════════════════════════\n');

    if (!GOOGLE_API_KEY) throw new Error('Missing GOOGLE_PLACES_API_KEY in apps/api/.env');
    if (!FIRECRAWL_API_KEY) throw new Error('Missing FIRECRAWL_API_KEY in apps/api/.env');

    const googleClient = new GoogleMapsClient({});

    console.log('Loading existing imported place IDs...');
    const existingPlaceIds = DRY_RUN ? new Set<string>() : await loadExistingPlaceIds();
    console.log(`  ${existingPlaceIds.size} venues already in DB\n`);

    const ownerId = DRY_RUN ? 'dry-run-owner-id' : await getSystemOwnerId();

    const citiesToProcess = CITY_FILTER
        ? MLS_CITIES.filter((c) => c.name.toLowerCase().includes(CITY_FILTER!))
        : MLS_CITIES;

    if (!citiesToProcess.length) {
        console.error(`No cities matched: "${CITY_FILTER}"`);
        process.exit(1);
    }

    const allStats: CityStats[] = [];
    const globalInserted = { count: 0 };

    for (const city of citiesToProcess) {
        if (globalInserted.count >= MAX_TOTAL) {
            console.log(`\n🏁 Global cap of ${MAX_TOTAL} reached — skipping remaining cities.`);
            break;
        }
        const stats = await processCity(city, googleClient, ownerId, existingPlaceIds, globalInserted);
        allStats.push(stats);
        await sleep(2000);
    }

    // ── Summary Table ─────────────────────────────────────────────────────
    console.log('\n\n⚽  CRAWL COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log(
        `${'City'.padEnd(18)} ${'Discovered'.padStart(11)} ${'Validated'.padStart(10)} ${'Inserted'.padStart(9)} ${'Skipped'.padStart(8)} ${'Errors'.padStart(7)}`,
    );
    console.log('─'.repeat(68));

    let td = 0, tv = 0, ti = 0, ts = 0, te = 0;
    for (const s of allStats) {
        console.log(
            `${s.city.padEnd(18)} ${String(s.discovered).padStart(11)} ${String(s.validated).padStart(10)} ${String(s.inserted).padStart(9)} ${String(s.skipped).padStart(8)} ${String(s.errors).padStart(7)}`,
        );
        td += s.discovered; tv += s.validated; ti += s.inserted; ts += s.skipped; te += s.errors;
    }
    console.log('─'.repeat(68));
    console.log(
        `${'TOTAL'.padEnd(18)} ${String(td).padStart(11)} ${String(tv).padStart(10)} ${String(ti).padStart(9)} ${String(ts).padStart(8)} ${String(te).padStart(7)}`,
    );
    console.log('═══════════════════════════════════════════════════════════════════\n');

    if (DRY_RUN) console.log('⚠️  DRY RUN — nothing written to DB.\n');
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('\n❌ Fatal:', err instanceof Error ? err.message : err);
        process.exit(1);
    });
