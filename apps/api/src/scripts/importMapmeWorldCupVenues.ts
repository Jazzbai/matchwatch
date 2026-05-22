/**
 * importMapmeWorldCupVenues.ts
 *
 * Scrapes https://mapme.com/interactive-map-example/where-to-watch-the-world-cup-2026/
 * via Firecrawl, extracts venue names + cities, validates each against Google Places,
 * and imports new venues into the DB.
 *
 * Usage (from apps/api/):
 *   npx tsx src/scripts/importMapmeWorldCupVenues.ts
 *   npx tsx src/scripts/importMapmeWorldCupVenues.ts --dry-run
 *   npx tsx src/scripts/importMapmeWorldCupVenues.ts --city=Houston
 */

import 'dotenv/config';
import { execSync } from 'child_process';
import FirecrawlApp from '@mendable/firecrawl-js';
import { Client as GoogleMapsClient, PlaceInputType } from '@googlemaps/google-maps-services-js';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { venues, users } from '../db/schema.js';

// ─── Config ───────────────────────────────────────────────────────────────────

const SOURCE_URL = 'https://mapme.com/interactive-map-example/where-to-watch-the-world-cup-2026/';

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY ?? '';
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY ?? '';
const SYSTEM_OWNER_EMAIL = process.env.SYSTEM_OWNER_EMAIL ?? 'admin@matchwatch.us';

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

// ─── World Cup host city lookup ───────────────────────────────────────────────

interface CityConfig {
    name: string;
    state: string;
    country: string;
    timezone: string;
    searchQuery: string;
    aliases: string[];
}

const HOST_CITIES: CityConfig[] = [
    { name: 'Houston',       state: 'TX', country: 'US', timezone: 'America/Chicago',     searchQuery: 'Houston, TX',          aliases: ['houston'] },
    { name: 'Dallas',        state: 'TX', country: 'US', timezone: 'America/Chicago',     searchQuery: 'Dallas, TX',           aliases: ['dallas', 'arlington'] },
    { name: 'New York',      state: 'NY', country: 'US', timezone: 'America/New_York',    searchQuery: 'New York, NY',         aliases: ['new york', 'nyc', 'new jersey', 'newark', 'east rutherford'] },
    { name: 'Los Angeles',   state: 'CA', country: 'US', timezone: 'America/Los_Angeles', searchQuery: 'Los Angeles, CA',      aliases: ['los angeles', 'la', 'inglewood', 'sofi'] },
    { name: 'Miami',         state: 'FL', country: 'US', timezone: 'America/New_York',    searchQuery: 'Miami, FL',            aliases: ['miami', 'fort lauderdale', 'south florida'] },
    { name: 'Atlanta',       state: 'GA', country: 'US', timezone: 'America/New_York',    searchQuery: 'Atlanta, GA',          aliases: ['atlanta'] },
    { name: 'San Francisco', state: 'CA', country: 'US', timezone: 'America/Los_Angeles', searchQuery: 'San Francisco, CA',    aliases: ['san francisco', 'sf', 'bay area', 'santa clara', 'san jose'] },
    { name: 'Philadelphia',  state: 'PA', country: 'US', timezone: 'America/New_York',    searchQuery: 'Philadelphia, PA',     aliases: ['philadelphia', 'philly'] },
    { name: 'Seattle',       state: 'WA', country: 'US', timezone: 'America/Los_Angeles', searchQuery: 'Seattle, WA',          aliases: ['seattle'] },
    { name: 'Boston',        state: 'MA', country: 'US', timezone: 'America/New_York',    searchQuery: 'Boston, MA',           aliases: ['boston'] },
    { name: 'Kansas City',   state: 'MO', country: 'US', timezone: 'America/Chicago',     searchQuery: 'Kansas City, MO',      aliases: ['kansas city', 'kc'] },
];

function detectCity(text: string): CityConfig | null {
    const lower = text.toLowerCase();
    for (const city of HOST_CITIES) {
        if (city.aliases.some((a) => lower.includes(a))) return city;
    }
    return null;
}

// ─── Scraping ─────────────────────────────────────────────────────────────────

interface RawVenue { name: string; city: CityConfig; address?: string; }

