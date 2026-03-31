import { load } from 'cheerio';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { priceRangeEnum, venueAttributes, venues } from '../db/schema';
import {
    deriveGoogleAmenitiesFromSnapshot,
    getGooglePlaceDetails,
    type GoogleMenuCategorySnapshot,
    type GoogleMenuItemSnapshot,
    type GoogleReviewSnapshot,
    type GoogleSourceSnapshot,
} from './googlePlaces';
import { logger } from './logger';
import { applyGoogleMenuSnapshot, buildGoogleVenueFields, buildVenueGoogleDefaults } from './venueOnboarding';

type VenueRow = Pick<typeof venues.$inferSelect,
    'id'
    | 'slug'
    | 'name'
    | 'description'
    | 'shortDescription'
    | 'descriptionSource'
    | 'shortDescriptionSource'
    | 'priceRange'
    | 'priceRangeSource'
    | 'menuSource'
    | 'phone'
    | 'website'
    | 'googleMapsUrl'
    | 'googlePlaceId'
    | 'googleSourceSnapshot'
    | 'googleLastSyncedAt'
    | 'googleSyncStatus'
    | 'googleSyncError'
    | 'ratingOverride'
    | 'reviewCountOverride'
    | 'amenities'
>;

type VenuePriceRange = typeof priceRangeEnum.enumValues[number];
type GoogleFieldSource = 'NONE' | 'GOOGLE' | 'MANUAL';

const MENU_FETCH_TIMEOUT_MS = 12000;
const STALE_GOOGLE_SYNC_MS = 24 * 60 * 60 * 1000;

function asNonEmptyString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function compactSentences(input: string, maxLength: number) {
    const normalized = input.replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    if (normalized.length <= maxLength) return normalized;
    const parts = normalized.split(/(?<=[.!?])\s+/);
    let built = '';
    for (const part of parts) {
        const next = built ? `${built} ${part}` : part;
        if (next.length > maxLength) break;
        built = next;
    }
    return (built || normalized.slice(0, maxLength)).trim();
}

function uniqueStrings(values: Array<string | null | undefined>) {
    return Array.from(new Set(values.map((value) => (value || '').trim()).filter(Boolean)));
}

function normalizePriceToken(priceLevel?: string | null) {
    const raw = (priceLevel || '').trim().toUpperCase();
    if (!raw) return null;
    return raw
        .replace(/^PRICE_LEVEL_/, '')
        .replace(/^LEVEL_/, '');
}

export function mapGooglePriceLevelToPriceRange(priceLevel?: string | null): VenuePriceRange | null {
    const token = normalizePriceToken(priceLevel);
    if (!token) return null;

    if (token === '0' || token === 'FREE' || token === 'INEXPENSIVE' || token === 'CHEAP') return 'BUDGET';
    if (token === '1' || token === '2' || token === 'MODERATE') return 'MID';
    if (token === '3' || token === 'EXPENSIVE') return 'UPSCALE';
    if (token === '4' || token === 'VERY_EXPENSIVE') return 'LUXURY';
    return null;
}

function humanPriceLabel(priceLevel?: string | null) {
    const mapped = mapGooglePriceLevelToPriceRange(priceLevel);
    if (!mapped) return null;
    return {
        BUDGET: 'budget-friendly',
        MID: 'moderately priced',
        UPSCALE: 'upscale',
        LUXURY: 'luxury',
    }[mapped];
}

function humanizeAmenity(slug: string) {
    return slug
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (match) => match.toUpperCase());
}

function inferVenueKind(snapshot: GoogleSourceSnapshot) {
    const raw = snapshot.raw && typeof snapshot.raw === 'object' ? snapshot.raw as Record<string, unknown> : {};
    const types = Array.isArray(raw.types) ? raw.types.filter((value): value is string => typeof value === 'string') : [];
    if (types.includes('brewpub')) return 'brewpub';
    if (types.includes('sports_bar')) return 'sports bar';
    if (types.includes('bar')) return 'bar';
    if (types.includes('pub')) return 'pub';
    if (types.includes('cafe')) return 'cafe';
    if (types.includes('restaurant')) return 'restaurant';
    const primaryType = asNonEmptyString(raw.primaryType);
    return primaryType ? primaryType.replace(/_/g, ' ') : 'venue';
}

