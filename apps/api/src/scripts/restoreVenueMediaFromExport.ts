import 'dotenv/config';

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { venues } from '../db/schema.js';

interface ExportVenue {
    name: string;
    slug: string;
    address: {
        line1: string;
        city: string;
        state: string;
        country: string;
    };
    website: string | null;
    coverImageUrl: string | null;
    galleryImageUrls: string[];
    googlePlaceId: string | null;
    importedAt?: string;
}

type MatchStrategy = 'slug' | 'google_place_id' | 'name_city_address' | 'name_city';

interface CurrentVenue {
    id: string;
    slug: string;
    name: string;
    city: string;
    addressLine1: string;
    website: string | null;
    coverImageUrl: string | null;
    googlePlaceId: string | null;
    metadata: unknown;
}

const EXPORT_PATHS = [
    resolve(process.cwd(), 'apps/api/venues-export.json'),
    resolve(process.cwd(), 'venues-export.json'),
];

function parseArgs(argv: string[]): Record<string, string | boolean> {
    const out: Record<string, string | boolean> = {};
    for (const raw of argv) {
        if (!raw.startsWith('--')) continue;
        const [key, value] = raw.slice(2).split('=', 2);
        out[key] = value ?? true;
    }
    return out;
}

function coerceMetadata(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
}

