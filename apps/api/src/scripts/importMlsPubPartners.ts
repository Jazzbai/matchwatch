/**
 * importMlsPubPartners.ts
 *
 * Imports MLS club pub/bar partner venues from a CSV file.
 * For each row: looks up the venue on Google Places, enriches the record,
 * deduplicates by googlePlaceId → normalized name+city, and upserts into the DB.
 * Also links the venue to the corresponding MLS team via teamFanVenues.
 *
 * Usage:
 *   cd apps/api
 *   npx tsx src/scripts/importMlsPubPartners.ts --file=src/scripts/mls_pub_partners.csv
 *   npx tsx src/scripts/importMlsPubPartners.ts --file=src/scripts/mls_pub_partners.csv --dry-run
 *   npx tsx src/scripts/importMlsPubPartners.ts --file=src/scripts/mls_pub_partners.csv --limit=5
 *
 * Required env:
 *   DATABASE_URL
 *   GOOGLE_PLACES_API_KEY
 *   SYSTEM_OWNER_EMAIL  (defaults to admin@matchwatch.us)
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { eq, ilike, and, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { venues, teams, teamFanVenues, users, venueAttributes } from '../db/schema.js';
import {
    searchGooglePlaces,
    getGooglePlaceDetails,
    deriveGoogleAmenitiesFromSnapshot,
    type GoogleSourceSnapshot,
} from '../lib/googlePlaces.js';
import { buildGoogleVenueFields } from '../lib/venueOnboarding.js';
import { findExistingVenueMatch } from '../lib/venueOnboarding.js';
import { generateUniqueSlug } from '../lib/utils.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CsvRow {
    clubWebsite: string;
    clubName: string;
    venueName: string;
    venueWebsite: string;
}

interface ImportResult {
    venueName: string;
    clubName: string;
    status: 'inserted' | 'updated' | 'skipped' | 'failed';
    venueId?: string;
    googlePlaceId?: string;
    reason?: string;
}

// ─── Club → MLS Team Name mapping ────────────────────────────────────────────
// Keys are club_name values from the CSV; values are the team name as stored in DB.
const CLUB_TO_TEAM_NAME: Record<string, string> = {
    'Atlanta United':           'Atlanta United FC',
    'Austin FC':                'Austin FC',
    'Charlotte FC':             'Charlotte FC',
    'Columbus Crew':            'Columbus Crew',
    'FC Dallas':                'FC Dallas',
    'Houston Dynamo FC':        'Houston Dynamo FC',
    'Nashville SC':             'Nashville SC',
    'New England Revolution':   'New England Revolution',
    'Orlando City SC':          'Orlando City SC',
    'Sporting Kansas City':     'Sporting Kansas City',
};

// Club → primary city for Google Places search disambiguation
const CLUB_TO_CITY: Record<string, string> = {
    'Atlanta United':           'Atlanta, GA',
    'Austin FC':                'Austin, TX',
    'Charlotte FC':             'Charlotte, NC',
    'Columbus Crew':            'Columbus, OH',
    'FC Dallas':                'Frisco, TX',
    'Houston Dynamo FC':        'Houston, TX',
    'Nashville SC':             'Nashville, TN',
    'New England Revolution':   'Boston, MA',
    'Orlando City SC':          'Orlando, FL',
    'Sporting Kansas City':     'Kansas City, MO',
};

// Club → timezone
const CLUB_TO_TIMEZONE: Record<string, string> = {
    'Atlanta United':           'America/New_York',
    'Austin FC':                'America/Chicago',
    'Charlotte FC':             'America/New_York',
    'Columbus Crew':            'America/New_York',
    'FC Dallas':                'America/Chicago',
    'Houston Dynamo FC':        'America/Chicago',
    'Nashville SC':             'America/Chicago',
    'New England Revolution':   'America/New_York',
    'Orlando City SC':          'America/New_York',
    'Sporting Kansas City':     'America/Chicago',
};

// Manual Instagram overrides keyed by normalized venue name
const INSTAGRAM_OVERRIDES: Record<string, string> = {
    'senate ave': 'senateave',
};

// Base amenities all MLS pub partners get (they're all sports watch-party bars/pubs)
const BASE_AMENITIES = ['TV', 'BIG_SCREEN', 'ALCOHOLIC', 'FOOD', 'SPORTS_BAR', 'WATCH_PARTY'];
const BASE_VIBES = ['GAME_DAY', 'LIVELY'];

// ─── CSV Parser ───────────────────────────────────────────────────────────────

function parseCsv(content: string): CsvRow[] {
    const lines = content.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return [];

    // Normalize headers
    const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, '').toLowerCase());

    const colClubWebsite = headers.indexOf('club_website');
    const colClubName = headers.indexOf('club_name');
    const colVenueName = headers.indexOf('venue_or_pub_name');
    const colVenueWebsite = headers.indexOf('venue_website');

    if (colVenueName === -1 || colClubName === -1) {
        throw new Error(`CSV missing required columns. Found: ${headers.join(', ')}`);
    }

    const rows: CsvRow[] = [];
    for (let i = 1; i < lines.length; i++) {
        const cells = splitCsvLine(lines[i]);
        const venueName = cells[colVenueName]?.trim().replace(/"/g, '');
        const clubName = cells[colClubName]?.trim().replace(/"/g, '');
        if (!venueName || !clubName) continue;

        rows.push({
            clubWebsite: cells[colClubWebsite]?.trim().replace(/"/g, '') ?? '',
            clubName,
            venueName,
            venueWebsite: cells[colVenueWebsite]?.trim().replace(/"/g, '') ?? '',
        });
    }

    return rows;
}

function splitCsvLine(line: string): string[] {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
            cells.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    cells.push(current);
    return cells;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeName(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function extractInstagramHandle(url?: string): string | null {
    if (!url) return null;
    const match = url.match(/instagram\.com\/([a-zA-Z0-9_.]+)/i);
    return match ? match[1].replace(/\/$/, '') : null;
}

function mapPriceLevel(priceLevel?: string | null): 'BUDGET' | 'MID' | 'UPSCALE' | 'LUXURY' {
    if (!priceLevel) return 'MID';
    const n = parseInt(priceLevel.replace(/[^0-9]/g, ''), 10);
    if (isNaN(n)) return 'MID';
    if (n <= 1) return 'BUDGET';
    if (n === 2) return 'MID';
    if (n === 3) return 'UPSCALE';
    return 'LUXURY';
}

async function getActiveAmenitySlugs(): Promise<Set<string>> {
    const rows = await db
        .select({ slug: venueAttributes.slug })
        .from(venueAttributes)
        .where(and(
            eq(venueAttributes.type, 'AMENITY'),
            eq(venueAttributes.isActive, true),
        ));
    return new Set(rows.map((r) => r.slug));
}

function filterAmenities(amenities: string[], allowed: Set<string>): string[] {
    return [...new Set(amenities)].filter((a) => allowed.has(a));
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

// ─── Google Places search with best-match selection ──────────────────────────

async function findBestGoogleMatch(
    venueName: string,
    city: string,
    websiteHint?: string,
): Promise<{ placeId: string; displayName: string; formattedAddress: string | null | undefined } | null> {
    // Build search query: venue name + city for disambiguation
    const query = `${venueName} ${city}`;
    console.log(`    🔍 Searching Google Places: "${query}"`);

    let results = await searchGooglePlaces(query);

    if (results.length === 0) {
        // Retry with just venue name
        results = await searchGooglePlaces(venueName);
    }

    if (results.length === 0) {
        return null;
    }

    const normalizedTarget = normalizeName(venueName);
    const cityLower = city.toLowerCase().split(',')[0].trim();

    // Score candidates: prefer name match + same city
    const scored = results.map((r) => {
        const candidateName = normalizeName(r.displayName);
        const candidateAddress = (r.formattedAddress || '').toLowerCase();
        const candidateCity = (r.city || '').toLowerCase();

        let score = 0;

        // Exact name match
        if (candidateName === normalizedTarget) score += 100;
        // Name contains target
        else if (candidateName.includes(normalizedTarget)) score += 60;
        // Target contains candidate name
        else if (normalizedTarget.includes(candidateName)) score += 40;

        // City match
        if (candidateCity === cityLower || candidateAddress.includes(cityLower)) score += 30;

        // Website domain match hint
        if (websiteHint) {
            try {
                const domain = new URL(websiteHint).hostname.replace(/^www\./, '');
                // Can't check Google result website here (only in details), just add to context
                void domain;
            } catch { /* ignore bad URLs */ }
        }

        return { result: r, score };
    });

    scored.sort((a, b) => b.score - a.score);

    const best = scored[0];

    // Minimum threshold: must have at least partial name match
    if (best.score < 30) {
        console.log(`    ⚠️  Best match score too low (${best.score}): ${best.result.displayName} @ ${best.result.formattedAddress}`);
        return null;
    }

    console.log(`    ✓ Best match (score ${best.score}): ${best.result.displayName} @ ${best.result.formattedAddress}`);
    return best.result;
}

