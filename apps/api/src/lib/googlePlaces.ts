import { logger } from './logger';
import { redis } from './redis';
import {
    normalizeGooglePhotoSnapshots,
    normalizeGoogleSourceSnapshot,
    type GoogleImageSelectionSnapshot,
    type GooglePlacePhotoSnapshot,
} from './venueImages';

export type GoogleMenuItemSnapshot = {
    name: string;
    description?: string | null;
    price?: number | null;
    currency?: string | null;
    dietaryTags?: string[];
    allergens?: string[];
};

export type GoogleMenuCategorySnapshot = {
    name: string;
    description?: string | null;
    items: GoogleMenuItemSnapshot[];
};

export type GoogleReviewSnapshot = {
    authorName: string;
    authorUri?: string | null;
    authorPhotoUri?: string | null;
    rating?: number | null;
    text?: string | null;
    originalText?: string | null;
    publishTime?: string | null;
    relativePublishTimeDescription?: string | null;
    googleMapsUri?: string | null;
};

export type GoogleSourceSnapshot = {
    placeId: string;
    displayName: string;
    formattedAddress?: string | null;
    addressLine1?: string | null;
    city?: string | null;
    stateProvince?: string | null;
    country?: string | null;
    postalCode?: string | null;
    lat?: number | null;
    lng?: number | null;
    timezone?: string | null;
    phone?: string | null;
    website?: string | null;
    googleMapsUrl?: string | null;
    rating?: number | null;
    reviewCount?: number | null;
    editorialSummary?: string | null;
    priceLevel?: string | null;
    googleReviews?: GoogleReviewSnapshot[];
    workingHours?: Array<{
        day: string;
        hours: string;
        sortOrder: number;
        isClosed?: boolean;
        isTwentyFourHours?: boolean;
    }>;
    photos?: GooglePlacePhotoSnapshot[];
    photosFetchedAt?: string | null;
    googleImageSelection?: GoogleImageSelectionSnapshot | null;
    menu?: {
        sourceUrl?: string | null;
        categories: GoogleMenuCategorySnapshot[];
        scrapeStatus?: 'UNAVAILABLE' | 'PENDING' | 'SYNCED' | 'ERROR';
        scrapedAt?: string | null;
        error?: string | null;
        raw?: Record<string, unknown> | null;
    } | null;
    raw?: Record<string, unknown> | null;
};

export type GooglePlaceSearchResult = {
    placeId: string;
    displayName: string;
    formattedAddress?: string | null;
    city?: string | null;
    country?: string | null;
    rating?: number | null;
    reviewCount?: number | null;
};

const GOOGLE_PLACES_BASE_URL = process.env.GOOGLE_PLACES_BASE_URL || 'https://places.googleapis.com/v1';
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY?.trim();
const GOOGLE_SEARCH_CACHE_TTL_SECONDS = 30 * 60; // 30 minutes
const GOOGLE_PLACE_DETAILS_CACHE_TTL_SECONDS = 60 * 60; // 1 hour
const GOOGLE_PHOTO_URI_CACHE_TTL_SECONDS = 15 * 60; // 15 minutes

function ensureApiKey() {
    if (!GOOGLE_PLACES_API_KEY) {
        throw new Error('GOOGLE_PLACES_API_KEY is not configured');
    }
}

async function getJsonCache<T>(key: string): Promise<T | null> {
    try {
        const value = await redis.get(key);
        if (!value) return null;
        return JSON.parse(value) as T;
    } catch (error) {
        logger.warn({ key, error: error instanceof Error ? error.message : String(error) }, 'Redis cache read failed');
        return null;
    }
}