export function buildGoogleVenueDescriptions(snapshot: GoogleSourceSnapshot, amenitySlugs: string[]) {
    const editorialSummary = asNonEmptyString(snapshot.editorialSummary);
    if (editorialSummary) {
        return {
            shortDescription: compactSentences(editorialSummary, 150),
            description: editorialSummary,
        };
    }

    const placeName = snapshot.displayName || 'This venue';
    const venueKind = inferVenueKind(snapshot);
    const location = uniqueStrings([snapshot.city, snapshot.stateProvince]).join(', ');
    const priceLabel = humanPriceLabel(snapshot.priceLevel);
    const amenityLabels = amenitySlugs.slice(0, 4).map(humanizeAmenity);
    const hoursHint = Array.isArray(snapshot.workingHours) && snapshot.workingHours.length > 0
        ? 'with Google-listed hours available'
        : null;

    const summaryParts = uniqueStrings([
        location ? `${venueKind} in ${location}` : venueKind,
        priceLabel,
        amenityLabels.length ? `known for ${amenityLabels.join(', ')}` : null,
    ]);

    const shortDescription = compactSentences(
        `${placeName} is a ${summaryParts.join(' with ')}.`.replace(/\s+/g, ' ').trim(),
        150,
    );

    const descriptionParts = [
        `${placeName} is a ${venueKind}${location ? ` in ${location}` : ''}.`,
        priceLabel ? `Google lists it as ${priceLabel}.` : null,
        amenityLabels.length ? `Current Google signals highlight ${amenityLabels.join(', ')}.` : null,
        hoursHint ? `${placeName} also has ${hoursHint}.` : null,
    ].filter(Boolean);

    return {
        shortDescription,
        description: descriptionParts.join(' ').trim(),
    };
}