// ─── DB Operations ────────────────────────────────────────────────────────────

async function getSystemOwnerId(): Promise<string> {
    const ownerEmail = process.env.SYSTEM_OWNER_EMAIL ?? 'admin@matchwatch.us';
    const [row] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, ownerEmail))
        .limit(1);

    if (!row) throw new Error(`System owner not found: ${ownerEmail}. Make sure auto-seed has run.`);
    return row.id;
}

async function findTeamId(teamName: string): Promise<string | null> {
    if (!teamName) return null;

    // Try exact name first
    const [exact] = await db
        .select({ id: teams.id })
        .from(teams)
        .where(eq(teams.name, teamName))
        .limit(1);

    if (exact) return exact.id;

    // Fallback: ilike
    const [fuzzy] = await db
        .select({ id: teams.id })
        .from(teams)
        .where(ilike(teams.name, `%${teamName}%`))
        .limit(1);

    return fuzzy?.id ?? null;
}

async function linkTeamToVenue(venueId: string, teamId: string): Promise<void> {
    // Idempotent: do nothing if already linked
    const [existing] = await db
        .select({ id: teamFanVenues.id })
        .from(teamFanVenues)
        .where(and(
            eq(teamFanVenues.venueId, venueId),
            eq(teamFanVenues.teamId, teamId),
        ))
        .limit(1);

    if (existing) return;

    await db.insert(teamFanVenues).values({ venueId, teamId });
}

