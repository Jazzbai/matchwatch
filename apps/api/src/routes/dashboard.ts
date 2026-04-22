import { Hono } from 'hono';
import { db } from '../db/client';
import {
    venues, venueEvents, bookings, matches, posts, menuCategories, menuItems,
    follows, notifications, auditLogs, users, venueCustomEvents, venueClaims, venueAttributes,
} from '../db/schema';
import { eq, and, count, desc, asc, sql, gte, lt } from 'drizzle-orm';
import { apiResponse, apiError, paginationMeta, paginationOffset, generateUniqueSlug } from '../lib/utils';
import {
    createEventSchema, updateEventSchema, createPostSchema,
    createMenuCategorySchema, createMenuItemSchema, updateVenueSchema,
    notifyFollowersSchema, paginationSchema, updateBookingStatusSchema,
    createCustomVenueEventSchema, updateCustomVenueEventSchema,
} from '@matchwatch/shared';
import { authMiddleware, requireRole } from '../middleware';
import { z } from 'zod';
import { deleteStorageObjects } from '../lib/storage';
import { type GoogleSourceSnapshot } from '../lib/googlePlaces';
import {
    buildGoogleSyncUpdates,
    enrichGoogleMenuSnapshot,
    getAllowedGoogleAmenities,
    getEnrichedGooglePlaceDetails,
    mapGooglePriceLevelToPriceRange,
    mergeAmenitySets,
    refreshVenueFromGoogle,
    sanitizeAmenities,
} from '../lib/googleVenueSync';
import { applyGoogleMenuSnapshot, buildGoogleVenueFields, buildVenueGoogleDefaults, findExistingVenueMatch, getVenueMenuSourceState } from '../lib/venueOnboarding';
import {
    appendGoogleGalleryPhoto,
    buildVenueImageRenderPayload,
    normalizeGoogleSourceSnapshot,
    resetGoogleImageSelection,
    setGoogleCoverPhoto,
} from '../lib/venueImages';

const dashboardRoutes = new Hono();

// All dashboard routes require auth + business or admin role
dashboardRoutes.use('*', authMiddleware);
dashboardRoutes.use('*', requireRole('BUSINESS', 'VENUE_OWNER', 'ADMIN', 'SUPER_ADMIN'));

// Helper: get a specific venue owned by current user (or first active venue by default)
async function getOwnedVenue(userId: string, venueId?: string | null) {
    const normalizedVenueId = typeof venueId === 'string' && venueId.trim().length > 0 ? venueId.trim() : null;
    const [venue] = await db.select().from(venues)
        .where(and(
            eq(venues.ownerId, userId),
            eq(venues.isActive, true),
            ...(normalizedVenueId ? [eq(venues.id, normalizedVenueId)] : []),
        ))
        .orderBy(desc(venues.createdAt))
        .limit(1);
    return venue;
}

async function getOwnedVenues(userId: string) {
    return db.select({
        id: venues.id,
        name: venues.name,
        slug: venues.slug,
        city: venues.city,
        country: venues.country,
        isVerified: venues.isVerified,
        isFeatured: venues.isFeatured,
        approvalStatus: venues.approvalStatus,
        approvalNotes: venues.approvalNotes,
        googlePlaceId: venues.googlePlaceId,
        menuSource: venues.menuSource,
        createdAt: venues.createdAt,
    }).from(venues)
        .where(and(eq(venues.ownerId, userId), eq(venues.isActive, true)))
        .orderBy(desc(venues.createdAt));
}

function getRequestedVenueId(c: any) {
    const fromQuery = c.req.query('venueId');
    if (typeof fromQuery === 'string' && fromQuery.trim().length > 0) return fromQuery.trim();
    return null;
}

function galleryImageUrlsFromMetadata(metadata: unknown): string[] {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return [];
    const raw = (metadata as Record<string, unknown>).galleryImageUrls;
    if (!Array.isArray(raw)) return [];
    return raw.filter((value): value is string => typeof value === 'string').slice(0, 5);
}

function venueMetadataRecord(metadata: unknown): Record<string, unknown> {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
    return metadata as Record<string, unknown>;
}

function promotedVenueEventIdFromMetadata(metadata: unknown): string | null {
    const raw = venueMetadataRecord(metadata).promotedVenueEventId;
    return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
}