function parseNumericPrice(value: string | null | undefined) {
    if (!value) return null;
    const normalized = value.replace(/[^0-9.]/g, '');
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

function normalizeMenuItem(item: Partial<GoogleMenuItemSnapshot> | null | undefined): GoogleMenuItemSnapshot | null {
    if (!item?.name || !item.name.trim()) return null;
    return {
        name: item.name.trim(),
        description: item.description?.trim() || null,
        price: item.price ?? null,
        currency: item.currency?.trim() || null,
        dietaryTags: Array.isArray(item.dietaryTags) ? uniqueStrings(item.dietaryTags) : [],
        allergens: Array.isArray(item.allergens) ? uniqueStrings(item.allergens) : [],
    };
}

function normalizeMenuCategory(category: Partial<GoogleMenuCategorySnapshot> | null | undefined): GoogleMenuCategorySnapshot | null {
    if (!category?.name || !category.name.trim()) return null;
    const items = (category.items || []).map((item) => normalizeMenuItem(item)).filter((item): item is GoogleMenuItemSnapshot => Boolean(item));
    if (items.length === 0) return null;
    return {
        name: category.name.trim(),
        description: category.description?.trim() || null,
        items,
    };
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
    if (Array.isArray(value)) return value;
    return value == null ? [] : [value];
}

function collectJson(value: unknown): Record<string, unknown>[] {
    if (Array.isArray(value)) {
        return value.flatMap((entry) => collectJson(entry));
    }
    if (!value || typeof value !== 'object') return [];
    const record = value as Record<string, unknown>;
    return [
        record,
        ...collectJson(record['@graph']),
        ...collectJson(record.mainEntity),
        ...collectJson(record.hasMenu),
        ...collectJson(record.hasPart),
    ];
}

function typeSet(record: Record<string, unknown>) {
    return new Set(asArray(record['@type']).map((entry) => String(entry).toLowerCase()));
}

function extractMenuSectionsFromJsonLd(value: unknown): GoogleMenuCategorySnapshot[] {
    const records = collectJson(value);
    const categories: GoogleMenuCategorySnapshot[] = [];

    const parseMenuItemNode = (node: Record<string, unknown>): GoogleMenuItemSnapshot | null => {
        const name = asNonEmptyString(node.name);
        if (!name) return null;
        const offers = asArray(node.offers)[0];
        const offerRecord = offers && typeof offers === 'object' ? offers as Record<string, unknown> : null;
        return normalizeMenuItem({
            name,
            description: asNonEmptyString(node.description),
            price: parseNumericPrice(asNonEmptyString(offerRecord?.price) || asNonEmptyString(node.price)),
            currency: asNonEmptyString(offerRecord?.priceCurrency),
        });
    };

    const parseMenuSectionNode = (node: Record<string, unknown>): GoogleMenuCategorySnapshot | null => {
        const sectionName = asNonEmptyString(node.name) || 'Menu';
        const itemNodes = uniqueNodes([
            ...asArray(node.hasMenuItem),
            ...asArray(node.hasPart),
            ...asArray(node.itemListElement),
        ]);
        const items = itemNodes
            .flatMap((child) => (child && typeof child === 'object') ? [child as Record<string, unknown>] : [])
            .map((child) => parseMenuItemNode(child))
            .filter((item): item is GoogleMenuItemSnapshot => Boolean(item));
        return normalizeMenuCategory({
            name: sectionName,
            description: asNonEmptyString(node.description),
            items,
        });
    };

    for (const record of records) {
        const types = typeSet(record);
        if (types.has('menusection')) {
            const section = parseMenuSectionNode(record);
            if (section) categories.push(section);
            continue;
        }

        if (types.has('menu')) {
            const sectionNodes = uniqueNodes([
                ...asArray(record.hasPart),
                ...asArray(record.hasMenuSection),
                ...asArray(record.itemListElement),
            ]);
            const sections = sectionNodes
                .flatMap((node) => (node && typeof node === 'object') ? [node as Record<string, unknown>] : [])
                .map((node) => parseMenuSectionNode(node))
                .filter((section): section is GoogleMenuCategorySnapshot => Boolean(section));
            if (sections.length) categories.push(...sections);
        }
    }

    return dedupeCategories(categories);
}

function uniqueNodes(values: unknown[]) {
    const seen = new Set<string>();
    const result: unknown[] = [];
    for (const value of values) {
        const key = JSON.stringify(value);
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(value);
    }
    return result;
}

function dedupeCategories(categories: GoogleMenuCategorySnapshot[]) {
    const seen = new Map<string, GoogleMenuCategorySnapshot>();
    for (const category of categories) {
        const key = category.name.trim().toLowerCase();
        if (!seen.has(key)) {
            seen.set(key, { ...category, items: [...category.items] });
            continue;
        }

        const existing = seen.get(key)!;
        const itemNames = new Set(existing.items.map((item) => item.name.trim().toLowerCase()));
        for (const item of category.items) {
            const itemKey = item.name.trim().toLowerCase();
            if (itemNames.has(itemKey)) continue;
            itemNames.add(itemKey);
            existing.items.push(item);
        }
    }
    return Array.from(seen.values()).filter((category) => category.items.length > 0);
}

function extractMenuSectionsHeuristically(html: string) {
    const $ = load(html);
    const categories: GoogleMenuCategorySnapshot[] = [];

    $('h1, h2, h3, h4').each((_, heading) => {
        const title = $(heading).text().replace(/\s+/g, ' ').trim();
        if (!title || title.length > 80) return;

        const items: GoogleMenuItemSnapshot[] = [];
        $(heading)
            .nextUntil('h1, h2, h3, h4')
            .find('li, article, .menu-item, .menuItem, .product, p')
            .each((__, itemNode) => {
                const text = $(itemNode).text().replace(/\s+/g, ' ').trim();
                if (!text || text.length < 4 || text.length > 180) return;
                const priceMatch = text.match(/([$€£]\s?\d+(?:[.,]\d{2})?)/);
                if (!priceMatch) return;
                const price = parseNumericPrice(priceMatch[1]);
                const name = text.replace(priceMatch[0], '').replace(/\s{2,}/g, ' ').trim().replace(/[-–|•]+$/, '').trim();
                if (!name || name.length > 80) return;
                const normalized = normalizeMenuItem({ name, price });
                if (normalized) items.push(normalized);
            });

        const category = normalizeMenuCategory({ name: title, items });
        if (category) categories.push(category);
    });

    return dedupeCategories(categories);
}

async function fetchHtml(url: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MENU_FETCH_TIMEOUT_MS);
    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'MatchWatchBot/1.0 (+https://matchwatch.us)',
                Accept: 'text/html,application/xhtml+xml',
            },
        });
        if (!response.ok) {
            throw new Error(`Menu fetch failed (${response.status})`);
        }
        return await response.text();
    } finally {
        clearTimeout(timeout);
    }
}