function normalize(value: string | null | undefined): string {
    return (value ?? '')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

function toKey(parts: Array<string | null | undefined>): string {
    return parts.map(normalize).join('|');
}

function firstUnique<T>(values: T[] | undefined): T | null {
    if (!values || values.length !== 1) return null;
    return values[0];
}

function loadExport(): ExportVenue[] {
    const exportPath = EXPORT_PATHS.find((candidate) => {
        try {
            readFileSync(candidate, 'utf8');
            return true;
        } catch {
            return false;
        }
    });

    if (!exportPath) {
        throw new Error(`Could not find venues export at any of: ${EXPORT_PATHS.join(', ')}`);
    }

    return JSON.parse(readFileSync(exportPath, 'utf8')) as ExportVenue[];
}

function pushIndex<T>(map: Map<string, T[]>, key: string, value: T) {
    if (!key || key === '||') return;
    const existing = map.get(key);
    if (existing) existing.push(value);
    else map.set(key, [value]);
}

function selectMatch(
    venue: CurrentVenue,
    bySlug: Map<string, ExportVenue[]>,
    byGooglePlaceId: Map<string, ExportVenue[]>,
    byNameCityAddress: Map<string, ExportVenue[]>,
    byNameCity: Map<string, ExportVenue[]>,
): { match: ExportVenue; strategy: MatchStrategy } | null {
    const slugMatch = firstUnique(bySlug.get(venue.slug));
    if (slugMatch) return { match: slugMatch, strategy: 'slug' };

    if (venue.googlePlaceId) {
        const googleMatch = firstUnique(byGooglePlaceId.get(venue.googlePlaceId));
        if (googleMatch) return { match: googleMatch, strategy: 'google_place_id' };
    }

    const fullKey = toKey([venue.name, venue.city, venue.addressLine1]);
    const fullMatch = firstUnique(byNameCityAddress.get(fullKey));
    if (fullMatch) return { match: fullMatch, strategy: 'name_city_address' };

    const nameCityKey = toKey([venue.name, venue.city]);
    const nameCityMatch = firstUnique(byNameCity.get(nameCityKey));
    if (nameCityMatch) return { match: nameCityMatch, strategy: 'name_city' };

    return null;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const dryRun = Boolean(args['dry-run']);
    const force = Boolean(args['force']);
    const limit = args.limit ? Number(args.limit) : undefined;

    const exportVenues = loadExport();
    const bySlug = new Map<string, ExportVenue[]>();
    const byGooglePlaceId = new Map<string, ExportVenue[]>();
    const byNameCityAddress = new Map<string, ExportVenue[]>();
    const byNameCity = new Map<string, ExportVenue[]>();

    for (const item of exportVenues) {
        pushIndex(bySlug, item.slug, item);
        if (item.googlePlaceId) pushIndex(byGooglePlaceId, item.googlePlaceId, item);
        pushIndex(byNameCityAddress, toKey([item.name, item.address.city, item.address.line1]), item);
        pushIndex(byNameCity, toKey([item.name, item.address.city]), item);
    }

    const rows = await db.select({
        id: venues.id,
        slug: venues.slug,
        name: venues.name,
        city: venues.city,
        addressLine1: venues.addressLine1,
        website: venues.website,
        coverImageUrl: venues.coverImageUrl,
        googlePlaceId: venues.googlePlaceId,
        metadata: venues.metadata,
    }).from(venues);

    const targetRows = limit ? rows.slice(0, limit) : rows;
    const summary = {
        scanned: targetRows.length,
        matched: 0,
        updated: 0,
        unchanged: 0,
        unmatched: 0,
        byStrategy: {
            slug: 0,
            google_place_id: 0,
            name_city_address: 0,
            name_city: 0,
        } as Record<MatchStrategy, number>,
    };
    const unmatched: string[] = [];

    for (const venue of targetRows) {
        const selected = selectMatch(venue, bySlug, byGooglePlaceId, byNameCityAddress, byNameCity);
        if (!selected) {
            summary.unmatched += 1;
            unmatched.push(`${venue.name} (${venue.city})`);
            continue;
        }

        summary.matched += 1;
        summary.byStrategy[selected.strategy] += 1;

        const exportVenue = selected.match;
        const metadata = coerceMetadata(venue.metadata);
        const existingGallery = Array.isArray(metadata.galleryUrls)
            ? metadata.galleryUrls
            : Array.isArray(metadata.galleryImageUrls)
                ? metadata.galleryImageUrls
                : [];

        const nextCoverImageUrl = force || !venue.coverImageUrl
            ? exportVenue.coverImageUrl ?? venue.coverImageUrl
            : venue.coverImageUrl;

        const nextGooglePlaceId = force || !venue.googlePlaceId
            ? exportVenue.googlePlaceId ?? venue.googlePlaceId
            : venue.googlePlaceId;

        const nextGallery = exportVenue.galleryImageUrls.length > 0
            ? exportVenue.galleryImageUrls
            : existingGallery;

        const nextMetadata = {
            ...metadata,
            galleryUrls: nextGallery,
            galleryImageUrls: nextGallery,
            importedPlaceId: exportVenue.googlePlaceId ?? metadata.importedPlaceId ?? null,
            restoredFromVenueExportAt: new Date().toISOString(),
            restoredFromVenueExportStrategy: selected.strategy,
            restoredFromVenueExportImportedAt: exportVenue.importedAt ?? null,
        };

        const coverChanged = (nextCoverImageUrl ?? null) !== (venue.coverImageUrl ?? null);
        const googleChanged = (nextGooglePlaceId ?? null) !== (venue.googlePlaceId ?? null);
        const galleryChanged = JSON.stringify(nextGallery) !== JSON.stringify(existingGallery);

        if (!coverChanged && !googleChanged && !galleryChanged && !force) {
            summary.unchanged += 1;
            continue;
        }

        if (!dryRun) {
            await db.update(venues).set({
                coverImageUrl: nextCoverImageUrl ?? null,
                googlePlaceId: nextGooglePlaceId ?? null,
                metadata: nextMetadata,
                updatedAt: new Date(),
            }).where(eq(venues.id, venue.id));
        }

        summary.updated += 1;
        console.log(`${dryRun ? '[dry-run] ' : ''}restored ${venue.name} via ${selected.strategy}`);
    }

    console.log(JSON.stringify({
        ...summary,
        unmatchedSample: unmatched.slice(0, 25),
    }, null, 2));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
    });
