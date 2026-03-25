import { logger } from './logger';

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
    menu?: {
        sourceUrl?: string | null;
        categories: GoogleMenuCategorySnapshot[];
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

function ensureApiKey() {
    if (!GOOGLE_PLACES_API_KEY) {
        throw new Error('GOOGLE_PLACES_API_KEY is not configured');
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
    const directMenuUrl = getString(raw.menuUri) || getString(raw.menuUrl);
    const websiteUri = getString(raw.websiteUri);
    const websiteLooksLikeMenu = websiteUri && /menu/i.test(websiteUri) ? websiteUri : null;
    const sourceUrl = directMenuUrl || websiteLooksLikeMenu || null;

    const categoriesRaw = Array.isArray(raw.menuCategories) ? raw.menuCategories : [];
    const categories = categoriesRaw.flatMap((category): GoogleMenuCategorySnapshot[] => {
        if (!isRecord(category)) return [];
        const itemsRaw = Array.isArray(category.items) ? category.items : [];
        return [{
            name: getString(category.name) || 'Menu',
            description: getString(category.description),
            items: itemsRaw.flatMap((item): GoogleMenuItemSnapshot[] => {
                if (!isRecord(item)) return [];
                return [{
                    name: getString(item.name) || 'Item',
                    description: getString(item.description),
                    price: getNumber(item.price),
                    currency: getString(item.currency),
                    dietaryTags: Array.isArray(item.dietaryTags) ? item.dietaryTags.filter((v): v is string => typeof v === 'string') : [],
                    allergens: Array.isArray(item.allergens) ? item.allergens.filter((v): v is string => typeof v === 'string') : [],
                }];
            }),
        }];
    });

    if (!sourceUrl && categories.length === 0) return null;
    return {
        sourceUrl,
        categories,
        raw,
    };
}

function mapPlaceToSnapshot(place: Record<string, unknown>): GoogleSourceSnapshot {
    const location = isRecord(place.location) ? place.location : null;
    const addressComponents = place.addressComponents;
    const displayName = isRecord(place.displayName)
        ? getString(place.displayName.text) || 'Unknown venue'
        : getString(place.displayName) || 'Unknown venue';

    return {
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
        timezone: getString(place.timeZone?.toString?.()) || getString(place.timeZone),
        phone: getString(place.nationalPhoneNumber) || getString(place.internationalPhoneNumber),
        website: getString(place.websiteUri),
        googleMapsUrl: getString(place.googleMapsUri),
        rating: getNumber(place.rating),
        reviewCount: typeof place.userRatingCount === 'number' ? place.userRatingCount : null,
        menu: extractMenuSnapshot(place),
        raw: place,
    };
}

async function googleFetch<T>(url: string, init: RequestInit, context: string): Promise<T> {
    ensureApiKey();
    const response = await fetch(url, {
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
        throw new Error(`Google Places request failed (${response.status})`);
    }

    return bodyText ? JSON.parse(bodyText) as T : ({} as T);
}

export async function searchGooglePlaces(query: string): Promise<GooglePlaceSearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

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

    return (response.places || []).flatMap((place) => {
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
}

export async function getGooglePlaceDetails(placeId: string): Promise<GoogleSourceSnapshot> {
    const trimmed = placeId.trim();
    if (!trimmed) {
        throw new Error('placeId is required');
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
        'utcOffsetMinutes',
        'regularOpeningHours',
        'editorialSummary',
        'priceLevel',
        'primaryType',
        'types',
        'businessStatus',
        'menuUri',
        'menuUrl',
        'menuCategories',
    ].join(',');

    const response = await googleFetch<Record<string, unknown>>(
        `${GOOGLE_PLACES_BASE_URL}/places/${encodeURIComponent(trimmed)}`,
        {
            method: 'GET',
            headers: { 'X-Goog-FieldMask': fieldMask },
        },
        'getGooglePlaceDetails',
    );

    return mapPlaceToSnapshot(response);
}

export function hasGooglePlacesConfigured() {
    return Boolean(GOOGLE_PLACES_API_KEY);
}