export async function enrichGoogleMenuSnapshot(snapshot: GoogleSourceSnapshot): Promise<GoogleSourceSnapshot> {
    if (!snapshot.menu?.sourceUrl) {
        return {
            ...snapshot,
            menu: snapshot.menu
                ? {
                    ...snapshot.menu,
                    scrapeStatus: 'UNAVAILABLE',
                    scrapedAt: new Date().toISOString(),
                    error: null,
                }
                : null,
        };
    }

    try {
        const html = await fetchHtml(snapshot.menu.sourceUrl);
        const $ = load(html);
        const parsedCategories: GoogleMenuCategorySnapshot[] = [];

        $('script[type="application/ld+json"]').each((_, scriptTag) => {
            const raw = $(scriptTag).contents().text();
            if (!raw.trim()) return;
            try {
                parsedCategories.push(...extractMenuSectionsFromJsonLd(JSON.parse(raw)));
            } catch {
                // Ignore malformed JSON-LD blocks.
            }
        });

        const categories = parsedCategories.length > 0
            ? dedupeCategories(parsedCategories)
            : extractMenuSectionsHeuristically(html);

        return {
            ...snapshot,
            menu: {
                sourceUrl: snapshot.menu.sourceUrl,
                categories,
                scrapeStatus: categories.length > 0 ? 'SYNCED' : 'ERROR',
                scrapedAt: new Date().toISOString(),
                error: categories.length > 0 ? null : 'No structured menu items were detected',
                raw: {
                    ...(snapshot.menu.raw || {}),
                    title: $('title').first().text().trim() || null,
                },
            },
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown menu scrape error';
        logger.warn({ sourceUrl: snapshot.menu.sourceUrl, message }, 'Google-linked menu scrape failed');
        return {
            ...snapshot,
            menu: {
                sourceUrl: snapshot.menu.sourceUrl,
                categories: [],
                scrapeStatus: 'ERROR',
                scrapedAt: new Date().toISOString(),
                error: message,
                raw: snapshot.menu.raw || null,
            },
        };
    }
}

async function getActiveAmenitySlugs() {
    const rows = await db.select({ slug: venueAttributes.slug }).from(venueAttributes)
        .where(and(eq(venueAttributes.type, 'AMENITY'), eq(venueAttributes.isActive, true)));
    return new Set(rows.map((row) => row.slug));
}

export async function getAllowedGoogleAmenities(snapshot?: GoogleSourceSnapshot | null) {
    if (!snapshot) return [] as string[];
    const allowedAmenitySlugs = await getActiveAmenitySlugs();
    return deriveGoogleAmenitiesFromSnapshot(snapshot).filter((amenity) => allowedAmenitySlugs.has(amenity));
}

export async function sanitizeAmenities(values: string[] | null | undefined) {
    const allowedAmenitySlugs = await getActiveAmenitySlugs();
    return (Array.isArray(values) ? values : []).filter((amenity) => allowedAmenitySlugs.has(amenity));
}

export async function mergeAmenitySets(...groups: Array<string[] | null | undefined>) {
    const allowedAmenitySlugs = await getActiveAmenitySlugs();
    const merged = new Set<string>();
    for (const group of groups) {
        for (const amenity of Array.isArray(group) ? group : []) {
            if (allowedAmenitySlugs.has(amenity)) merged.add(amenity);
        }
    }
    return Array.from(merged);
}

export async function getEnrichedGooglePlaceDetails(placeId: string) {
    const snapshot = await getGooglePlaceDetails(placeId);
    return enrichGoogleMenuSnapshot(snapshot);
}

export function isGoogleSyncStale(lastSyncedAt?: Date | null, now = new Date()) {
    if (!lastSyncedAt) return true;
    return now.getTime() - lastSyncedAt.getTime() >= STALE_GOOGLE_SYNC_MS;
}

export async function buildGoogleSyncUpdates(venue: VenueRow, snapshot: GoogleSourceSnapshot) {
    const googleFields = buildGoogleVenueFields(snapshot);
    const googleAmenities = await getAllowedGoogleAmenities(googleFields.googleSourceSnapshot as GoogleSourceSnapshot);
    const googleDescriptions = buildGoogleVenueDescriptions(snapshot, googleAmenities);
    const googlePriceRange = mapGooglePriceLevelToPriceRange(snapshot.priceLevel);

    const updates: Record<string, unknown> = {
        googlePlaceId: googleFields.googlePlaceId,
        googleSourceSnapshot: googleFields.googleSourceSnapshot,
        googleLastSyncedAt: new Date(),
        googleSyncStatus: 'SYNCED',
        googleSyncError: null,
        ratingOverride: googleFields.ratingOverride,
        reviewCountOverride: googleFields.reviewCountOverride,
        amenities: googleAmenities.length > 0
            ? await mergeAmenitySets(venue.amenities || [], googleAmenities)
            : await sanitizeAmenities(venue.amenities),
        phone: venue.phone || googleFields.phone,
        website: venue.website || googleFields.website,
        googleMapsUrl: venue.googleMapsUrl || googleFields.googleMapsUrl,
        updatedAt: new Date(),
    };

    if (venue.descriptionSource !== 'MANUAL' && googleDescriptions.description) {
        updates.description = googleDescriptions.description;
        updates.descriptionSource = 'GOOGLE';
    }
    if (venue.shortDescriptionSource !== 'MANUAL' && googleDescriptions.shortDescription) {
        updates.shortDescription = compactSentences(googleDescriptions.shortDescription, 280);
        updates.shortDescriptionSource = 'GOOGLE';
    }
    if (venue.priceRangeSource !== 'MANUAL' && googlePriceRange) {
        updates.priceRange = googlePriceRange;
        updates.priceRangeSource = 'GOOGLE';
    }
    if (venue.menuSource !== 'MANUAL') {
        updates.menuSource = snapshot.menu?.categories?.length ? 'GOOGLE' : 'NONE';
    }

    return {
        updates,
        googleAmenities,
        googleDescriptions,
        googlePriceRange,
        defaults: buildVenueGoogleDefaults(snapshot, { slugOrId: venue.slug || venue.id }),
    };
}

export async function refreshVenueFromGoogle(venue: VenueRow) {
    if (!venue.googlePlaceId) {
        throw new Error('Venue is not linked to a Google Place');
    }

    const snapshot = await getEnrichedGooglePlaceDetails(venue.googlePlaceId);
    const { updates, defaults } = await buildGoogleSyncUpdates(venue, snapshot);

    await db.transaction(async (tx) => {
        await tx.update(venues).set(updates).where(eq(venues.id, venue.id));
        if (venue.menuSource !== 'MANUAL' && snapshot.menu?.categories?.length) {
            await applyGoogleMenuSnapshot(tx, venue.id, snapshot);
        }
    });

    return { snapshot, updates, defaults };
}

export function getPublicGoogleReviews(snapshot: GoogleSourceSnapshot | null | undefined): GoogleReviewSnapshot[] {
    return Array.isArray(snapshot?.googleReviews) ? snapshot!.googleReviews : [];
}