function normalizeStorageKey(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeStorageKeys(values: unknown) {
    if (!Array.isArray(values)) return [] as string[];
    return values
        .map((value) => normalizeStorageKey(value))
        .filter((value): value is string => Boolean(value));
}

async function cleanupRemovedVenueMedia(params: {
    previousCoverKey?: string | null;
    previousGalleryKeys?: string[] | null;
    nextCoverKey?: string | null;
    nextGalleryKeys?: string[] | null;
}) {
    const removedKeys = new Set<string>();
    const previousCoverKey = normalizeStorageKey(params.previousCoverKey);
    const nextCoverKey = normalizeStorageKey(params.nextCoverKey);

    if (previousCoverKey && previousCoverKey !== nextCoverKey) {
        removedKeys.add(previousCoverKey);
    }

    const nextGalleryKeySet = new Set(normalizeStorageKeys(params.nextGalleryKeys));
    for (const key of normalizeStorageKeys(params.previousGalleryKeys)) {
        if (!nextGalleryKeySet.has(key)) {
            removedKeys.add(key);
        }
    }

    if (removedKeys.size === 0) return;

    try {
        await deleteStorageObjects(Array.from(removedKeys));
    } catch {
        // Best effort cleanup only. Keep DB update successful even if object deletion fails.
    }
}

async function getVenueOr404(c: any) {
    const user = c.get('user');
    const requestedVenueId = getRequestedVenueId(c);
    const venue = await getOwnedVenue(user.id, requestedVenueId);
    if (!venue) {
        return {
            error: c.json(
                apiError('NOT_FOUND', requestedVenueId ? 'Venue not found for this business account' : 'No venue found'),
                404,
            ),
        } as const;
    }
    return { user, venue, requestedVenueId } as const;
}

async function getBusinessUser(userId: string) {
    const [user] = await db.select({
        id: users.id,
        role: users.role,
        email: users.email,
        businessApprovalStatus: users.businessApprovalStatus,
        businessApprovalNotes: users.businessApprovalNotes,
    }).from(users).where(eq(users.id, userId)).limit(1);
    return user || null;
}

async function ensureVenueOperationalAccess(userId: string, venueId: string) {
    const [row] = await db.select({
        venueId: venues.id,
        venueApprovalStatus: venues.approvalStatus,
        businessApprovalStatus: users.businessApprovalStatus,
    }).from(venues)
        .innerJoin(users, eq(venues.ownerId, users.id))
        .where(and(eq(venues.id, venueId), eq(users.id, userId)))
        .limit(1);

    if (!row) {
        return { error: apiError('NOT_FOUND', 'Venue not found') };
    }

    if (row.businessApprovalStatus !== 'APPROVED') {
        return { error: apiError('FORBIDDEN', 'Business profile is pending admin approval') };
    }

    if (row.venueApprovalStatus !== 'APPROVED') {
        return { error: apiError('FORBIDDEN', 'Venue is pending admin approval') };
    }

    return { ok: true as const };
}

function googleSnapshotFromVenue(venue: { googleSourceSnapshot?: unknown }): GoogleSourceSnapshot | null {
    if (!venue.googleSourceSnapshot || typeof venue.googleSourceSnapshot !== 'object' || Array.isArray(venue.googleSourceSnapshot)) {
        return null;
    }
    return venue.googleSourceSnapshot as GoogleSourceSnapshot;
}

function venueImagePayloadForOwnedVenue(venue: typeof venues.$inferSelect) {
    return buildVenueImageRenderPayload({
        slugOrId: venue.slug || venue.id,
        coverImageUrl: venue.coverImageUrl,
        manualGalleryImageUrls: galleryImageUrlsFromMetadata(venue.metadata),
        snapshot: googleSnapshotFromVenue(venue),
    });
}

async function deactivateExpiredCustomEvents(venueId: string) {
    await db.update(venueCustomEvents).set({
        isActive: false,
        updatedAt: new Date(),
    }).where(and(
        eq(venueCustomEvents.venueId, venueId),
        eq(venueCustomEvents.isActive, true),
        lt(venueCustomEvents.endsAt, new Date()),
    ));
}

// ─── GET /overview ──────────────────────────────
async function getOverviewHandler(c: any) {
    const context = await getVenueOr404(c);
    if ('error' in context) return context.error;
    const { venue } = context;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [totalBookings] = await db.select({ count: count() })
        .from(bookings)
        .innerJoin(venueEvents, eq(bookings.venueEventId, venueEvents.id))
        .where(and(eq(venueEvents.venueId, venue.id), eq(bookings.status, 'CONFIRMED')));

    const [recentBookings] = await db.select({ count: count() })
        .from(bookings)
        .innerJoin(venueEvents, eq(bookings.venueEventId, venueEvents.id))
        .where(and(
            eq(venueEvents.venueId, venue.id),
            eq(bookings.status, 'CONFIRMED'),
            gte(bookings.createdAt, thirtyDaysAgo),
        ));

    const [followerCount] = await db.select({ count: count() }).from(follows).where(eq(follows.venueId, venue.id));

    const upcomingEvents = await db.select({
        event: venueEvents,
        match: matches,
    })
        .from(venueEvents)
        .innerJoin(matches, eq(venueEvents.matchId, matches.id))
        .where(and(eq(venueEvents.venueId, venue.id), eq(venueEvents.isActive, true), gte(matches.matchDateUtc, now)))
        .orderBy(asc(matches.matchDateUtc))
        .limit(5);
    const imagePayload = venueImagePayloadForOwnedVenue(venue);

    return c.json(apiResponse({
        venue: {
            ...venue,
            ...imagePayload,
            menuSourceState: getVenueMenuSourceState(venue),
        },
        stats: {
            totalBookings: Number(totalBookings?.count ?? 0),
            recentBookings: Number(recentBookings?.count ?? 0),
            followers: Number(followerCount?.count ?? 0),
            averageRating: venue.averageRating,
            totalReviews: venue.totalReviews,
        },
        upcomingEvents: upcomingEvents.map(e => ({
            ...e.event,
            match: e.match,
            spotsRemaining: e.event.bookingLimit ? e.event.bookingLimit - e.event.confirmedBookingsCount : null,
        })),
    }));
}

dashboardRoutes.get('/', getOverviewHandler);
dashboardRoutes.get('/overview', getOverviewHandler);

const createOwnedVenueSchema = z.object({
    googlePlaceId: z.string().max(255).optional(),
    name: z.string().min(2).max(150),
    addressLine1: z.string().min(3).max(255),
    city: z.string().min(2).max(100),
    country: z.string().min(2).max(100),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    timezone: z.string().min(3).max(50).default('America/Chicago'),
    stateProvince: z.string().max(100).optional(),
    postalCode: z.string().max(20).optional(),
    phone: z.string().max(30).optional(),
    description: z.string().max(5000).optional(),
    shortDescription: z.string().max(280).optional(),
    amenities: z.array(z.string().min(1).max(80)).max(60).default([]),
    vibes: z.array(z.string().min(1).max(80)).max(60).default([]),
    cuisineTags: z.array(z.string().min(1).max(80)).max(60).default([]),
    priceRange: z.enum(['BUDGET', 'MID', 'UPSCALE', 'LUXURY']).default('MID'),
    capacity: z.number().int().positive().optional(),
});

dashboardRoutes.get('/venues', async (c) => {
    const user = c.get('user');
    const rows = await getOwnedVenues(user.id);
    return c.json(apiResponse(rows));
});

dashboardRoutes.post('/venues', async (c) => {
    const user = c.get('user');
    const businessUser = await getBusinessUser(user.id);
    if (!businessUser) {
        return c.json(apiError('NOT_FOUND', 'Business account not found'), 404);
    }

    if (businessUser.businessApprovalStatus !== 'APPROVED') {
        return c.json(apiError('FORBIDDEN', 'Your business profile must be approved before you can submit additional venues'), 403);
    }

    const body = await c.req.json().catch(() => ({}));
    const parsed = createOwnedVenueSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    let googleFields: ReturnType<typeof buildGoogleVenueFields> | null = null;
    let googleSnapshot: GoogleSourceSnapshot | null = null;
    if (parsed.data.googlePlaceId?.trim()) {
        googleSnapshot = await getEnrichedGooglePlaceDetails(parsed.data.googlePlaceId.trim());
        googleFields = buildGoogleVenueFields(googleSnapshot);
    }
    const googleAmenities = await getAllowedGoogleAmenities(
        googleFields ? (googleFields.googleSourceSnapshot as GoogleSourceSnapshot) : null,
    );

    const existingVenue = await findExistingVenueMatch({
        googlePlaceId: parsed.data.googlePlaceId,
        name: parsed.data.name,
        addressLine1: parsed.data.addressLine1,
        city: parsed.data.city,
    });
    if (existingVenue) {
        return c.json(apiError('CONFLICT', 'This venue already exists. Own this business? Claim it now!', {
            venueId: existingVenue.id,
            venueName: existingVenue.name,
            venueSlug: existingVenue.slug,
            venueCity: existingVenue.city,
        }), 409);
    }

    const nextAmenities = await mergeAmenitySets(parsed.data.amenities || [], googleAmenities);

    const created = await db.transaction(async (tx) => {
        const venueInsert: typeof venues.$inferInsert = {
            ownerId: user.id,
            name: parsed.data.name.trim(),
            slug: generateUniqueSlug(parsed.data.name.trim()),
            description: parsed.data.description || null,
            shortDescription: parsed.data.shortDescription || null,
            descriptionSource: parsed.data.description?.trim() ? 'MANUAL' : 'NONE',
            shortDescriptionSource: parsed.data.shortDescription?.trim() ? 'MANUAL' : 'NONE',
            addressLine1: parsed.data.addressLine1.trim(),
            city: parsed.data.city.trim(),
            stateProvince: parsed.data.stateProvince || null,
            country: parsed.data.country.trim(),
            postalCode: parsed.data.postalCode || null,
            lat: String(parsed.data.lat),
            lng: String(parsed.data.lng),
            timezone: parsed.data.timezone.trim(),
            phone: parsed.data.phone || null,
            capacity: parsed.data.capacity || null,
            amenities: nextAmenities,
            vibes: parsed.data.vibes,
            cuisineTags: parsed.data.cuisineTags,
            priceRange: parsed.data.priceRange,
            priceRangeSource: 'MANUAL',
            approvalStatus: 'PENDING',
            approvalNotes: null,
            isActive: true,
        };

        if (googleFields) {
            venueInsert.googlePlaceId = googleFields.googlePlaceId;
            venueInsert.googleSourceSnapshot = googleFields.googleSourceSnapshot as unknown as Record<string, unknown>;
            venueInsert.googleLastSyncedAt = new Date();
            venueInsert.googleSyncStatus = 'SYNCED';
            venueInsert.googleSyncError = null;
            venueInsert.phone = googleFields.phone;
            venueInsert.website = googleFields.website;
            venueInsert.googleMapsUrl = googleFields.googleMapsUrl;
            venueInsert.ratingOverride = googleFields.ratingOverride;
            venueInsert.reviewCountOverride = googleFields.reviewCountOverride;
            venueInsert.menuSource = googleFields.googleSourceSnapshot.menu?.categories?.length ? 'GOOGLE' : 'NONE';

            const googlePriceRange = mapGooglePriceLevelToPriceRange(googleSnapshot?.priceLevel);
            if (!parsed.data.description?.trim() && googleSnapshot) {
                const syncPayload = await buildGoogleSyncUpdates({
                    id: 'pending',
                    slug: '',
                    name: parsed.data.name.trim(),
                    description: null,
                    shortDescription: null,
                    descriptionSource: 'NONE',
                    shortDescriptionSource: 'NONE',
                    priceRange: parsed.data.priceRange,
                    priceRangeSource: 'NONE',
                    menuSource: 'NONE',
                    phone: null,
                    website: null,
                    googleMapsUrl: null,
                    googlePlaceId: googleFields.googlePlaceId,
                    googleSourceSnapshot: {},
                    googleLastSyncedAt: null,
                    googleSyncStatus: 'NEVER_SYNCED',
                    googleSyncError: null,
                    ratingOverride: null,
                    reviewCountOverride: null,
                    amenities: nextAmenities,
                }, googleSnapshot);
                venueInsert.description = (syncPayload.updates.description as string | null | undefined) || venueInsert.description;
                venueInsert.shortDescription = (syncPayload.updates.shortDescription as string | null | undefined) || venueInsert.shortDescription;
                venueInsert.descriptionSource = (syncPayload.updates.descriptionSource as 'NONE' | 'GOOGLE' | 'MANUAL' | undefined) || venueInsert.descriptionSource;
                venueInsert.shortDescriptionSource = (syncPayload.updates.shortDescriptionSource as 'NONE' | 'GOOGLE' | 'MANUAL' | undefined) || venueInsert.shortDescriptionSource;
            }
            if (googlePriceRange) {
                venueInsert.priceRange = googlePriceRange;
                venueInsert.priceRangeSource = 'GOOGLE';
            }
        }

        const [createdVenue] = await tx.insert(venues).values(venueInsert).returning({
            id: venues.id,
            name: venues.name,
            slug: venues.slug,
            city: venues.city,
            country: venues.country,
            approvalStatus: venues.approvalStatus,
        });

        if (googleFields?.googleSourceSnapshot.menu?.categories?.length) {
            await applyGoogleMenuSnapshot(tx, createdVenue.id, googleFields.googleSourceSnapshot as GoogleSourceSnapshot);
        }

        return createdVenue;
    });

    await db.insert(auditLogs).values({
        userId: user.id,
        action: 'VENUE_SUBMITTED',
        entityType: 'Venue',
        entityId: created.id,
    });

    if (user.role === 'USER' || user.role === 'VENUE_OWNER') {
        await db.update(users).set({
            role: 'BUSINESS',
            updatedAt: new Date(),
        }).where(eq(users.id, user.id));
    }

    return c.json(apiResponse(created), 201);
});

dashboardRoutes.patch('/venues/:venueId', async (c) => {
    const user = c.get('user');
    const venueId = c.req.param('venueId');
    const [ownedVenue] = await db.select({
        id: venues.id,
        metadata: venues.metadata,
        coverImageS3Key: venues.coverImageS3Key,
        galleryS3Keys: venues.galleryS3Keys,
    }).from(venues)
        .where(and(eq(venues.id, venueId), eq(venues.ownerId, user.id), eq(venues.isActive, true)))
        .limit(1);

    if (!ownedVenue) {
        return c.json(apiError('NOT_FOUND', 'Venue not found for this business account'), 404);
    }

    const body = await c.req.json().catch(() => ({}));
    const parsed = updateVenueSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.description !== undefined) updates.description = parsed.data.description;
    if (parsed.data.shortDescription !== undefined) updates.shortDescription = parsed.data.shortDescription;
    if (parsed.data.addressLine1 !== undefined) updates.addressLine1 = parsed.data.addressLine1;
    if (parsed.data.addressLine2 !== undefined) updates.addressLine2 = parsed.data.addressLine2;
    if (parsed.data.city !== undefined) updates.city = parsed.data.city;
    if (parsed.data.stateProvince !== undefined) updates.stateProvince = parsed.data.stateProvince;
    if (parsed.data.country !== undefined) updates.country = parsed.data.country;
    if (parsed.data.postalCode !== undefined) updates.postalCode = parsed.data.postalCode;
    if (parsed.data.lat !== undefined) updates.lat = String(parsed.data.lat);
    if (parsed.data.lng !== undefined) updates.lng = String(parsed.data.lng);
    if (parsed.data.timezone !== undefined) updates.timezone = parsed.data.timezone;
    if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone;
    if (parsed.data.website !== undefined) updates.website = parsed.data.website;
    if (parsed.data.instagramHandle !== undefined) updates.instagramHandle = parsed.data.instagramHandle;
    if (parsed.data.googleMapsUrl !== undefined) updates.googleMapsUrl = parsed.data.googleMapsUrl;
    if (parsed.data.capacity !== undefined) updates.capacity = parsed.data.capacity;
    if (parsed.data.amenities !== undefined) updates.amenities = await sanitizeAmenities(parsed.data.amenities);
    if (parsed.data.vibes !== undefined) updates.vibes = parsed.data.vibes;
    if (parsed.data.cuisineTags !== undefined) updates.cuisineTags = parsed.data.cuisineTags;
    if (parsed.data.priceRange !== undefined) updates.priceRange = parsed.data.priceRange;
    if (parsed.data.coverImageUrl !== undefined) updates.coverImageUrl = parsed.data.coverImageUrl;
    if (parsed.data.coverImageS3Key !== undefined) updates.coverImageS3Key = parsed.data.coverImageS3Key;
    if (parsed.data.galleryS3Keys !== undefined) updates.galleryS3Keys = parsed.data.galleryS3Keys.slice(0, 5);
    if (parsed.data.galleryImageUrls !== undefined) {
        const currentMetadata = venueMetadataRecord(ownedVenue.metadata);
        updates.metadata = {
            ...currentMetadata,
            galleryImageUrls: parsed.data.galleryImageUrls.slice(0, 5),
        };
    }

    await db.update(venues).set(updates).where(eq(venues.id, venueId));
    await cleanupRemovedVenueMedia({
        previousCoverKey: ownedVenue.coverImageS3Key,
        previousGalleryKeys: ownedVenue.galleryS3Keys,
        nextCoverKey: parsed.data.coverImageS3Key !== undefined ? parsed.data.coverImageS3Key : ownedVenue.coverImageS3Key,
        nextGalleryKeys: parsed.data.galleryS3Keys !== undefined ? parsed.data.galleryS3Keys.slice(0, 5) : ownedVenue.galleryS3Keys,
    });
    return c.json(apiResponse({ message: 'Venue updated' }));
});