async function setJsonCache(key: string, value: unknown, ttlSeconds: number) {
    try {
        await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
        logger.warn({ key, error: error instanceof Error ? error.message : String(error) }, 'Redis cache write failed');
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function getNumber(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getBoolean(value: unknown) {
    return typeof value === 'boolean' ? value : null;
}

function getTimeZoneString(value: unknown) {
    if (typeof value === 'string') {
        return getString(value);
    }
    if (!isRecord(value)) {
        return null;
    }
    return getString(value.id)
        || getString(value.name)
        || getString(value.timeZoneId)
        || null;
}

function getAddressPart(addressComponents: unknown, type: string, useShortText = false) {
    if (!Array.isArray(addressComponents)) return null;
    for (const entry of addressComponents) {
        if (!isRecord(entry) || !Array.isArray(entry.types) || !entry.types.includes(type)) continue;
        return getString(useShortText ? entry.shortText : entry.longText);
    }
    return null;
}

function extractAddressLine1(addressComponents: unknown) {
    const streetNumber = getAddressPart(addressComponents, 'street_number');
    const route = getAddressPart(addressComponents, 'route');
    if (!streetNumber && !route) return null;
    return [streetNumber, route].filter(Boolean).join(' ');
}

function extractMenuSnapshot(raw: Record<string, unknown>): GoogleSourceSnapshot['menu'] {
    const websiteUri = getString(raw.websiteUri);
    const websiteLooksLikeMenu = websiteUri && /menu/i.test(websiteUri) ? websiteUri : null;
    const sourceUrl = websiteLooksLikeMenu || websiteUri || null;

    if (!sourceUrl) return null;
    return {
        sourceUrl,
        categories: [],
        scrapeStatus: 'PENDING',
        scrapedAt: null,
        error: null,
        raw: {
            websiteUri,
        },
    };
}

function extractWorkingHours(raw: Record<string, unknown>): GoogleSourceSnapshot['workingHours'] {
    const regularOpeningHours = isRecord(raw.regularOpeningHours) ? raw.regularOpeningHours : null;
    const weekdayDescriptions = Array.isArray(regularOpeningHours?.weekdayDescriptions)
        ? regularOpeningHours.weekdayDescriptions
        : [];

    const fallbackDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const rows = weekdayDescriptions.flatMap((entry, index) => {
        const line = getString(entry);
        if (!line) return [];

        const separatorIndex = line.indexOf(':');
        const day = separatorIndex >= 0 ? line.slice(0, separatorIndex).trim() : (fallbackDays[index] || `Day ${index + 1}`);
        const hours = separatorIndex >= 0 ? line.slice(separatorIndex + 1).trim() : line.trim();

        return [{
            day,
            hours: hours || 'Closed',
            sortOrder: index,
            isClosed: /closed/i.test(hours || ''),
            isTwentyFourHours: /24\s*hours/i.test(hours || ''),
        }];
    });

    return rows.length > 0 ? rows : [];
}

function extractPhotos(raw: Record<string, unknown>) {
    return normalizeGooglePhotoSnapshots(raw.photos);
}

function extractEditorialSummary(raw: Record<string, unknown>) {
    const summary = isRecord(raw.editorialSummary) ? raw.editorialSummary : null;
    return getString(summary?.text) || getString(raw.editorialSummary);
}

function extractPriceLevel(raw: Record<string, unknown>) {
    if (typeof raw.priceLevel === 'string') {
        return getString(raw.priceLevel);
    }
    if (typeof raw.priceLevel === 'number' && Number.isFinite(raw.priceLevel)) {
        return String(raw.priceLevel);
    }
    return null;
}

function extractGoogleReviews(raw: Record<string, unknown>): GoogleReviewSnapshot[] {
    if (!Array.isArray(raw.reviews)) return [];

    return raw.reviews.flatMap((entry) => {
        if (!isRecord(entry)) return [];
        const author = isRecord(entry.authorAttribution) ? entry.authorAttribution : null;
        const textRecord = isRecord(entry.text) ? entry.text : null;
        const originalTextRecord = isRecord(entry.originalText) ? entry.originalText : null;
        const authorName = getString(author?.displayName) || 'Google user';

        return [{
            authorName,
            authorUri: getString(author?.uri),
            authorPhotoUri: getString(author?.photoUri),
            rating: getNumber(entry.rating),
            text: getString(textRecord?.text) || getString(entry.text),
            originalText: getString(originalTextRecord?.text) || getString(entry.originalText),
            publishTime: getString(entry.publishTime),
            relativePublishTimeDescription: getString(entry.relativePublishTimeDescription),
            googleMapsUri: getString(entry.googleMapsUri),
        }];
    });
}

export function deriveGoogleAmenitiesFromSnapshot(snapshot: GoogleSourceSnapshot) {
    const raw = isRecord(snapshot.raw) ? snapshot.raw : {};
    const amenityTags = new Set<string>();
    const placeTypes = Array.isArray(raw.types)
        ? raw.types.filter((value): value is string => typeof value === 'string')
        : [];

    const servesBeer = getBoolean(raw.servesBeer);
    const servesWine = getBoolean(raw.servesWine);
    const servesCocktails = getBoolean(raw.servesCocktails);
    if (servesBeer || servesWine || servesCocktails) {
        amenityTags.add('ALCOHOLIC');
    }
    if (placeTypes.some((type) => ['bar', 'pub', 'brewpub', 'night_club'].includes(type))) {
        amenityTags.add('ALCOHOLIC');
    }

    if (getBoolean(raw.outdoorSeating)) {
        amenityTags.add('OUTDOOR');
    }

    if (getBoolean(raw.liveMusic)) {
        amenityTags.add('LIVE_MUSIC');
    }

    const parkingOptions = isRecord(raw.parkingOptions) ? raw.parkingOptions : null;
    if (parkingOptions) {
        if (
            getBoolean(parkingOptions.freeParkingLot)
            || getBoolean(parkingOptions.freeStreetParking)
            || getBoolean(parkingOptions.freeGarageParking)
        ) {
            amenityTags.add('PARKING');
        }
    }

    if (placeTypes.some((type) => ['restaurant', 'food', 'cafe', 'meal_takeaway', 'meal_delivery'].includes(type))) {
        amenityTags.add('FOOD');
    }

    return Array.from(amenityTags);
}

function mapPlaceToSnapshot(place: Record<string, unknown>): GoogleSourceSnapshot {
    const location = isRecord(place.location) ? place.location : null;
    const addressComponents = place.addressComponents;
    const displayName = isRecord(place.displayName)
        ? getString(place.displayName.text) || 'Unknown venue'
        : getString(place.displayName) || 'Unknown venue';

    return normalizeGoogleSourceSnapshot({
        placeId: getString(place.id) || '',
        displayName,
        formattedAddress: getString(place.formattedAddress),
        addressLine1: extractAddressLine1(addressComponents),
        city: getAddressPart(addressComponents, 'locality')
            || getAddressPart(addressComponents, 'postal_town')
            || getAddressPart(addressComponents, 'administrative_area_level_2'),
        stateProvince: getAddressPart(addressComponents, 'administrative_area_level_1'),
        country: getAddressPart(addressComponents, 'country', true) || getAddressPart(addressComponents, 'country'),
        postalCode: getAddressPart(addressComponents, 'postal_code'),
        lat: location ? getNumber(location.latitude) : null,
        lng: location ? getNumber(location.longitude) : null,
        timezone: getTimeZoneString(place.timeZone),
        phone: getString(place.nationalPhoneNumber) || getString(place.internationalPhoneNumber),
        website: getString(place.websiteUri),
        googleMapsUrl: getString(place.googleMapsUri),
        rating: getNumber(place.rating),
        reviewCount: typeof place.userRatingCount === 'number' ? place.userRatingCount : null,
        editorialSummary: extractEditorialSummary(place),
        priceLevel: extractPriceLevel(place),
        googleReviews: extractGoogleReviews(place),
        workingHours: extractWorkingHours(place),
        photos: extractPhotos(place),
        photosFetchedAt: new Date().toISOString(),
        menu: extractMenuSnapshot(place),
        raw: place,
    });
}

async function googleFetch<T>(url: string, init: RequestInit, context: string): Promise<T> {
    ensureApiKey();
    const urlWithKey = url.includes('?')
        ? `${url}&key=${encodeURIComponent(GOOGLE_PLACES_API_KEY!)}`
        : `${url}?key=${encodeURIComponent(GOOGLE_PLACES_API_KEY!)}`;

    const response = await fetch(urlWithKey, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY!,
            ...((init.headers || {}) as Record<string, string>),
        },
    });

    const bodyText = await response.text();
    if (!response.ok) {
        logger.warn({ context, status: response.status, bodyText }, 'Google Places request failed');
        const message = bodyText && bodyText.length < 1200
            ? `Google Places request failed (${response.status}): ${bodyText}`
            : `Google Places request failed (${response.status})`;
        throw new Error(message);
    }

    return bodyText ? JSON.parse(bodyText) as T : ({} as T);
}

export async function searchGooglePlaces(query: string): Promise<GooglePlaceSearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const cacheKey = `googlePlaces:search:${trimmed.toLowerCase()}`;
    const cached = await getJsonCache<GooglePlaceSearchResult[]>(cacheKey);
    if (cached) {
        return cached;
    }

    const payload = {
        textQuery: trimmed,
        languageCode: 'en',
        maxResultCount: 8,
    };

    const fieldMask = [
        'places.id',
        'places.displayName',
        'places.formattedAddress',
        'places.addressComponents',
        'places.rating',
        'places.userRatingCount',
    ].join(',');

    const response = await googleFetch<{ places?: Record<string, unknown>[] }>(
        `${GOOGLE_PLACES_BASE_URL}/places:searchText`,
        {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'X-Goog-FieldMask': fieldMask },
        },
        'searchGooglePlaces',
    );

    const results = (response.places || []).flatMap((place) => {
        if (!isRecord(place)) return [];
        const snapshot = mapPlaceToSnapshot(place);
        if (!snapshot.placeId) return [];
        return [{
            placeId: snapshot.placeId,
            displayName: snapshot.displayName,
            formattedAddress: snapshot.formattedAddress,
            city: snapshot.city,
            country: snapshot.country,
            rating: snapshot.rating,
            reviewCount: snapshot.reviewCount,
        }];
    });

    await setJsonCache(cacheKey, results, GOOGLE_SEARCH_CACHE_TTL_SECONDS);
    return results;
}