// ─── Main import logic per venue ─────────────────────────────────────────────

async function importVenueRow(
    row: CsvRow,
    ownerId: string,
    allowedAmenities: Set<string>,
    opts: { dryRun: boolean },
): Promise<ImportResult> {
    const { venueName, clubName, venueWebsite } = row;
    const city = CLUB_TO_CITY[clubName] ?? '';
    const timezone = CLUB_TO_TIMEZONE[clubName] ?? 'America/Chicago';
    const teamDbName = CLUB_TO_TEAM_NAME[clubName] ?? clubName;
    const normalizedVenueName = normalizeName(venueName);

    // 1. Find Google Places match
    let placeId: string | null = null;
    let snapshot: GoogleSourceSnapshot | null = null;

    try {
        const match = await findBestGoogleMatch(venueName, city, venueWebsite);
        if (match) {
            placeId = match.placeId;
            // 2. Get full place details
            console.log(`    📥 Fetching details for placeId: ${placeId}`);
            snapshot = await getGooglePlaceDetails(placeId);
        }
    } catch (err) {
        console.log(`    ⚠️  Google Places error: ${(err as Error).message}`);
    }

    // Rate limit
    await sleep(300);

    // 3. Check deduplication
    const existing = await findExistingVenueMatch({
        googlePlaceId: placeId,
        name: venueName,
        city: snapshot?.city ?? city.split(',')[0].trim(),
    });

    if (existing) {
        if (opts.dryRun) {
            return { venueName, clubName, status: 'skipped', venueId: existing.id, googlePlaceId: placeId ?? undefined, reason: 'dry-run: already exists' };
        }

        // Update: link team + update googlePlaceId / snapshot if we got new data
        try {
            const teamId = await findTeamId(teamDbName);

            if (snapshot && placeId) {
                const googleFields = buildGoogleVenueFields(snapshot);
                const googleAmenities = filterAmenities(deriveGoogleAmenitiesFromSnapshot(snapshot), allowedAmenities);
                const mergedAmenities = filterAmenities(
                    [...new Set([...BASE_AMENITIES, ...googleAmenities])],
                    allowedAmenities,
                );

                await db.update(venues).set({
                    googlePlaceId: placeId,
                    googleSourceSnapshot: googleFields.googleSourceSnapshot as Record<string, unknown>,
                    googleLastSyncedAt: new Date(),
                    googleSyncStatus: 'SYNCED',
                    phone: existing.name ? (snapshot.phone ?? undefined) : undefined, // don't overwrite
                    website: venueWebsite || snapshot.website || undefined,
                    googleMapsUrl: snapshot.googleMapsUrl ?? undefined,
                    amenities: mergedAmenities,
                    ratingOverride: snapshot.rating != null ? String(snapshot.rating) : undefined,
                    reviewCountOverride: snapshot.reviewCount ?? undefined,
                    updatedAt: new Date(),
                } as Partial<typeof venues.$inferInsert>).where(eq(venues.id, existing.id));
            }

            if (teamId) {
                try {
                    await linkTeamToVenue(existing.id, teamId);
                    console.log(`    🔗 Linked team: ${teamDbName}`);
                } catch (teamErr) {
                    console.log(`    ⚠️  Team link skipped: ${(teamErr as Error).message}`);
                }
            }

            return { venueName, clubName, status: 'updated', venueId: existing.id, googlePlaceId: placeId ?? undefined, reason: 'enriched existing' };
        } catch (err) {
            return { venueName, clubName, status: 'failed', reason: `Update error: ${(err as Error).message}` };
        }
    }

    // 4. Build insert payload
    if (!snapshot && !placeId) {
        // No Google data — we still have enough from CSV to create a minimal record
        // but only if city is known (so we have at least an approximate location)
        if (!city) {
            return { venueName, clubName, status: 'failed', reason: 'No Google match + no city info' };
        }
        // Can't insert without lat/lng (required in schema), so log as failed
        return { venueName, clubName, status: 'failed', reason: 'No Google Places match found — lat/lng required' };
    }

    const googleFields = buildGoogleVenueFields(snapshot!);
    const googleAmenities = filterAmenities(deriveGoogleAmenitiesFromSnapshot(snapshot!), allowedAmenities);
    const mergedAmenities = filterAmenities(
        [...new Set([...BASE_AMENITIES, ...googleAmenities])],
        allowedAmenities,
    );
    const mergedVibes = filterAmenities(BASE_VIBES, allowedAmenities.size > 0
        ? new Set([...BASE_VIBES]) // vibes use same filter approach
        : new Set<string>());
    // Actually vibes come from venueAttributes type='VIBE', re-check below
    const allowedVibes = await getActiveVibeSlugs();
    const finalVibes = BASE_VIBES.filter((v) => allowedVibes.has(v));

    // Instagram: check overrides first, then try to extract from venueWebsite URL
    const instagramOverride = INSTAGRAM_OVERRIDES[normalizedVenueName] ?? null;
    const instagramFromWebsite = !instagramOverride && venueWebsite?.includes('instagram.com')
        ? extractInstagramHandle(venueWebsite)
        : null;
    const instagramHandle = instagramOverride ?? instagramFromWebsite ?? null;

    const slug = generateUniqueSlug(venueName);
    const priceRange = mapPriceLevel(snapshot?.priceLevel);

    const addressLine1 = googleFields.addressLine1 || snapshot?.formattedAddress || 'Address unknown';
    const snapshotCity = googleFields.city || city.split(',')[0].trim();
    const country = googleFields.country || 'US';
    const stateProvince = googleFields.stateProvince ?? null;
    const lat = googleFields.lat ?? null;
    const lng = googleFields.lng ?? null;
    const resolvedTimezone = googleFields.timezone || timezone;

    if (!lat || !lng) {
        return { venueName, clubName, status: 'failed', reason: 'No lat/lng from Google' };
    }

    const description = snapshot?.editorialSummary ?? null;
    const shortDescription = description ? description.slice(0, 280) : null;

    const insertPayload: typeof venues.$inferInsert = {
        ownerId,
        name: venueName,
        slug,
        addressLine1,
        city: snapshotCity,
        stateProvince,
        country,
        postalCode: snapshot?.postalCode ?? null,
        lat: String(lat),
        lng: String(lng),
        timezone: resolvedTimezone,
        phone: snapshot?.phone ?? null,
        website: venueWebsite || snapshot?.website || null,
        instagramHandle,
        googleMapsUrl: snapshot?.googleMapsUrl ?? null,
        googlePlaceId: placeId,
        googleSourceSnapshot: googleFields.googleSourceSnapshot as Record<string, unknown>,
        googleLastSyncedAt: new Date(),
        googleSyncStatus: 'SYNCED',
        googleSyncError: null,
        descriptionSource: description ? 'GOOGLE' : 'NONE',
        shortDescriptionSource: shortDescription ? 'GOOGLE' : 'NONE',
        description,
        shortDescription,
        amenities: mergedAmenities,
        vibes: finalVibes,
        cuisineTags: [],
        priceRange,
        priceRangeSource: snapshot?.priceLevel ? 'GOOGLE' : 'NONE',
        ratingOverride: snapshot?.rating != null ? String(snapshot.rating) : null,
        reviewCountOverride: snapshot?.reviewCount ?? null,
        isVerified: false,
        isActive: true,
        isFeatured: false,
        approvalStatus: 'PENDING',
        metadata: {
            importedFrom: 'mls_pub_partners_csv',
            importedAt: new Date().toISOString(),
            importScript: 'importMlsPubPartners',
            mlsClub: clubName,
            csvVenueWebsite: venueWebsite || null,
            galleryImageUrls: [],
        },
    };

    if (opts.dryRun) {
        console.log(`    ✅ [DRY RUN] Would insert: ${venueName} (${snapshotCity}) slug=${slug}`);
        console.log(`       Amenities: ${mergedAmenities.join(', ')}`);
        console.log(`       Instagram: ${instagramHandle ?? 'none'}`);
        return { venueName, clubName, status: 'skipped', googlePlaceId: placeId ?? undefined, reason: 'dry-run' };
    }

    try {
        const [inserted] = await db.insert(venues).values(insertPayload).returning({ id: venues.id });
        const venueId = inserted.id;

        // Link MLS team (best-effort — skip if table doesn't exist yet)
        try {
            const teamId = await findTeamId(teamDbName);
            if (teamId) {
                await linkTeamToVenue(venueId, teamId);
                console.log(`    🔗 Linked team: ${teamDbName}`);
            } else {
                console.log(`    ⚠️  Team not found in DB: ${teamDbName}`);
            }
        } catch (teamErr) {
            console.log(`    ⚠️  Team link skipped: ${(teamErr as Error).message}`);
        }

        return { venueName, clubName, status: 'inserted', venueId, googlePlaceId: placeId ?? undefined };
    } catch (err) {
        return { venueName, clubName, status: 'failed', reason: (err as Error).message };
    }
}