dashboardRoutes.delete('/venues/:venueId', async (c) => {
    const user = c.get('user');
    const venueId = c.req.param('venueId');
    const [ownedVenue] = await db.select({ id: venues.id, metadata: venues.metadata }).from(venues)
        .where(and(eq(venues.id, venueId), eq(venues.ownerId, user.id), eq(venues.isActive, true)))
        .limit(1);

    if (!ownedVenue) {
        return c.json(apiError('NOT_FOUND', 'Venue not found for this business account'), 404);
    }

    await db.transaction(async (tx) => {
        await tx.update(venueEvents).set({
            isActive: false,
            updatedAt: new Date(),
        }).where(eq(venueEvents.venueId, venueId));

        await tx.update(venueCustomEvents).set({
            isActive: false,
            updatedAt: new Date(),
        }).where(eq(venueCustomEvents.venueId, venueId));

        await tx.update(menuCategories).set({ isActive: false }).where(eq(menuCategories.venueId, venueId));

        await tx.update(venues).set({
            isActive: false,
            deletedAt: new Date(),
            updatedAt: new Date(),
            metadata: {
                ...venueMetadataRecord(ownedVenue.metadata),
                promotedVenueEventId: null,
            },
        }).where(eq(venues.id, venueId));
    });

    const remaining = await getOwnedVenues(user.id);
    if (remaining.length === 0 && (user.role === 'BUSINESS' || user.role === 'VENUE_OWNER')) {
        await db.update(users).set({
            role: 'USER',
            updatedAt: new Date(),
        }).where(eq(users.id, user.id));
    }

    return c.json(apiResponse({
        message: 'Venue archived',
        remainingVenues: remaining.length,
        demotedToUser: remaining.length === 0,
    }));
});

// ─── Venue Profile ──────────────────────────────
dashboardRoutes.get('/venue', async (c) => {
    const context = await getVenueOr404(c);
    if ('error' in context) return context.error;
    const venue = context.venue;
    const imagePayload = venueImagePayloadForOwnedVenue(venue);
    const googleSnapshot = googleSnapshotFromVenue(venue);
    const manualGalleryImageUrls = galleryImageUrlsFromMetadata(venue.metadata);
    return c.json(apiResponse({
        ...venue,
        coverImageUrl: venue.coverImageUrl || null,
        galleryImageUrls: manualGalleryImageUrls,
        resolvedCoverImageUrl: imagePayload.coverImageUrl,
        resolvedGalleryImageUrls: imagePayload.galleryImageUrls,
        imageSource: imagePayload.imageSource,
        coverImageAttributions: imagePayload.coverImageAttributions,
        galleryImageAttributions: imagePayload.galleryImageAttributions,
        promotedVenueEventId: promotedVenueEventIdFromMetadata(venue.metadata),
        menuSourceState: getVenueMenuSourceState(venue),
        googleDefaults: googleSnapshot ? buildVenueGoogleDefaults(googleSnapshot, { slugOrId: venue.slug || venue.id }) : null,
    }));
});

async function updateVenueHandler(c: any) {
    const context = await getVenueOr404(c);
    if ('error' in context) return context.error;
    const { user, venue } = context;

    const body = await c.req.json();
    const parsed = updateVenueSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    let googleFields: ReturnType<typeof buildGoogleVenueFields> | null = null;
    let googleSnapshot: GoogleSourceSnapshot | null = null;
    let googleManagedUpdates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.googlePlaceId?.trim()) {
        googleSnapshot = await getEnrichedGooglePlaceDetails(parsed.data.googlePlaceId.trim());
        const existingVenue = await findExistingVenueMatch({
            googlePlaceId: googleSnapshot.placeId,
            name: googleSnapshot.displayName,
            addressLine1: googleSnapshot.addressLine1,
            city: googleSnapshot.city,
        });
        if (existingVenue && existingVenue.id !== venue.id) {
            return c.json(apiError('CONFLICT', 'This venue already exists. Own this business? Claim it now!', {
                venueId: existingVenue.id,
                venueName: existingVenue.name,
                venueSlug: existingVenue.slug,
                venueCity: existingVenue.city,
            }), 409);
        }
        googleFields = buildGoogleVenueFields(googleSnapshot);
        googleManagedUpdates = (await buildGoogleSyncUpdates(venue, googleSnapshot)).updates;
    }

    const updates: Record<string, unknown> = { ...googleManagedUpdates, updatedAt: new Date() };
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.description !== undefined) {
        updates.description = parsed.data.description;
        updates.descriptionSource = 'MANUAL';
    }
    if (parsed.data.shortDescription !== undefined) {
        updates.shortDescription = parsed.data.shortDescription;
        updates.shortDescriptionSource = 'MANUAL';
    }
    if (parsed.data.addressLine1 !== undefined) updates.addressLine1 = parsed.data.addressLine1;
    if (parsed.data.addressLine2 !== undefined) updates.addressLine2 = parsed.data.addressLine2;
    if (parsed.data.city !== undefined) updates.city = parsed.data.city;
    if (parsed.data.stateProvince !== undefined) updates.stateProvince = parsed.data.stateProvince;
    if (parsed.data.country !== undefined) updates.country = parsed.data.country;
    if (parsed.data.postalCode !== undefined) updates.postalCode = parsed.data.postalCode;
    if (parsed.data.lat !== undefined) updates.lat = String(parsed.data.lat);
    if (parsed.data.lng !== undefined) updates.lng = String(parsed.data.lng);
    if (parsed.data.timezone !== undefined) updates.timezone = parsed.data.timezone;
    if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone;
    if (parsed.data.website !== undefined) updates.website = parsed.data.website;
    if (parsed.data.instagramHandle !== undefined) updates.instagramHandle = parsed.data.instagramHandle;
    if (parsed.data.googleMapsUrl !== undefined) updates.googleMapsUrl = parsed.data.googleMapsUrl;
    if (parsed.data.capacity !== undefined) updates.capacity = parsed.data.capacity;
    if (parsed.data.amenities !== undefined) {
        const googleAmenities = await getAllowedGoogleAmenities(googleSnapshot);
        updates.amenities = await mergeAmenitySets(parsed.data.amenities || [], googleAmenities);
    }
    if (parsed.data.vibes !== undefined) updates.vibes = parsed.data.vibes;
    if (parsed.data.cuisineTags !== undefined) updates.cuisineTags = parsed.data.cuisineTags;
    if (parsed.data.priceRange !== undefined) {
        updates.priceRange = parsed.data.priceRange;
        updates.priceRangeSource = 'MANUAL';
    }
    if (parsed.data.coverImageUrl !== undefined) updates.coverImageUrl = parsed.data.coverImageUrl;
    if (parsed.data.coverImageS3Key !== undefined) updates.coverImageS3Key = parsed.data.coverImageS3Key;
    if (parsed.data.galleryS3Keys !== undefined) updates.galleryS3Keys = parsed.data.galleryS3Keys.slice(0, 5);
    if (parsed.data.galleryImageUrls !== undefined) {
        const currentMetadata = venueMetadataRecord(venue.metadata);
        updates.metadata = {
            ...currentMetadata,
            galleryImageUrls: parsed.data.galleryImageUrls.slice(0, 5),
        };
    }
    // AI Call Agent Qualification fields
    if (parsed.data.aiCallAgentQualificationStatus !== undefined) updates.aiCallAgentQualificationStatus = parsed.data.aiCallAgentQualificationStatus;
    if (parsed.data.aiCallAgentQualifiedFor !== undefined) updates.aiCallAgentQualifiedFor = parsed.data.aiCallAgentQualifiedFor;
    if (parsed.data.aiCallAgentReservationMode !== undefined) updates.aiCallAgentReservationMode = parsed.data.aiCallAgentReservationMode;
    if (parsed.data.aiCallAgentEscalationContactName !== undefined) updates.aiCallAgentEscalationContactName = parsed.data.aiCallAgentEscalationContactName || null;
    if (parsed.data.aiCallAgentEscalationContactPhone !== undefined) updates.aiCallAgentEscalationContactPhone = parsed.data.aiCallAgentEscalationContactPhone || null;
    if (parsed.data.aiCallAgentEscalationContactEmail !== undefined) updates.aiCallAgentEscalationContactEmail = parsed.data.aiCallAgentEscalationContactEmail || null;
    if (parsed.data.aiCallAgentLanguages !== undefined) updates.aiCallAgentLanguages = parsed.data.aiCallAgentLanguages;
    if (parsed.data.aiCallAgentGoLiveReadiness !== undefined) updates.aiCallAgentGoLiveReadiness = parsed.data.aiCallAgentGoLiveReadiness;
    if (parsed.data.aiCallAgentNotes !== undefined) updates.aiCallAgentNotes = parsed.data.aiCallAgentNotes || null;
    if (parsed.data.aiCallAgentQuestionnaireLink !== undefined) updates.aiCallAgentQuestionnaireLink = parsed.data.aiCallAgentQuestionnaireLink || null;
    // Auto-stamp qualified_at when status changes to QUALIFIED
    if (parsed.data.aiCallAgentQualificationStatus === 'QUALIFIED' && venue.aiCallAgentQualificationStatus !== 'QUALIFIED') {
        updates.aiCallAgentQualifiedAt = new Date();
        updates.aiCallAgentQualifiedByUserId = user.id;
    }
    if (googleFields && parsed.data.amenities === undefined) {
        const googleAmenities = await getAllowedGoogleAmenities(googleSnapshot);
        if (googleAmenities.length > 0) {
            updates.amenities = await mergeAmenitySets(venue.amenities || [], googleAmenities);
        }
    }

    await db.transaction(async (tx) => {
        await tx.update(venues).set(updates).where(eq(venues.id, venue.id));
        if (googleFields && venue.menuSource !== 'MANUAL' && googleSnapshot?.menu?.categories?.length) {
            await applyGoogleMenuSnapshot(tx, venue.id, googleSnapshot);
        }
    });
    await cleanupRemovedVenueMedia({
        previousCoverKey: venue.coverImageS3Key,
        previousGalleryKeys: venue.galleryS3Keys,
        nextCoverKey: parsed.data.coverImageS3Key !== undefined ? parsed.data.coverImageS3Key : venue.coverImageS3Key,
        nextGalleryKeys: parsed.data.galleryS3Keys !== undefined ? parsed.data.galleryS3Keys.slice(0, 5) : venue.galleryS3Keys,
    });

    await db.insert(auditLogs).values({
        userId: user.id,
        action: 'VENUE_UPDATED',
        entityType: 'Venue',
        entityId: venue.id,
    });

    return c.json(apiResponse({ message: 'Venue updated' }));
}