export async function getGooglePlaceDetails(placeId: string): Promise<GoogleSourceSnapshot> {
    const trimmed = placeId.trim();
    if (!trimmed) {
        throw new Error('placeId is required');
    }

    const cacheKey = `googlePlaces:details:${trimmed}`;
    const cached = await getJsonCache<GoogleSourceSnapshot>(cacheKey);
    if (cached) {
        return cached;
    }

    const fieldMask = [
        'id',
        'displayName',
        'formattedAddress',
        'addressComponents',
        'location',
        'nationalPhoneNumber',
        'internationalPhoneNumber',
        'websiteUri',
        'googleMapsUri',
        'rating',
        'userRatingCount',
        'reviews',
        'photos',
        'photos.name',
        'photos.widthPx',
        'photos.heightPx',
        'photos.authorAttributions.displayName',
        'photos.authorAttributions.uri',
        'photos.authorAttributions.photoUri',
        'timeZone',
        'regularOpeningHours',
        'regularOpeningHours.weekdayDescriptions',
        'outdoorSeating',
        'liveMusic',
        'servesBeer',
        'servesWine',
        'servesCocktails',
        'parkingOptions',
        'parkingOptions.freeParkingLot',
        'parkingOptions.freeStreetParking',
        'parkingOptions.freeGarageParking',
        'parkingOptions.valetParking',
        'accessibilityOptions',
        'accessibilityOptions.wheelchairAccessibleEntrance',
        'accessibilityOptions.wheelchairAccessibleRestroom',
        'accessibilityOptions.wheelchairAccessibleSeating',
        'accessibilityOptions.wheelchairAccessibleParking',
        'editorialSummary',
        'priceLevel',
        'primaryType',
        'types',
        'businessStatus',
    ].join(',');

    const response = await googleFetch<Record<string, unknown>>(
        `${GOOGLE_PLACES_BASE_URL}/places/${encodeURIComponent(trimmed)}`,
        {
            method: 'GET',
            headers: { 'X-Goog-FieldMask': fieldMask },
        },
        'getGooglePlaceDetails',
    );

    const snapshot = mapPlaceToSnapshot(response);
    await setJsonCache(cacheKey, snapshot, GOOGLE_PLACE_DETAILS_CACHE_TTL_SECONDS);
    return snapshot;
}

export async function getGooglePhotoMediaUri(photoName: string, maxWidthPx = 1600) {
    const trimmed = photoName.trim();
    if (!trimmed) {
        throw new Error('photoName is required');
    }

    const key = `googlePlaces:photoUri:${trimmed}:${Math.max(200, Math.min(4800, maxWidthPx))}`;
    const cached = await getJsonCache<{ photoUri: string }>(key);
    if (cached?.photoUri) {
        return cached.photoUri;
    }

    const encodedName = trimmed
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/');

    const response = await googleFetch<{ photoUri?: string }>(
        `${GOOGLE_PLACES_BASE_URL}/${encodedName}/media?maxWidthPx=${Math.max(200, Math.min(4800, maxWidthPx))}&skipHttpRedirect=true`,
        {
            method: 'GET',
        },
        'getGooglePhotoMediaUri',
    );

    const photoUri = getString(response.photoUri);
    if (!photoUri) {
        throw new Error('Google photo media URI not available');
    }

    await setJsonCache(key, { photoUri }, GOOGLE_PHOTO_URI_CACHE_TTL_SECONDS);
    return photoUri;
}

export function hasGooglePlacesConfigured() {
    return Boolean(GOOGLE_PLACES_API_KEY);
}
