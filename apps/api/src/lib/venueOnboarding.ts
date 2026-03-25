import { and, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { menuCategories, menuItems, venues } from '../db/schema';
import type { GoogleSourceSnapshot } from './googlePlaces';

function normalizeText(value: string | null | undefined) {
    return (value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function buildGoogleVenueFields(snapshot: GoogleSourceSnapshot) {
    return {
        googlePlaceId: snapshot.placeId,
        googleSourceSnapshot: snapshot,
        googleLastSyncedAt: new Date(),
        googleSyncStatus: 'SYNCED' as const,
        googleSyncError: null,
        name: snapshot.displayName,
        addressLine1: snapshot.addressLine1 || snapshot.formattedAddress || '',
        city: snapshot.city || '',
        stateProvince: snapshot.stateProvince || null,
        country: snapshot.country || '',
        postalCode: snapshot.postalCode || null,
        lat: snapshot.lat != null ? String(snapshot.lat) : null,
        lng: snapshot.lng != null ? String(snapshot.lng) : null,
        timezone: snapshot.timezone || 'America/Chicago',
        phone: snapshot.phone || null,
        website: snapshot.website || null,
        googleMapsUrl: snapshot.googleMapsUrl || null,
        ratingOverride: snapshot.rating != null ? String(snapshot.rating) : null,
        reviewCountOverride: snapshot.reviewCount != null ? snapshot.reviewCount : null,
        menuSource: snapshot.menu ? 'GOOGLE' as const : 'NONE' as const,
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

export function buildVenueGoogleDefaults(snapshot: GoogleSourceSnapshot) {
    return {
        name: snapshot.displayName,
        addressLine1: snapshot.addressLine1 || snapshot.formattedAddress || '',
        city: snapshot.city || '',
        stateProvince: snapshot.stateProvince || '',
        country: snapshot.country || '',
        postalCode: snapshot.postalCode || '',
        lat: snapshot.lat ?? undefined,
        lng: snapshot.lng ?? undefined,
        timezone: snapshot.timezone || 'America/Chicago',
        phone: snapshot.phone || '',
        website: snapshot.website || '',
        googleMapsUrl: snapshot.googleMapsUrl || '',
        rating: snapshot.rating ?? null,
        reviewCount: snapshot.reviewCount ?? null,
        menu: snapshot.menu || null,
    };
}