dashboardRoutes.put('/settings', updateVenueHandler);
dashboardRoutes.put('/venue', updateVenueHandler);
dashboardRoutes.patch('/venue', updateVenueHandler);

const setVenuePromotionSchema = z.object({
    venueEventId: z.string().uuid().nullable(),
});

const deleteOwnedVenueSchema = z.object({
    email: z.string().email(),
});

const createVenueClaimSchema = z.object({
    venueId: z.string().uuid(),
    notes: z.string().max(2000).optional(),
    verificationDocuments: z.array(z.string().url()).max(10).default([]),
});

const revertVenueGoogleSchema = z.object({
    includeMenu: z.boolean().default(false),
});

const venueGoogleImageActionSchema = z.object({
    action: z.enum(['cover', 'gallery', 'revert']),
    photoName: z.string().min(3).max(500).optional(),
}).superRefine((value, ctx) => {
    if ((value.action === 'cover' || value.action === 'gallery') && !value.photoName?.trim()) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['photoName'],
            message: 'photoName is required for this action',
        });
    }
});

dashboardRoutes.put('/venue/promotion', async (c) => {
    const context = await getVenueOr404(c);
    if ('error' in context) return context.error;
    const { user, venue } = context;

    const body = await c.req.json().catch(() => ({}));
    const parsed = setVenuePromotionSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const venueEventId = parsed.data.venueEventId;
    if (venueEventId) {
        const [event] = await db.select({ id: venueEvents.id }).from(venueEvents)
            .where(and(
                eq(venueEvents.id, venueEventId),
                eq(venueEvents.venueId, venue.id),
                eq(venueEvents.isActive, true),
            ))
            .limit(1);

        if (!event) {
            return c.json(apiError('NOT_FOUND', 'Event not found'), 404);
        }
    }

    const currentMetadata = venueMetadataRecord(venue.metadata);
    const metadata = {
        ...currentMetadata,
        promotedVenueEventId: venueEventId,
    };

    await db.update(venues).set({
        metadata,
        updatedAt: new Date(),
    }).where(eq(venues.id, venue.id));

    await db.insert(auditLogs).values({
        userId: user.id,
        action: 'VENUE_PROMOTION_UPDATED',
        entityType: 'Venue',
        entityId: venue.id,
        metadata: { promotedVenueEventId: venueEventId },
    });

    return c.json(apiResponse({ promotedVenueEventId: venueEventId }));
});

dashboardRoutes.post('/venue/delete', async (c) => {
    const context = await getVenueOr404(c);
    if ('error' in context) return context.error;
    const { user, venue } = context;

    const body = await c.req.json().catch(() => ({}));
    const parsed = deleteOwnedVenueSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const normalizedEmail = parsed.data.email.trim().toLowerCase();
    if (normalizedEmail !== user.email.trim().toLowerCase()) {
        return c.json(apiError('VALIDATION_ERROR', 'Confirmation email does not match your account email'), 400);
    }

    const updatedMetadata = {
        ...venueMetadataRecord(venue.metadata),
        promotedVenueEventId: null,
    };

    await db.transaction(async (tx) => {
        await tx.update(venueEvents).set({
            isActive: false,
            updatedAt: new Date(),
        }).where(eq(venueEvents.venueId, venue.id));

        await tx.update(venueCustomEvents).set({
            isActive: false,
            updatedAt: new Date(),
        }).where(eq(venueCustomEvents.venueId, venue.id));

        await tx.update(menuCategories).set({
            isActive: false,
        }).where(eq(menuCategories.venueId, venue.id));

        await tx.update(venues).set({
            isActive: false,
            deletedAt: new Date(),
            updatedAt: new Date(),
            metadata: updatedMetadata,
        }).where(eq(venues.id, venue.id));

        await tx.insert(auditLogs).values({
            userId: user.id,
            action: 'VENUE_DELETED',
            entityType: 'Venue',
            entityId: venue.id,
            metadata: { ownerEmail: normalizedEmail },
        });
    });

    const remainingVenues = await getOwnedVenues(user.id);
    if (remainingVenues.length === 0 && (user.role === 'BUSINESS' || user.role === 'VENUE_OWNER')) {
        await db.update(users).set({
            role: 'USER',
            updatedAt: new Date(),
        }).where(eq(users.id, user.id));
    }

    return c.json(apiResponse({
        message: 'Venue deleted successfully',
        remainingVenues: remainingVenues.length,
        demotedToUser: remainingVenues.length === 0,
    }));
});

dashboardRoutes.get('/claims', async (c) => {
    const user = c.get('user');
    const rows = await db.select({
        id: venueClaims.id,
        venueId: venueClaims.venueId,
        venueName: venues.name,
        venueSlug: venues.slug,
        status: venueClaims.status,
        notes: venueClaims.notes,
        adminNotes: venueClaims.adminNotes,
        verificationDocuments: venueClaims.verificationDocuments,
        reviewedAt: venueClaims.reviewedAt,
        createdAt: venueClaims.createdAt,
    })
        .from(venueClaims)
        .innerJoin(venues, eq(venueClaims.venueId, venues.id))
        .where(eq(venueClaims.claimantUserId, user.id))
        .orderBy(desc(venueClaims.createdAt));

    return c.json(apiResponse(rows));
});

dashboardRoutes.post('/claims', async (c) => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => ({}));
    const parsed = createVenueClaimSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const [venue] = await db.select({
        id: venues.id,
        name: venues.name,
        slug: venues.slug,
        ownerId: venues.ownerId,
    }).from(venues).where(eq(venues.id, parsed.data.venueId)).limit(1);

    if (!venue) {
        return c.json(apiError('NOT_FOUND', 'Venue not found'), 404);
    }

    const [existingClaim] = await db.select({ id: venueClaims.id }).from(venueClaims)
        .where(and(
            eq(venueClaims.venueId, parsed.data.venueId),
            eq(venueClaims.claimantUserId, user.id),
            eq(venueClaims.status, 'PENDING'),
        ))
        .limit(1);

    if (existingClaim) {
        return c.json(apiError('CONFLICT', 'You already have a pending claim for this venue'), 409);
    }

    const [claim] = await db.insert(venueClaims).values({
        venueId: parsed.data.venueId,
        claimantUserId: user.id,
        notes: parsed.data.notes || null,
        verificationDocuments: parsed.data.verificationDocuments,
        status: 'PENDING',
    }).returning({
        id: venueClaims.id,
        status: venueClaims.status,
        createdAt: venueClaims.createdAt,
    });

    await db.insert(auditLogs).values({
        userId: user.id,
        action: 'VENUE_CLAIM_SUBMITTED',
        entityType: 'VenueClaim',
        entityId: claim.id,
        metadata: { venueId: venue.id },
    });

    if (venue.ownerId && venue.ownerId !== user.id) {
        await db.insert(notifications).values({
            userId: venue.ownerId,
            type: 'SYSTEM',
            title: `Ownership claim submitted for ${venue.name}`,
            body: `${user.name} (${user.email}) submitted a claim for ${venue.name}. Please provide documents or ownership proof to MatchWatch admin before the claim is reviewed.`,
            actionUrl: '/admin',
            data: {
                venueId: venue.id,
                claimId: claim.id,
                claimantUserId: user.id,
            },
        });
    }

    return c.json(apiResponse({
        ...claim,
        venue,
    }), 201);
});