async function scrapeMapme(): Promise<RawVenue[]> {
    console.log(`\nScraping: ${SOURCE_URL}`);
    console.log('Using Firecrawl to render and extract content...\n');

    const firecrawl = new FirecrawlApp({ apiKey: FIRECRAWL_API_KEY });

    let markdown = '';

    // Try JS-rendered scrape via SDK first (handles dynamic map content)
    try {
        const result = await firecrawl.scrapeUrl(SOURCE_URL, {
            formats: ['markdown'],
            onlyMainContent: false,
            waitFor: 3000,
        }) as any;
        markdown = result?.markdown ?? result?.data?.markdown ?? '';
        console.log(`SDK scrape: ${markdown.length} chars`);
    } catch (err) {
        console.log('SDK scrape failed, trying CLI...');
    }

    // Fallback: CLI scrape
    if (!markdown) {
        try {
            const cmd = `npx firecrawl-cli --api-key ${FIRECRAWL_API_KEY} scrape "${SOURCE_URL}" --formats markdown --only-main-content false --json`;
            const out = execSync(cmd, { timeout: 90_000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
            const parsed = JSON.parse(out);
            markdown = parsed?.markdown ?? parsed?.data?.markdown ?? parsed?.[0]?.markdown ?? out;
            console.log(`CLI scrape: ${markdown.length} chars`);
        } catch {
            console.log('CLI scrape also failed');
        }
    }

    if (!markdown || markdown.length < 100) {
        console.log('\nFalling back to Firecrawl search for each host city...');
        return await searchByCity();
    }

    console.log(`\nParsing ${markdown.length} chars of content...`);
    return parseVenuesFromMarkdown(markdown);
}

function parseVenuesFromMarkdown(md: string): RawVenue[] {
    const results: RawVenue[] = [];
    const seen = new Set<string>();

    const lines = md.split('\n').map((l) => l.trim()).filter(Boolean);

    for (const line of lines) {
        // Try to detect venue name candidates
        const candidates: string[] = [];

        // Numbered list: "1. Venue Name" or "1) Venue Name"
        const numbered = line.match(/^\d+[\.\)]\s+(.{3,100})$/);
        if (numbered) candidates.push(numbered[1].replace(/\*+/g, '').split(' - ')[0].trim());

        // **Bold** name
        const bold = [...line.matchAll(/\*{2}([^*]{3,100})\*{2}/g)];
        for (const m of bold) candidates.push(m[1].trim());

        // ## Heading
        const heading = line.match(/^#{1,4}\s+(.{3,100})$/);
        if (heading) candidates.push(heading[1].trim());

        // [Link text](http...)
        const links = [...line.matchAll(/\[([^\]]{3,100})\]\(http/g)];
        for (const m of links) candidates.push(m[1].trim());

        for (const candidate of candidates) {
            const key = candidate.toLowerCase();
            if (seen.has(key)) continue;
            if (isNoise(candidate)) continue;

            // Try to detect city from surrounding context (check this line + next few)
            const context = line + ' ' + candidate;
            const city = detectCity(context);
            if (!city) continue; // only import venues we can assign to a WC host city

            seen.add(key);
            results.push({ name: candidate, city, address: undefined });
        }
    }

    // If very few results, try a looser parse: any line that has a city name near a potential venue
    if (results.length < 10) {
        console.log(`  Only ${results.length} venues detected from structured markup — trying loose parse...`);
        for (const line of lines) {
            const city = detectCity(line);
            if (!city) continue;
            // strip city name and markdown syntax to get possible venue name
            const clean = line
                .replace(/#{1,4}\s/g, '')
                .replace(/\*+/g, '')
                .replace(/\[[^\]]+\]\([^)]+\)/g, (m) => m.replace(/\[([^\]]+)\].*/, '$1'))
                .replace(new RegExp(city.aliases.join('|'), 'gi'), '')
                .trim().split('|')[0].split(' - ')[0].trim();
            const key = clean.toLowerCase();
            if (clean.length < 3 || clean.length > 100) continue;
            if (seen.has(key)) continue;
            if (isNoise(clean)) continue;
            seen.add(key);
            results.push({ name: clean, city });
        }
    }

    return results;
}

const NOISE = ['click', 'read more', 'sign up', 'home', 'menu', 'filter', 'map', 'directions', 'open now', 'see all', 'load more', 'world cup', 'watch the', 'where to watch'];
function isNoise(s: string): boolean {
    const l = s.toLowerCase();
    if (NOISE.some((n) => l.includes(n))) return false;
    if (s.length < 3 || s.length > 100) return true;
    if (/^\d+$/.test(s)) return true;
    return false;
}

// ─── Fallback: city-by-city Firecrawl search ─────────────────────────────────