async function getActiveVibeSlugs(): Promise<Set<string>> {
    const rows = await db
        .select({ slug: venueAttributes.slug })
        .from(venueAttributes)
        .where(and(
            eq(venueAttributes.type, 'VIBE'),
            eq(venueAttributes.isActive, true),
        ));
    return new Set(rows.map((r) => r.slug));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const filePath = String(args.file ?? 'src/scripts/mls_pub_partners.csv');
    const dryRun = Boolean(args['dry-run']);
    const limit = args.limit ? parseInt(String(args.limit), 10) : undefined;
    const onlyClub = args.club ? String(args.club) : undefined;

    console.log('\n⚽  MatchWatch — MLS Pub Partners Importer');
    console.log('═══════════════════════════════════════════');
    console.log(`File:     ${filePath}`);
    console.log(`Dry run:  ${dryRun}`);
    console.log(`Limit:    ${limit ?? 'all'}`);
    console.log(`Club:     ${onlyClub ?? 'all'}`);
    console.log('═══════════════════════════════════════════\n');

    if (!process.env.GOOGLE_PLACES_API_KEY) {
        throw new Error('Missing GOOGLE_PLACES_API_KEY in .env');
    }

    // Read CSV
    let csvContent: string;
    try {
        csvContent = readFileSync(filePath, 'utf-8');
    } catch {
        throw new Error(`Cannot read file: ${filePath}`);
    }

    let rows = parseCsv(csvContent);
    console.log(`📋 Parsed ${rows.length} rows from CSV`);

    if (onlyClub) {
        rows = rows.filter((r) => r.clubName.toLowerCase().includes(onlyClub.toLowerCase()));
        console.log(`   Filtered to club "${onlyClub}": ${rows.length} rows`);
    }

    if (limit) {
        rows = rows.slice(0, limit);
        console.log(`   Limited to: ${rows.length} rows`);
    }

    // Prefetch
    const ownerId = await getSystemOwnerId();
    const allowedAmenities = await getActiveAmenitySlugs();
    console.log(`\n✓ System owner: ${ownerId}`);
    console.log(`✓ Allowed amenities: ${[...allowedAmenities].join(', ')}\n`);

    const results: ImportResult[] = [];
    let index = 0;

    for (const row of rows) {
        index++;
        console.log(`\n[${index}/${rows.length}] ${row.venueName} (${row.clubName})`);
        console.log(`   Website: ${row.venueWebsite || 'none'}`);

        const result = await importVenueRow(row, ownerId, allowedAmenities, { dryRun });
        results.push(result);

        if (result.status === 'inserted') {
            console.log(`   ✅ Inserted → ${result.venueId}`);
        } else if (result.status === 'updated') {
            console.log(`   🔄 Updated → ${result.venueId}`);
        } else if (result.status === 'skipped') {
            console.log(`   ⏭  Skipped: ${result.reason}`);
        } else {
            console.log(`   ❌ Failed: ${result.reason}`);
        }

        // Rate limiting: be polite to Google Places API
        await sleep(600);
    }

    // ─── Summary ─────────────────────────────────────────────────────────────
    const inserted = results.filter((r) => r.status === 'inserted');
    const updated = results.filter((r) => r.status === 'updated');
    const skipped = results.filter((r) => r.status === 'skipped');
    const failed = results.filter((r) => r.status === 'failed');

    console.log('\n═══════════════════════════════════════════');
    console.log('📊 Import Summary');
    console.log('═══════════════════════════════════════════');
    console.log(`  ✅ Inserted:  ${inserted.length}`);
    console.log(`  🔄 Updated:   ${updated.length}`);
    console.log(`  ⏭  Skipped:   ${skipped.length}`);
    console.log(`  ❌ Failed:    ${failed.length}`);
    console.log(`  📦 Total:     ${results.length}`);

    if (failed.length > 0) {
        console.log('\n  Failed venues:');
        failed.forEach((r) => console.log(`    • ${r.venueName} (${r.clubName}): ${r.reason}`));
    }

    if (inserted.length > 0) {
        console.log('\n  Sample inserted:');
        inserted.slice(0, 5).forEach((r) =>
            console.log(`    • ${r.venueName} → id=${r.venueId} placeId=${r.googlePlaceId}`),
        );
    }

    console.log('═══════════════════════════════════════════\n');
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('\n❌ Fatal error:', err instanceof Error ? err.message : err);
        process.exit(1);
    });