async function refreshVenueGoogleHandler(c: any) {
    const context = await getVenueOr404(c);
    if ('error' in context) return context.error;
    const { user, venue } = context;

    if (!venue.googlePlaceId) {
        return c.json(apiError('VALIDATION_ERROR', 'This venue is not linked to a Google Place'), 400);
    }

    const { snapshot, defaults } = await refreshVenueFromGoogle(venue);

    await db.insert(auditLogs).values({
        userId: user.id,
        action: 'VENUE_GOOGLE_REFRESHED',
        entityType: 'Venue',
        entityId: venue.id,
    });

    return c.json(apiResponse({
        message: 'Google venue data refreshed',
        snapshot,
        defaults,
    }));
}

dashboardRoutes.post('/venue/google/refresh', refreshVenueGoogleHandler);

dashboardRoutes.post('/venue/google/revert', async (c) => {
    const context = await getVenueOr404(c);
    if ('error' in context) return context.error;
    const { user, venue } = context;

    const body = await c.req.json().catch(() => ({}));
    const parsed = revertVenueGoogleSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const snapshot = googleSnapshotFromVenue(venue);
    if (!snapshot) {
        return c.json(apiError('NOT_FOUND', 'No Google defaults stored for this venue'), 404);
    }

    const normalizedSnapshot = await enrichGoogleMenuSnapshot(normalizeGoogleSourceSnapshot(snapshot));
    const googleFields = buildGoogleVenueFields(normalizedSnapshot);
    const googleAmenities = await getAllowedGoogleAmenities(normalizedSnapshot);
    const googleDescriptions = await buildGoogleSyncUpdates({
        ...venue,
        googleSourceSnapshot: normalizedSnapshot,
        descriptionSource: 'NONE',
        shortDescriptionSource: 'NONE',
        priceRangeSource: 'NONE',
        menuSource: parsed.data.includeMenu ? 'NONE' : venue.menuSource,
    }, normalizedSnapshot);
    const revertUpdates: Record<string, unknown> = {
        name: normalizedSnapshot.displayName,
        addressLine1: googleFields.addressLine1,
        city: googleFields.city,
        stateProvince: googleFields.stateProvince,
        country: googleFields.country,
        postalCode: googleFields.postalCode,
        lat: googleFields.lat,
        lng: googleFields.lng,
        timezone: googleFields.timezone,
        phone: googleFields.phone,
        website: googleFields.website,
        googleMapsUrl: googleFields.googleMapsUrl,
        ratingOverride: googleFields.ratingOverride,
        reviewCountOverride: googleFields.reviewCountOverride,
        amenities: await sanitizeAmenities(googleAmenities),
        googleSourceSnapshot: normalizedSnapshot,
        description: googleDescriptions.updates.description ?? null,
        shortDescription: googleDescriptions.updates.shortDescription ?? null,
        descriptionSource: googleDescriptions.updates.description ? 'GOOGLE' : 'NONE',
        shortDescriptionSource: googleDescriptions.updates.shortDescription ? 'GOOGLE' : 'NONE',
        priceRange: googleDescriptions.updates.priceRange ?? null,
        priceRangeSource: googleDescriptions.updates.priceRange ? 'GOOGLE' : 'NONE',
        updatedAt: new Date(),
    };

    if (parsed.data.includeMenu) {
        revertUpdates.menuSource = normalizedSnapshot.menu?.categories?.length ? 'GOOGLE' : 'NONE';
    }

    await db.transaction(async (tx) => {
        await tx.update(venues).set(revertUpdates).where(eq(venues.id, venue.id));
        if (parsed.data.includeMenu) {
            await applyGoogleMenuSnapshot(tx, venue.id, normalizedSnapshot);
        }
    });

    await db.insert(auditLogs).values({
        userId: user.id,
        action: 'VENUE_GOOGLE_REVERTED',
        entityType: 'Venue',
        entityId: venue.id,
        metadata: { includeMenu: parsed.data.includeMenu },
    });

    return c.json(apiResponse({
        message: 'Venue reverted to Google defaults',
        snapshot: normalizedSnapshot,
        defaults: buildVenueGoogleDefaults(normalizedSnapshot, { slugOrId: venue.slug || venue.id }),
    }));
});

// ─── Events CRUD ────────────────────────────────


dashboardRoutes.post('/venue/google/images', async (c) => {
    const context = await getVenueOr404(c);
    if ('error' in context) return context.error;
    const { user, venue } = context;

    const body = await c.req.json().catch(() => ({}));
    const parsed = venueGoogleImageActionSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const snapshot = googleSnapshotFromVenue(venue);
    if (!snapshot) {
        return c.json(apiError('NOT_FOUND', 'No Google defaults stored for this venue'), 404);
    }

    const normalizedSnapshot = normalizeGoogleSourceSnapshot(snapshot);
    let nextSnapshot: GoogleSourceSnapshot;
    switch (parsed.data.action) {
        case 'cover':
            nextSnapshot = setGoogleCoverPhoto(normalizedSnapshot, parsed.data.photoName!.trim());
            break;
        case 'gallery':
            nextSnapshot = appendGoogleGalleryPhoto(normalizedSnapshot, parsed.data.photoName!.trim());
            break;
        case 'revert':
            nextSnapshot = resetGoogleImageSelection(normalizedSnapshot);
            break;
    }

    await db.update(venues).set({
        googleSourceSnapshot: nextSnapshot,
        updatedAt: new Date(),
    }).where(eq(venues.id, venue.id));

    await db.insert(auditLogs).values({
        userId: user.id,
        action: `VENUE_GOOGLE_IMAGE_${parsed.data.action.toUpperCase()}`,
        entityType: 'Venue',
        entityId: venue.id,
        metadata: {
            photoName: parsed.data.photoName?.trim() || null,
        },
    });

    return c.json(apiResponse({
        message: parsed.data.action === 'revert'
            ? 'Google image defaults restored'
            : parsed.data.action === 'cover'
                ? 'Google image selected as cover'
                : 'Google image added to gallery',
        defaults: buildVenueGoogleDefaults(nextSnapshot, { slugOrId: venue.slug || venue.id }),
    }));
});

dashboardRoutes.post('/events', async (c) => {
    const user = c.get('user');
    const venue = await getOwnedVenue(user.id, getRequestedVenueId(c));
    if (!venue) return c.json(apiError('NOT_FOUND', 'No venue found'), 404);
    const access = await ensureVenueOperationalAccess(user.id, venue.id);
    if ('error' in access && access.error) return c.json(access.error, access.error.error.code === 'FORBIDDEN' ? 403 : 404);

    const body = await c.req.json();
    const parsed = createEventSchema.safeParse(body);
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);

    // Check match exists
    const [match] = await db.select().from(matches).where(eq(matches.id, parsed.data.matchId)).limit(1);
    if (!match) return c.json(apiError('NOT_FOUND', 'Match not found'), 404);

    // Check no duplicate
    const [existing] = await db.select().from(venueEvents)
        .where(and(eq(venueEvents.venueId, venue.id), eq(venueEvents.matchId, parsed.data.matchId)))
        .limit(1);
    if (existing) return c.json(apiError('CONFLICT', 'Event already exists for this match'), 409);

    const [event] = await db.insert(venueEvents).values({
        venueId: venue.id,
        matchId: parsed.data.matchId,
        bookingLimit: parsed.data.bookingLimit,
        specialNotes: parsed.data.specialNotes,
        customPrice: parsed.data.customPrice ? String(parsed.data.customPrice) : null,
        currency: parsed.data.currency,
        doorsOpenAt: parsed.data.doorsOpenAt ? new Date(parsed.data.doorsOpenAt) : null,
        requiresApproval: parsed.data.requiresApproval,
    }).returning();

    await db.insert(auditLogs).values({ userId: user.id, action: 'EVENT_CREATED', entityType: 'VenueEvent', entityId: event.id });

    return c.json(apiResponse(event), 201);
});

dashboardRoutes.get('/events', async (c) => {
    const user = c.get('user');
    const venue = await getOwnedVenue(user.id, getRequestedVenueId(c));
    if (!venue) return c.json(apiError('NOT_FOUND', 'No venue found'), 404);

    const rows = await db.select({
        event: venueEvents,
        match: matches,
    })
        .from(venueEvents)
        .innerJoin(matches, eq(venueEvents.matchId, matches.id))
        .where(eq(venueEvents.venueId, venue.id))
        .orderBy(desc(matches.matchDateUtc));

    return c.json(apiResponse(rows.map(r => ({
        ...r.event,
        match: r.match,
        spotsRemaining: r.event.bookingLimit ? r.event.bookingLimit - r.event.confirmedBookingsCount : null,
    }))));
});

dashboardRoutes.get('/custom-events', async (c) => {
    const context = await getVenueOr404(c);
    if ('error' in context) return context.error;
    const { venue } = context;

    await deactivateExpiredCustomEvents(venue.id);

    const rows = await db.select().from(venueCustomEvents)
        .where(and(eq(venueCustomEvents.venueId, venue.id), eq(venueCustomEvents.isActive, true)))
        .orderBy(asc(venueCustomEvents.startsAt));

    return c.json(apiResponse(rows));
});