async function searchByCity(): Promise<RawVenue[]> {
    const all: RawVenue[] = [];
    const seen = new Set<string>();

    const citiesToSearch = CITY_FILTER
        ? HOST_CITIES.filter((c) => c.name.toLowerCase().includes(CITY_FILTER!))
        : HOST_CITIES;

    for (const city of citiesToSearch) {
        console.log(`\n  Searching: World Cup watch party bars ${city.name}...`);
        try {
            const query = `World Cup 2026 watch party bars restaurants ${city.searchQuery}`;
            const q = query.replace(/"/g, "'");
            const cmd = `npx firecrawl-cli --api-key ${FIRECRAWL_API_KEY} search "${q}" --limit 10 --scrape --scrape-formats markdown --only-main-content --json`;
            const out = execSync(cmd, { timeout: 90_000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
            const parsed = JSON.parse(out);
            const items: any[] = parsed?.data?.web ?? parsed?.data ?? parsed ?? [];
            for (const item of items) {
                const text = [item.title ?? '', item.description ?? '', item.markdown ?? ''].join('\n');
                const names = extractNamesFromText(text);
                for (const name of names) {
                    const key = `${name.toLowerCase()}|${city.name}`;
                    if (seen.has(key)) continue;
                    seen.add(key);
                    all.push({ name, city });
                }
            }
            console.log(`    → ${all.filter(v => v.city.name === city.name).length} venues found`);
        } catch {
            console.log(`    search failed for ${city.name}`);
        }
        await sleep(1500);
    }

    return all;
}

function extractNamesFromText(text: string): string[] {
    const names = new Set<string>();
    for (const line of text.split('\n').map(l => l.trim()).filter(Boolean)) {
        const numbered = line.match(/^\d+[\.\)]\s+(.{3,80})$/);
        if (numbered) { const c = numbered[1].replace(/\*+/g, '').split(' - ')[0].trim(); if (!isNoise(c)) names.add(c); }
        const bold = [...line.matchAll(/\*{2}([^*]{3,80})\*{2}/g)];
        for (const m of bold) { const c = m[1].trim(); if (!isNoise(c)) names.add(c); }
    }
    return [...names];
}

// ─── Google Places Validation ─────────────────────────────────────────────────

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

const BAR_TYPES = ['bar', 'night_club', 'restaurant', 'food', 'cafe', 'meal_takeaway', 'meal_delivery'];

async function validateWithGooglePlaces(
    client: GoogleMapsClient,
    venue: RawVenue,
): Promise<ValidatedVenue | null> {
    try {
        const input = venue.address
            ? `${venue.name}, ${venue.address}`
            : `${venue.name} ${venue.city.searchQuery}`;

        const res = await client.findPlaceFromText({
            params: {
                input,
                inputtype: PlaceInputType.textQuery,
                fields: ['place_id', 'name', 'geometry', 'formatted_address', 'types', 'rating', 'price_level'],
                key: GOOGLE_API_KEY,
            },
        });

        const place = res.data.candidates?.[0];
        if (!place?.place_id || !place.geometry?.location) return null;

        const isRealVenue = place.types?.some((t: string) => BAR_TYPES.includes(t));
        if (!isRealVenue) return null;

        const detailRes = await client.placeDetails({
            params: {
                place_id: place.place_id,
                fields: ['formatted_phone_number', 'website'],
                key: GOOGLE_API_KEY,
            },
        });

        return {
            placeId: place.place_id,
            name: place.name ?? venue.name,
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

// ─── DB Helpers ───────────────────────────────────────────────────────────────

function slugify(name: string, city: string) {
    return `${name} ${city}`.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim()
        .replace(/\s+/g, '-').slice(0, 180) + '-' + Math.random().toString(36).slice(2, 6);
}

function priceRange(level?: number): 'BUDGET' | 'MID' | 'UPSCALE' | 'LUXURY' {
    if (!level) return 'MID';
    if (level <= 1) return 'BUDGET';
    if (level === 2) return 'MID';
    if (level === 3) return 'UPSCALE';
    return 'LUXURY';
}

async function loadExistingPlaceIds(): Promise<Set<string>> {
    const rows = await db.select({ meta: venues.metadata }).from(venues);
    const ids = new Set<string>();
    for (const row of rows) {
        const meta = row.meta as Record<string, unknown> | null;
        if (typeof meta?.importedPlaceId === 'string') ids.add(meta.importedPlaceId);
    }
    return ids;
}

async function getOwnerId(): Promise<string> {
    const [owner] = await db.select({ id: users.id }).from(users)
        .where(eq(users.email, SYSTEM_OWNER_EMAIL)).limit(1);
    if (!owner) throw new Error(`System owner not found: ${SYSTEM_OWNER_EMAIL}`);
    return owner.id;
}

async function insertVenue(ownerId: string, v: ValidatedVenue, city: CityConfig): Promise<string> {
    const [row] = await db.insert(venues).values({
        ownerId,
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
        description: null,
        amenities: ['TV', 'BIG_SCREEN', 'BAR', 'ALCOHOLIC', 'SPORTS_BAR', 'SOCCER', 'WATCH_PARTY'],
        cuisineTags: ['AMERICAN'],
        priceRange: priceRange(v.priceLevel),
        averageRating: v.rating ? String(v.rating) : '0',
        isVerified: false,
        isActive: true,
        isFeatured: false,
        metadata: {
            importedFrom: 'mapme_worldcup2026',
            importedPlaceId: v.placeId,
            importedAt: new Date().toISOString(),
            sourceUrl: SOURCE_URL,
            googleTypes: v.types,
        },
    }).returning({ id: venues.id });
    return row.id;
}

function sleep(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)); }

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('\n⚽  MatchWatch — MapMe World Cup 2026 Venue Importer');
    console.log('════════════════════════════════════════════════════════');
    console.log(`Source: ${SOURCE_URL}`);
    console.log(`Mode:   ${DRY_RUN ? 'DRY RUN (no DB writes)' : 'LIVE'}`);
    console.log(`Filter: ${CITY_FILTER ?? 'all 11 host cities'}`);
    console.log('════════════════════════════════════════════════════════\n');

    if (!GOOGLE_API_KEY) throw new Error('Missing GOOGLE_PLACES_API_KEY');
    if (!FIRECRAWL_API_KEY) throw new Error('Missing FIRECRAWL_API_KEY');

    const googleClient = new GoogleMapsClient({});
    const existingPlaceIds = DRY_RUN ? new Set<string>() : await loadExistingPlaceIds();
    const ownerId = DRY_RUN ? 'dry-run' : await getOwnerId();

    console.log(`Existing venues in DB: ${existingPlaceIds.size}`);

    // ── Step 1: Scrape MapMe ──────────────────────────────────────────────
    const rawVenues = await scrapeMapme();
    const filtered = CITY_FILTER
        ? rawVenues.filter((v) => v.city.name.toLowerCase().includes(CITY_FILTER!))
        : rawVenues;

    console.log(`\nRaw venues extracted: ${rawVenues.length}`);
    console.log(`After city filter:    ${filtered.length}\n`);

    if (filtered.length === 0) {
        console.log('No venues found. Try running without --city filter or check Firecrawl connectivity.');
        return;
    }

    // ── Step 2: Validate + Import ─────────────────────────────────────────
    let inserted = 0, skipped = 0, failed = 0;
    const seenInBatch = new Set<string>();

    const byCityStats: Record<string, { inserted: number; skipped: number; failed: number }> = {};

    for (const [i, raw] of filtered.entries()) {
        const cityName = raw.city.name;
        if (!byCityStats[cityName]) byCityStats[cityName] = { inserted: 0, skipped: 0, failed: 0 };

        process.stdout.write(`[${i + 1}/${filtered.length}] ${raw.name} (${cityName}) ... `);
        await sleep(200);

        const validated = await validateWithGooglePlaces(googleClient, raw);
        if (!validated) {
            console.log('not found on Google Places');
            byCityStats[cityName].failed++;
            failed++;
            continue;
        }

        if (seenInBatch.has(validated.placeId)) {
            console.log(`dup → ${validated.name}`);
            byCityStats[cityName].skipped++;
            skipped++;
            continue;
        }
        seenInBatch.add(validated.placeId);

        if (existingPlaceIds.has(validated.placeId)) {
            console.log(`already in DB`);
            byCityStats[cityName].skipped++;
            skipped++;
            continue;
        }

        console.log(`✓  ${validated.name}  |  ${validated.address}`);

        if (DRY_RUN) {
            byCityStats[cityName].skipped++;
            skipped++;
            continue;
        }

        try {
            const id = await insertVenue(ownerId, validated, raw.city);
            existingPlaceIds.add(validated.placeId);
            byCityStats[cityName].inserted++;
            inserted++;
            console.log(`   → inserted ${id}`);
        } catch (err) {
            console.log(`   ❌ ${(err as Error).message.slice(0, 100)}`);
            byCityStats[cityName].failed++;
            failed++;
        }

        await sleep(200);
    }

    // ── Summary ───────────────────────────────────────────────────────────
    console.log('\n\n⚽  IMPORT COMPLETE');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`${'City'.padEnd(18)} ${'Inserted'.padStart(9)} ${'Skipped'.padStart(8)} ${'Failed'.padStart(7)}`);
    console.log('─'.repeat(45));
    for (const [city, s] of Object.entries(byCityStats)) {
        console.log(`${city.padEnd(18)} ${String(s.inserted).padStart(9)} ${String(s.skipped).padStart(8)} ${String(s.failed).padStart(7)}`);
    }
    console.log('─'.repeat(45));
    console.log(`${'TOTAL'.padEnd(18)} ${String(inserted).padStart(9)} ${String(skipped).padStart(8)} ${String(failed).padStart(7)}`);
    console.log('═══════════════════════════════════════════════════════\n');

    if (DRY_RUN) console.log('⚠️  DRY RUN — nothing written to DB.\n');
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('\n❌ Fatal:', (err as Error).message ?? err);
        process.exit(1);
    });
