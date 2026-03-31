import { and, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { menuCategories, menuItems, venues } from '../db/schema';
import type { GoogleSourceSnapshot } from './googlePlaces';
import { buildVenueImageRenderPayload, normalizeGoogleSourceSnapshot } from './venueImages';

function normalizeText(value: string | null | undefined) {
    return (value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function buildGoogleVenueFields(snapshot: GoogleSourceSnapshot) {
    const normalizedSnapshot = normalizeGoogleSourceSnapshot(snapshot);
    return {
        googlePlaceId: normalizedSnapshot.placeId,
        googleSourceSnapshot: normalizedSnapshot,
        googleLastSyncedAt: new Date(),
        googleSyncStatus: 'SYNCED' as const,
        googleSyncError: null,
        name: normalizedSnapshot.displayName,
        addressLine1: normalizedSnapshot.addressLine1 || normalizedSnapshot.formattedAddress || '',
        city: normalizedSnapshot.city || '',
        stateProvince: normalizedSnapshot.stateProvince || null,
        country: normalizedSnapshot.country || '',
        postalCode: normalizedSnapshot.postalCode || null,
        lat: normalizedSnapshot.lat != null ? String(normalizedSnapshot.lat) : null,
        lng: normalizedSnapshot.lng != null ? String(normalizedSnapshot.lng) : null,
        timezone: normalizedSnapshot.timezone || 'America/Chicago',
        phone: normalizedSnapshot.phone || null,
        website: normalizedSnapshot.website || null,
        googleMapsUrl: normalizedSnapshot.googleMapsUrl || null,
        ratingOverride: normalizedSnapshot.rating != null ? String(normalizedSnapshot.rating) : null,
        reviewCountOverride: normalizedSnapshot.reviewCount != null ? normalizedSnapshot.reviewCount : null,
        menuSource: normalizedSnapshot.menu ? 'GOOGLE' as const : 'NONE' as const,
    };
}

export async function applyGoogleMenuSnapshot(tx: any, venueId: string, snapshot: GoogleSourceSnapshot) {
    const categories = snapshot.menu?.categories || [];

    await tx.delete(menuItems).where(eq(menuItems.venueId, venueId));
    await tx.delete(menuCategories).where(eq(menuCategories.venueId, venueId));

    if (categories.length === 0) {
        return;
    }

    for (let categoryIndex = 0; categoryIndex < categories.length; categoryIndex += 1) {
        const category = categories[categoryIndex];
        const [createdCategory] = await tx.insert(menuCategories).values({
            venueId,
            name: category.name,
            description: category.description || null,
            sortOrder: categoryIndex,
            isActive: true,
        }).returning({ id: menuCategories.id });

        const items = (category.items || []).filter((item) => item.name?.trim());
        if (items.length === 0) continue;

        await tx.insert(menuItems).values(items.map((item, itemIndex) => ({
            venueId,
            categoryId: createdCategory.id,
            name: item.name.trim(),
            description: item.description || null,
            price: String(item.price ?? 0),
            currency: item.currency || 'USD',
            dietaryTags: item.dietaryTags || [],
            allergens: item.allergens || [],
            sortOrder: itemIndex,
            isAvailable: true,
            isFeatured: false,
        })));
    }
}

export async function findExistingVenueMatch(params: {
    googlePlaceId?: string | null;
    name?: string | null;
    addressLine1?: string | null;
    city?: string | null;
}) {
    if (params.googlePlaceId?.trim()) {
        const [byPlaceId] = await db.select({
            id: venues.id,
            name: venues.name,
            slug: venues.slug,
            ownerId: venues.ownerId,
            city: venues.city,
            approvalStatus: venues.approvalStatus,
        }).from(venues)
            .where(eq(venues.googlePlaceId, params.googlePlaceId.trim()))
            .limit(1);

        if (byPlaceId) return byPlaceId;
    }

    const normalizedName = normalizeText(params.name);
    const normalizedCity = normalizeText(params.city);
    const normalizedAddress = normalizeText(params.addressLine1);

    if (!normalizedName) return null;

    const candidates = await db.select({
        id: venues.id,
        name: venues.name,
        slug: venues.slug,
        ownerId: venues.ownerId,
        city: venues.city,
        addressLine1: venues.addressLine1,
        approvalStatus: venues.approvalStatus,
    }).from(venues)
        .where(and(
            ilike(venues.name, `%${params.name?.trim() || ''}%`),
            ...(params.city?.trim() ? [ilike(venues.city, `%${params.city.trim()}%`)] : []),
        ))
        .limit(10);

    return candidates.find((candidate) => {
        const candidateName = normalizeText(candidate.name);
        const candidateCity = normalizeText(candidate.city);
        const candidateAddress = normalizeText(candidate.addressLine1);
        const sameName = candidateName === normalizedName;
        const sameCity = !normalizedCity || candidateCity === normalizedCity;
        const sameAddress = !normalizedAddress || candidateAddress === normalizedAddress;
        return sameName && sameCity && sameAddress;
    }) || null;
}

export function getVenueMenuSourceState(venue: { menuSource?: string | null; googleSourceSnapshot?: unknown }) {
    if (venue.menuSource === 'MANUAL') return 'manual';
    const snapshot = venue.googleSourceSnapshot as Record<string, unknown> | null | undefined;
    const hasGoogleMenu = Boolean(snapshot && typeof snapshot === 'object' && snapshot.menu);
    if (hasGoogleMenu || venue.menuSource === 'GOOGLE') return 'google';
    return 'none';
}

export function buildVenueGoogleDefaults(snapshot: GoogleSourceSnapshot, options?: { slugOrId?: string }) {
    const normalizedSnapshot = normalizeGoogleSourceSnapshot(snapshot);
    const imagePayload = buildVenueImageRenderPayload({
        slugOrId: options?.slugOrId || normalizedSnapshot.placeId,
        snapshot: normalizedSnapshot,
        manualGalleryImageUrls: [],
    });

    return {
        placeId: normalizedSnapshot.placeId,
        displayName: normalizedSnapshot.displayName,
        formattedAddress: normalizedSnapshot.formattedAddress || '',
        name: normalizedSnapshot.displayName,
        addressLine1: normalizedSnapshot.addressLine1 || normalizedSnapshot.formattedAddress || '',
        city: normalizedSnapshot.city || '',
        stateProvince: normalizedSnapshot.stateProvince || '',
        country: normalizedSnapshot.country || '',
        postalCode: normalizedSnapshot.postalCode || '',
        lat: normalizedSnapshot.lat ?? undefined,
        lng: normalizedSnapshot.lng ?? undefined,
        timezone: normalizedSnapshot.timezone || 'America/Chicago',
        phone: normalizedSnapshot.phone || '',
        website: normalizedSnapshot.website || '',
        googleMapsUrl: normalizedSnapshot.googleMapsUrl || '',
        rating: normalizedSnapshot.rating ?? null,
        reviewCount: normalizedSnapshot.reviewCount ?? null,
        workingHours: normalizedSnapshot.workingHours || [],
        menu: normalizedSnapshot.menu || null,
        photos: normalizedSnapshot.photos || [],
        photosFetchedAt: normalizedSnapshot.photosFetchedAt || null,
        googleImageSelection: normalizedSnapshot.googleImageSelection || null,
        googleSuggestedImages: imagePayload.googleSuggestedImages,
    };
}