dashboardRoutes.post('/custom-events', async (c) => {
    const context = await getVenueOr404(c);
    if ('error' in context) return context.error;
    const { user, venue } = context;
    const access = await ensureVenueOperationalAccess(user.id, venue.id);
    if ('error' in access && access.error) return c.json(access.error, access.error.error.code === 'FORBIDDEN' ? 403 : 404);

    const body = await c.req.json();
    const parsed = createCustomVenueEventSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const startsAt = new Date(parsed.data.startsAt);
    const endsAt = new Date(parsed.data.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid startsAt/endsAt date'), 400);
    }
    if (endsAt <= startsAt) {
        return c.json(apiError('VALIDATION_ERROR', 'endsAt must be after startsAt'), 400);
    }

    const [created] = await db.insert(venueCustomEvents).values({
        venueId: venue.id,
        title: parsed.data.title,
        description: parsed.data.description,
        eventTypeTags: parsed.data.eventTypeTags,
        startsAt,
        endsAt,
        imageUrl: parsed.data.imageUrl,
        imageS3Key: parsed.data.imageS3Key,
        bookingNotes: parsed.data.bookingNotes,
    }).returning();

    await db.insert(auditLogs).values({
        userId: user.id,
        action: 'EVENT_CREATED',
        entityType: 'VenueCustomEvent',
        entityId: created.id,
    });

    return c.json(apiResponse(created), 201);
});

async function updateCustomEventHandler(c: any) {
    const context = await getVenueOr404(c);
    if ('error' in context) return context.error;
    const { user, venue } = context;
    const access = await ensureVenueOperationalAccess(user.id, venue.id);
    if ('error' in access && access.error) return c.json(access.error, access.error.error.code === 'FORBIDDEN' ? 403 : 404);

    const customEventId = c.req.param('customEventId');
    const body = await c.req.json();
    const parsed = updateCustomVenueEventSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const [existing] = await db.select().from(venueCustomEvents)
        .where(and(eq(venueCustomEvents.id, customEventId), eq(venueCustomEvents.venueId, venue.id)))
        .limit(1);
    if (!existing) return c.json(apiError('NOT_FOUND', 'Custom event not found'), 404);

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.title !== undefined) updates.title = parsed.data.title;
    if (parsed.data.description !== undefined) updates.description = parsed.data.description;
    if (parsed.data.eventTypeTags !== undefined) updates.eventTypeTags = parsed.data.eventTypeTags;
    if (parsed.data.imageUrl !== undefined) updates.imageUrl = parsed.data.imageUrl;
    if (parsed.data.imageS3Key !== undefined) updates.imageS3Key = parsed.data.imageS3Key;
    if (parsed.data.bookingNotes !== undefined) updates.bookingNotes = parsed.data.bookingNotes;
    if (parsed.data.startsAt !== undefined) {
        const startsAt = new Date(parsed.data.startsAt);
        if (Number.isNaN(startsAt.getTime())) return c.json(apiError('VALIDATION_ERROR', 'Invalid startsAt date'), 400);
        updates.startsAt = startsAt;
    }
    if (parsed.data.endsAt !== undefined) {
        const endsAt = new Date(parsed.data.endsAt);
        if (Number.isNaN(endsAt.getTime())) return c.json(apiError('VALIDATION_ERROR', 'Invalid endsAt date'), 400);
        updates.endsAt = endsAt;
    }

    const finalStarts = (updates.startsAt as Date | undefined) || existing.startsAt;
    const finalEnds = (updates.endsAt as Date | undefined) || existing.endsAt;
    if (finalEnds <= finalStarts) {
        return c.json(apiError('VALIDATION_ERROR', 'endsAt must be after startsAt'), 400);
    }

    await db.update(venueCustomEvents).set(updates).where(eq(venueCustomEvents.id, customEventId));
    return c.json(apiResponse({ message: 'Custom event updated' }));
}

dashboardRoutes.put('/custom-events/:customEventId', updateCustomEventHandler);
dashboardRoutes.patch('/custom-events/:customEventId', updateCustomEventHandler);

dashboardRoutes.delete('/custom-events/:customEventId', async (c) => {
    const context = await getVenueOr404(c);
    if ('error' in context) return context.error;
    const { user, venue } = context;
    const access = await ensureVenueOperationalAccess(user.id, venue.id);
    if ('error' in access && access.error) return c.json(access.error, access.error.error.code === 'FORBIDDEN' ? 403 : 404);

    const customEventId = c.req.param('customEventId');
    const [existing] = await db.select({ id: venueCustomEvents.id }).from(venueCustomEvents)
        .where(and(eq(venueCustomEvents.id, customEventId), eq(venueCustomEvents.venueId, venue.id)))
        .limit(1);
    if (!existing) return c.json(apiError('NOT_FOUND', 'Custom event not found'), 404);

    await db.update(venueCustomEvents).set({
        isActive: false,
        updatedAt: new Date(),
    }).where(eq(venueCustomEvents.id, customEventId));

    return c.json(apiResponse({ message: 'Custom event removed' }));
});

async function updateEventHandler(c: any) {
    const user = c.get('user');
    const venue = await getOwnedVenue(user.id, getRequestedVenueId(c));
    if (!venue) return c.json(apiError('NOT_FOUND', 'No venue found'), 404);
    const access = await ensureVenueOperationalAccess(user.id, venue.id);
    if ('error' in access && access.error) return c.json(access.error, access.error.error.code === 'FORBIDDEN' ? 403 : 404);

    const eventId = c.req.param('eventId');
    const body = await c.req.json();
    const parsed = updateEventSchema.safeParse(body);
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);

    const [event] = await db.select().from(venueEvents)
        .where(and(eq(venueEvents.id, eventId), eq(venueEvents.venueId, venue.id)))
        .limit(1);
    if (!event) return c.json(apiError('NOT_FOUND', 'Event not found'), 404);

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (parsed.data.bookingLimit !== undefined) updateData.bookingLimit = parsed.data.bookingLimit;
    if (parsed.data.specialNotes !== undefined) updateData.specialNotes = parsed.data.specialNotes;
    if (parsed.data.customPrice !== undefined) updateData.customPrice = String(parsed.data.customPrice);
    if (parsed.data.requiresApproval !== undefined) updateData.requiresApproval = parsed.data.requiresApproval;

    await db.update(venueEvents).set(updateData).where(eq(venueEvents.id, eventId));
    return c.json(apiResponse({ message: 'Event updated' }));
}

dashboardRoutes.put('/events/:eventId', updateEventHandler);
dashboardRoutes.patch('/events/:eventId', updateEventHandler);

dashboardRoutes.put('/events/:eventId/booking-limit', async (c) => {
    const user = c.get('user');
    const venue = await getOwnedVenue(user.id, getRequestedVenueId(c));
    if (!venue) return c.json(apiError('NOT_FOUND', 'No venue found'), 404);
    const access = await ensureVenueOperationalAccess(user.id, venue.id);
    if ('error' in access && access.error) return c.json(access.error, access.error.error.code === 'FORBIDDEN' ? 403 : 404);

    const eventId = c.req.param('eventId');
    const [event] = await db.select().from(venueEvents)
        .where(and(eq(venueEvents.id, eventId), eq(venueEvents.venueId, venue.id)))
        .limit(1);
    if (!event) return c.json(apiError('NOT_FOUND', 'Event not found'), 404);

    const body = await c.req.json().catch(() => ({}));
    const bookingLimit = body.bookingLimit;

    if (bookingLimit !== null && (typeof bookingLimit !== 'number' || !Number.isInteger(bookingLimit) || bookingLimit <= 0)) {
        return c.json(apiError('VALIDATION_ERROR', 'bookingLimit must be a positive integer or null'), 400);
    }

    await db.update(venueEvents).set({
        bookingLimit: bookingLimit ?? null,
        updatedAt: new Date(),
    }).where(eq(venueEvents.id, eventId));

    return c.json(apiResponse({ message: 'Booking limit updated' }));
});

dashboardRoutes.delete('/events/:eventId', async (c) => {
    const user = c.get('user');
    const venue = await getOwnedVenue(user.id, getRequestedVenueId(c));
    if (!venue) return c.json(apiError('NOT_FOUND', 'No venue found'), 404);
    const access = await ensureVenueOperationalAccess(user.id, venue.id);
    if ('error' in access && access.error) return c.json(access.error, access.error.error.code === 'FORBIDDEN' ? 403 : 404);

    const eventId = c.req.param('eventId');
    const [event] = await db.select().from(venueEvents)
        .where(and(eq(venueEvents.id, eventId), eq(venueEvents.venueId, venue.id)))
        .limit(1);
    if (!event) return c.json(apiError('NOT_FOUND', 'Event not found'), 404);

    await db.update(venueEvents).set({ isActive: false, updatedAt: new Date() }).where(eq(venueEvents.id, eventId));
    await db.insert(auditLogs).values({ userId: user.id, action: 'EVENT_DELETED', entityType: 'VenueEvent', entityId: eventId });
    return c.json(apiResponse({ message: 'Event deactivated' }));
});

// ─── Bookings Management ────────────────────────

dashboardRoutes.get('/bookings', async (c) => {
    const user = c.get('user');
    const venue = await getOwnedVenue(user.id, getRequestedVenueId(c));
    if (!venue) return c.json(apiError('NOT_FOUND', 'No venue found'), 404);

    const query = paginationSchema.safeParse(c.req.query());
    if (!query.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid query', query.error.issues), 400);
    }

    const { page, limit } = query.data;
    const offset = paginationOffset(page, limit);

    const rows = await db.select({
        booking: bookings,
        event: venueEvents,
        match: matches,
        userName: users.name,
        userEmail: users.email,
    })
        .from(bookings)
        .innerJoin(venueEvents, eq(bookings.venueEventId, venueEvents.id))
        .innerJoin(matches, eq(venueEvents.matchId, matches.id))
        .innerJoin(users, eq(bookings.userId, users.id))
        .where(eq(venueEvents.venueId, venue.id))
        .orderBy(desc(bookings.createdAt))
        .limit(limit)
        .offset(offset);

    return c.json(apiResponse(rows.map(r => ({
        ...r.booking,
        match: { homeTeamName: r.match.homeTeamName, awayTeamName: r.match.awayTeamName, matchDateUtc: r.match.matchDateUtc },
        user: { name: r.userName, email: r.userEmail },
    }))));
});

dashboardRoutes.get('/bookings/events', async (c) => {
    const context = await getVenueOr404(c);
    if ('error' in context) return context.error;
    const { venue } = context;

    const [eventRows, bookingRows] = await Promise.all([
        db.select({
            event: venueEvents,
            match: matches,
        })
            .from(venueEvents)
            .innerJoin(matches, eq(venueEvents.matchId, matches.id))
            .where(and(eq(venueEvents.venueId, venue.id), eq(venueEvents.isActive, true)))
            .orderBy(asc(matches.matchDateUtc)),
        db.select({
            booking: bookings,
            eventId: venueEvents.id,
            userName: users.name,
            userEmail: users.email,
        })
            .from(bookings)
            .innerJoin(venueEvents, eq(bookings.venueEventId, venueEvents.id))
            .innerJoin(users, eq(bookings.userId, users.id))
            .where(eq(venueEvents.venueId, venue.id))
            .orderBy(desc(bookings.createdAt)),
    ]);

    const groupedBookings = new Map<string, Array<{
        id: string;
        bookingReference: string;
        partySize: number;
        status: string;
        createdAt: Date;
        specialRequests: string | null;
        user: { name: string; email: string };
    }>>();

    for (const row of bookingRows) {
        const list = groupedBookings.get(row.eventId) || [];
        list.push({
            id: row.booking.id,
            bookingReference: row.booking.bookingReference,
            partySize: row.booking.partySize,
            status: row.booking.status,
            createdAt: row.booking.createdAt,
            specialRequests: row.booking.specialRequests,
            user: { name: row.userName, email: row.userEmail },
        });
        groupedBookings.set(row.eventId, list);
    }

    const payload = eventRows.map((row) => {
        const spotsRemaining = row.event.bookingLimit
            ? Math.max(row.event.bookingLimit - row.event.confirmedBookingsCount, 0)
            : null;
        const occupancyPercent = row.event.bookingLimit
            ? Math.min(Math.round((row.event.confirmedBookingsCount / row.event.bookingLimit) * 100), 100)
            : null;
        return {
            id: row.event.id,
            bookingLimit: row.event.bookingLimit,
            confirmedBookingsCount: row.event.confirmedBookingsCount,
            spotsRemaining,
            occupancyPercent,
            specialNotes: row.event.specialNotes,
            match: row.match,
            bookings: groupedBookings.get(row.event.id) || [],
        };
    });

    return c.json(apiResponse(payload));
});

async function updateBookingStatusHandler(c: any) {
    const user = c.get('user');
    const venue = await getOwnedVenue(user.id, getRequestedVenueId(c));
    if (!venue) return c.json(apiError('NOT_FOUND', 'No venue found'), 404);

    const bookingId = c.req.param('bookingId');
    const body = await c.req.json();
    const parsed = updateBookingStatusSchema.safeParse(body);
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);

    const [row] = await db.select({
        booking: bookings,
        event: venueEvents,
    }).from(bookings)
        .innerJoin(venueEvents, eq(bookings.venueEventId, venueEvents.id))
        .where(and(eq(bookings.id, bookingId), eq(venueEvents.venueId, venue.id)))
        .limit(1);

    if (!row) return c.json(apiError('NOT_FOUND', 'Booking not found'), 404);

    const updates: Record<string, any> = { status: parsed.data.status, updatedAt: new Date() };
    if (parsed.data.status === 'CANCELLED_BY_VENUE') {
        updates.cancelledAt = new Date();
        updates.cancelledBy = user.id;
        updates.cancellationReason = parsed.data.cancellationReason;
    }

    await db.update(bookings).set(updates).where(eq(bookings.id, bookingId));

    // Update count
    if (parsed.data.status === 'CONFIRMED' && row.booking.status === 'PENDING') {
        await db.update(venueEvents).set({
            confirmedBookingsCount: sql`${venueEvents.confirmedBookingsCount} + ${row.booking.partySize}`,
        }).where(eq(venueEvents.id, row.event.id));
    } else if (parsed.data.status === 'CANCELLED_BY_VENUE' && row.booking.status === 'CONFIRMED') {
        await db.update(venueEvents).set({
            confirmedBookingsCount: sql`GREATEST(${venueEvents.confirmedBookingsCount} - ${row.booking.partySize}, 0)`,
        }).where(eq(venueEvents.id, row.event.id));
    }

    // Notify user
    await db.insert(notifications).values({
        userId: row.booking.userId,
        type: parsed.data.status === 'CANCELLED_BY_VENUE' ? 'BOOKING_CANCELLED' : 'BOOKING_CONFIRMED',
        title: `Booking ${parsed.data.status === 'CONFIRMED' ? 'Confirmed' : 'Updated'}`,
        body: `Your booking ${row.booking.bookingReference} has been ${parsed.data.status.toLowerCase().replace('_', ' ')}.`,
        actionUrl: '/dashboard/bookings',
    });

    return c.json(apiResponse({ message: 'Booking status updated' }));
}

dashboardRoutes.put('/bookings/:bookingId/status', updateBookingStatusHandler);
dashboardRoutes.put('/bookings/:bookingId', updateBookingStatusHandler);
dashboardRoutes.patch('/bookings/:bookingId', updateBookingStatusHandler);

// ─── Posts CRUD ──────────────────────────────────

dashboardRoutes.post('/posts', async (c) => {
    const user = c.get('user');
    const venue = await getOwnedVenue(user.id, getRequestedVenueId(c));
    if (!venue) return c.json(apiError('NOT_FOUND', 'No venue found'), 404);
    const access = await ensureVenueOperationalAccess(user.id, venue.id);
    if ('error' in access && access.error) return c.json(access.error, access.error.error.code === 'FORBIDDEN' ? 403 : 404);

    const body = await c.req.json();
    const parsed = createPostSchema.safeParse(body);
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);

    const [post] = await db.insert(posts).values({
        venueId: venue.id,
        authorId: user.id,
        content: parsed.data.content,
        matchId: parsed.data.matchId,
        scheduledPublishAt: parsed.data.scheduledPublishAt ? new Date(parsed.data.scheduledPublishAt) : null,
        isPublished: !parsed.data.scheduledPublishAt,
    }).returning();

    await db.insert(auditLogs).values({ userId: user.id, action: 'POST_CREATED', entityType: 'Post', entityId: post.id });

    return c.json(apiResponse(post), 201);
});

dashboardRoutes.get('/posts', async (c) => {
    const user = c.get('user');
    const venue = await getOwnedVenue(user.id, getRequestedVenueId(c));
    if (!venue) return c.json(apiError('NOT_FOUND', 'No venue found'), 404);

    const rows = await db.select().from(posts)
        .where(and(eq(posts.venueId, venue.id), sql`${posts.deletedAt} IS NULL`))
        .orderBy(desc(posts.createdAt));

    return c.json(apiResponse(rows));
});

dashboardRoutes.delete('/posts/:postId', async (c) => {
    const user = c.get('user');
    const venue = await getOwnedVenue(user.id, getRequestedVenueId(c));
    if (!venue) return c.json(apiError('NOT_FOUND', 'No venue found'), 404);

    const postId = c.req.param('postId');
    await db.update(posts).set({ deletedAt: new Date() })
        .where(and(eq(posts.id, postId), eq(posts.venueId, venue.id)));
    return c.json(apiResponse({ message: 'Post deleted' }));
});

// ─── Menu CRUD ──────────────────────────────────

dashboardRoutes.get('/menu', async (c) => {
    const user = c.get('user');
    const venue = await getOwnedVenue(user.id, getRequestedVenueId(c));
    if (!venue) return c.json(apiError('NOT_FOUND', 'No venue found'), 404);

    const categories = await db.select().from(menuCategories)
        .where(and(eq(menuCategories.venueId, venue.id), eq(menuCategories.isActive, true)))
        .orderBy(asc(menuCategories.sortOrder));

    const items = await db.select().from(menuItems)
        .where(eq(menuItems.venueId, venue.id))
        .orderBy(asc(menuItems.sortOrder));

    const menu = categories.map((category) => ({
        ...category,
        items: items.filter((item) => item.categoryId === category.id),
    }));

    return c.json(apiResponse(menu));
});

dashboardRoutes.post('/menu/categories', async (c) => {
    const user = c.get('user');
    const venue = await getOwnedVenue(user.id, getRequestedVenueId(c));
    if (!venue) return c.json(apiError('NOT_FOUND', 'No venue found'), 404);

    const body = await c.req.json();
    const parsed = createMenuCategorySchema.safeParse(body);
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);

    const [category] = await db.insert(menuCategories).values({
        venueId: venue.id,
        name: parsed.data.name,
        description: parsed.data.description,
        sortOrder: parsed.data.sortOrder,
    }).returning();
    await db.update(venues).set({ menuSource: 'MANUAL', updatedAt: new Date() }).where(eq(venues.id, venue.id));

    return c.json(apiResponse(category), 201);
});

async function updateMenuCategoryHandler(c: any) {
    const user = c.get('user');
    const venue = await getOwnedVenue(user.id, getRequestedVenueId(c));
    if (!venue) return c.json(apiError('NOT_FOUND', 'No venue found'), 404);

    const categoryId = c.req.param('id');
    const body = await c.req.json();
    const parsed = createMenuCategorySchema.partial().safeParse(body);
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);

    const [existing] = await db.select().from(menuCategories)
        .where(and(eq(menuCategories.id, categoryId), eq(menuCategories.venueId, venue.id)))
        .limit(1);
    if (!existing) return c.json(apiError('NOT_FOUND', 'Category not found'), 404);

    await db.update(menuCategories).set({
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
        ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {}),
    }).where(eq(menuCategories.id, categoryId));
    await db.update(venues).set({ menuSource: 'MANUAL', updatedAt: new Date() }).where(eq(venues.id, venue.id));

    return c.json(apiResponse({ message: 'Category updated' }));
}

dashboardRoutes.put('/menu/categories/:id', updateMenuCategoryHandler);
dashboardRoutes.patch('/menu/categories/:id', updateMenuCategoryHandler);

dashboardRoutes.delete('/menu/categories/:id', async (c) => {
    const user = c.get('user');
    const venue = await getOwnedVenue(user.id, getRequestedVenueId(c));
    if (!venue) return c.json(apiError('NOT_FOUND', 'No venue found'), 404);

    const categoryId = c.req.param('id');
    const [existing] = await db.select().from(menuCategories)
        .where(and(eq(menuCategories.id, categoryId), eq(menuCategories.venueId, venue.id)))
        .limit(1);
    if (!existing) return c.json(apiError('NOT_FOUND', 'Category not found'), 404);

    await db.delete(menuItems).where(eq(menuItems.categoryId, categoryId));
    await db.delete(menuCategories).where(eq(menuCategories.id, categoryId));
    await db.update(venues).set({ menuSource: 'MANUAL', updatedAt: new Date() }).where(eq(venues.id, venue.id));

    return c.json(apiResponse({ message: 'Category deleted' }));
});

dashboardRoutes.post('/menu/items', async (c) => {
    const user = c.get('user');
    const venue = await getOwnedVenue(user.id, getRequestedVenueId(c));
    if (!venue) return c.json(apiError('NOT_FOUND', 'No venue found'), 404);

    const body = await c.req.json();
    const parsed = createMenuItemSchema.safeParse(body);
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);

    // Verify category belongs to venue
    const [cat] = await db.select().from(menuCategories)
        .where(and(eq(menuCategories.id, parsed.data.categoryId), eq(menuCategories.venueId, venue.id)))
        .limit(1);
    if (!cat) return c.json(apiError('NOT_FOUND', 'Category not found'), 404);

    const [item] = await db.insert(menuItems).values({
        ...parsed.data,
        venueId: venue.id,
        price: String(parsed.data.price),
    }).returning();
    await db.update(venues).set({ menuSource: 'MANUAL', updatedAt: new Date() }).where(eq(venues.id, venue.id));

    return c.json(apiResponse(item), 201);
});

async function updateMenuItemHandler(c: any) {
    const user = c.get('user');
    const venue = await getOwnedVenue(user.id, getRequestedVenueId(c));
    if (!venue) return c.json(apiError('NOT_FOUND', 'No venue found'), 404);

    const itemId = c.req.param('itemId') || c.req.param('id');
    if (!itemId) return c.json(apiError('VALIDATION_ERROR', 'Menu item id is required'), 400);
    const body = await c.req.json();
    const parsed = createMenuItemSchema.partial().safeParse(body);
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);

    const [existing] = await db.select().from(menuItems)
        .where(and(eq(menuItems.id, itemId), eq(menuItems.venueId, venue.id)))
        .limit(1);
    if (!existing) return c.json(apiError('NOT_FOUND', 'Menu item not found'), 404);

    if (parsed.data.categoryId) {
        const [category] = await db.select().from(menuCategories)
            .where(and(eq(menuCategories.id, parsed.data.categoryId), eq(menuCategories.venueId, venue.id)))
            .limit(1);
        if (!category) return c.json(apiError('NOT_FOUND', 'Category not found'), 404);
    }

    await db.update(menuItems).set({
        ...(parsed.data.categoryId !== undefined ? { categoryId: parsed.data.categoryId } : {}),
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
        ...(parsed.data.price !== undefined ? { price: String(parsed.data.price) } : {}),
        ...(parsed.data.currency !== undefined ? { currency: parsed.data.currency } : {}),
        ...(parsed.data.isAvailable !== undefined ? { isAvailable: parsed.data.isAvailable } : {}),
        ...(parsed.data.isFeatured !== undefined ? { isFeatured: parsed.data.isFeatured } : {}),
        ...(parsed.data.dietaryTags !== undefined ? { dietaryTags: parsed.data.dietaryTags } : {}),
        ...(parsed.data.allergens !== undefined ? { allergens: parsed.data.allergens } : {}),
        ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {}),
        updatedAt: new Date(),
    }).where(eq(menuItems.id, itemId));
    await db.update(venues).set({ menuSource: 'MANUAL', updatedAt: new Date() }).where(eq(venues.id, venue.id));

    return c.json(apiResponse({ message: 'Menu item updated' }));
}

dashboardRoutes.put('/menu/items/:itemId', updateMenuItemHandler);
dashboardRoutes.patch('/menu/items/:itemId', updateMenuItemHandler);
dashboardRoutes.put('/menu/items/:id', updateMenuItemHandler);
dashboardRoutes.patch('/menu/items/:id', updateMenuItemHandler);

dashboardRoutes.delete('/menu/items/:itemId', async (c) => {
    const user = c.get('user');
    const venue = await getOwnedVenue(user.id, getRequestedVenueId(c));
    if (!venue) return c.json(apiError('NOT_FOUND', 'No venue found'), 404);

    const itemId = c.req.param('itemId');
    await db.delete(menuItems)
        .where(and(eq(menuItems.id, itemId), eq(menuItems.venueId, venue.id)));
    await db.update(venues).set({ menuSource: 'MANUAL', updatedAt: new Date() }).where(eq(venues.id, venue.id));
    return c.json(apiResponse({ message: 'Menu item deleted' }));
});

dashboardRoutes.delete('/menu/items/:id', async (c) => {
    const user = c.get('user');
    const venue = await getOwnedVenue(user.id, getRequestedVenueId(c));
    if (!venue) return c.json(apiError('NOT_FOUND', 'No venue found'), 404);

    const itemId = c.req.param('id');
    await db.delete(menuItems)
        .where(and(eq(menuItems.id, itemId), eq(menuItems.venueId, venue.id)));
    await db.update(venues).set({ menuSource: 'MANUAL', updatedAt: new Date() }).where(eq(venues.id, venue.id));
    return c.json(apiResponse({ message: 'Menu item deleted' }));
});

// ─── Notify Followers ───────────────────────────

async function notifyFollowersHandler(c: any) {
    const user = c.get('user');
    const venue = await getOwnedVenue(user.id, getRequestedVenueId(c));
    if (!venue) return c.json(apiError('NOT_FOUND', 'No venue found'), 404);
    const access = await ensureVenueOperationalAccess(user.id, venue.id);
    if ('error' in access && access.error) return c.json(access.error, access.error.error.code === 'FORBIDDEN' ? 403 : 404);

    const body = await c.req.json();
    const parsed = notifyFollowersSchema.safeParse(body);
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);

    // Get all followers
    const followerRows = await db.select({ userId: follows.userId }).from(follows)
        .where(eq(follows.venueId, venue.id));

    if (followerRows.length === 0) {
        return c.json(apiResponse({ message: 'No followers to notify', count: 0 }));
    }

    // Batch insert notifications
    await db.insert(notifications).values(
        followerRows.map(f => ({
            userId: f.userId,
            type: 'VENUE_NOTIFICATION' as const,
            title: parsed.data.title,
            body: parsed.data.body,
            actionUrl: parsed.data.actionUrl || `/venues/${venue.slug}`,
            data: { venueId: venue.id, postId: parsed.data.postId },
        })),
    );

    await db.insert(auditLogs).values({
        userId: user.id,
        action: 'NOTIFICATION_SENT',
        entityType: 'Venue',
        entityId: venue.id,
        metadata: { followerCount: followerRows.length },
    });

    return c.json(apiResponse({ message: `Notified ${followerRows.length} followers`, count: followerRows.length }));
}

dashboardRoutes.post('/notify', notifyFollowersHandler);
dashboardRoutes.post('/notify-followers', notifyFollowersHandler);

// ─── Analytics ──────────────────────────────────
dashboardRoutes.get('/analytics', async (c) => {
    const user = c.get('user');
    const venue = await getOwnedVenue(user.id, getRequestedVenueId(c));
    if (!venue) return c.json(apiError('NOT_FOUND', 'No venue found'), 404);

    const bookingRows = await db.select({
        date: sql<string>`DATE(${bookings.createdAt})`,
        total: count(),
    })
        .from(bookings)
        .innerJoin(venueEvents, eq(bookings.venueEventId, venueEvents.id))
        .where(eq(venueEvents.venueId, venue.id))
        .groupBy(sql`DATE(${bookings.createdAt})`)
        .orderBy(sql`DATE(${bookings.createdAt}) DESC`)
        .limit(30);

    const topEvents = await db.select({
        eventId: venueEvents.id,
        matchId: venueEvents.matchId,
        totalBookings: count(),
    })
        .from(bookings)
        .innerJoin(venueEvents, eq(bookings.venueEventId, venueEvents.id))
        .where(eq(venueEvents.venueId, venue.id))
        .groupBy(venueEvents.id)
        .orderBy(sql`${count()} DESC`)
        .limit(10);

    return c.json(apiResponse({
        bookingsOverTime: bookingRows.map((row) => ({ date: row.date, total: Number(row.total) })),
        topEvents: topEvents.map((event) => ({
            eventId: event.eventId,
            matchId: event.matchId,
            totalBookings: Number(event.totalBookings),
        })),
    }));
});

export default dashboardRoutes;


