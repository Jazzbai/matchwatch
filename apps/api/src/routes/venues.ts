import { Hono } from 'hono';
import { db } from '../db/client';
import { venues, venueEvents, matches, posts, menuCategories, menuItems, follows, reviews, users, venueCustomEvents, teamFanVenues, teams, leagues } from '../db/schema';
import { eq, and, count, desc, asc, sql, ilike, inArray, gte } from 'drizzle-orm';
import { apiResponse, apiError, paginationMeta, paginationOffset, haversineDistance } from '../lib/utils';
import { venueQuerySchema, paginationSchema } from '@matchwatch/shared';
import { authMiddleware, optionalAuthMiddleware } from '../middleware';
import { buildGoogleVenueFields } from '../lib/venueOnboarding';
import { getGooglePhotoMediaUri, type GoogleSourceSnapshot } from '../lib/googlePlaces';
import { getPublicGoogleReviews, isGoogleSyncStale, refreshVenueFromGoogle } from '../lib/googleVenueSync';
import {
    buildVenueImageRenderPayload,
    normalizeGoogleSourceSnapshot,
    resolveSelectedGooglePhotos,
} from '../lib/venueImages';

const venueRoutes = new Hono();

function galleryImageUrlsFromMetadata(metadata: unknown): string[] {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return [];
    const raw = (metadata as Record<string, unknown>).galleryUrls ?? (metadata as Record<string, unknown>).galleryImageUrls;
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

function venueImagePayloadForRow(venue: typeof venues.$inferSelect) {
    return buildVenueImageRenderPayload({
        slugOrId: venue.slug || venue.id,
        coverImageUrl: venue.coverImageUrl,
        manualGalleryImageUrls: galleryImageUrlsFromMetadata(venue.metadata),
        snapshot: (venue.googleSourceSnapshot || null) as GoogleSourceSnapshot | null,
    });
}

function venueWorkingHoursForRow(venue: typeof venues.$inferSelect) {
    const normalizedSnapshot = normalizeGoogleSourceSnapshot((venue.googleSourceSnapshot || {}) as GoogleSourceSnapshot);
    return Array.isArray(normalizedSnapshot.workingHours) ? normalizedSnapshot.workingHours : [];
}

async function getPublicVenueBySlugOrId(slugOrId: string) {
    const [venue] = await db.select().from(venues).where(
        sql`${venues.slug} = ${slugOrId} OR ${venues.id}::text = ${slugOrId}`,
    ).limit(1);

    if (!venue || !venue.isActive || venue.approvalStatus !== 'APPROVED') {
        return null;
    }

    return venue;
}

async function refreshVenueGoogleSnapshot(venue: typeof venues.$inferSelect) {
    if (!venue.googlePlaceId) return venue;
    const refreshed = await refreshVenueFromGoogle(venue);
    const googleFields = buildGoogleVenueFields(refreshed.snapshot);
    return {
        ...venue,
        googlePlaceId: googleFields.googlePlaceId,
        googleSourceSnapshot: refreshed.snapshot as typeof venue.googleSourceSnapshot,
        googleLastSyncedAt: new Date(),
        googleSyncStatus: 'SYNCED' as typeof venue.googleSyncStatus,
        googleSyncError: null,
        ratingOverride: googleFields.ratingOverride,
        reviewCountOverride: googleFields.reviewCountOverride,
        description: (refreshed.updates.description as typeof venue.description | undefined) ?? venue.description,
        shortDescription: (refreshed.updates.shortDescription as typeof venue.shortDescription | undefined) ?? venue.shortDescription,
        priceRange: (refreshed.updates.priceRange as typeof venue.priceRange | undefined) ?? venue.priceRange,
        descriptionSource: (refreshed.updates.descriptionSource as typeof venue.descriptionSource | undefined) ?? venue.descriptionSource,
        shortDescriptionSource: (refreshed.updates.shortDescriptionSource as typeof venue.shortDescriptionSource | undefined) ?? venue.shortDescriptionSource,
        priceRangeSource: (refreshed.updates.priceRangeSource as typeof venue.priceRangeSource | undefined) ?? venue.priceRangeSource,
    };
}

async function resolveVenueGooglePhotoRedirect(venue: typeof venues.$inferSelect, photoName: string) {
    try {
        return await getGooglePhotoMediaUri(photoName);
    } catch (error) {
        if (!venue.googlePlaceId) throw error;

        const refreshedVenue = await refreshVenueGoogleSnapshot(venue);
        const refreshedSnapshot = normalizeGoogleSourceSnapshot((refreshedVenue.googleSourceSnapshot || {}) as GoogleSourceSnapshot);
        if (!(refreshedSnapshot.photos || []).some((photo) => photo.name === photoName)) {
            throw error;
        }

        return getGooglePhotoMediaUri(photoName);
    }

}

// ─── GET / ──────────────────────────────────────
venueRoutes.get('/:slugOrId/cover-image', async (c) => {
    const slugOrId = c.req.param('slugOrId');
    const venue = await getPublicVenueBySlugOrId(slugOrId);
    if (!venue) {
        return c.json(apiError('NOT_FOUND', 'Venue not found'), 404);
    }

    const manualCover = venue.coverImageUrl?.trim() || null;
    if (manualCover) {
        return c.redirect(manualCover, 302);
    }

    const manualGallery = galleryImageUrlsFromMetadata(venue.metadata);
    const { cover, gallery } = resolveSelectedGooglePhotos(
        normalizeGoogleSourceSnapshot((venue.googleSourceSnapshot || {}) as GoogleSourceSnapshot),
    );

    if (cover?.name) {
        try {
            const photoUri = await resolveVenueGooglePhotoRedirect(venue, cover.name);
            return c.redirect(photoUri, 302);
        } catch {
            // fall through to the next valid image source
        }
    }

    if (manualGallery[0]) {
        return c.redirect(manualGallery[0], 302);
    }

    if (gallery[0]?.name) {
        try {
            const photoUri = await resolveVenueGooglePhotoRedirect(venue, gallery[0].name);
            return c.redirect(photoUri, 302);
        } catch {
            // fall through to 404
        }
    }

    return c.json(apiError('NOT_FOUND', 'Venue cover image not found'), 404);
});

venueRoutes.get('/:slugOrId/gallery/:index', async (c) => {
    const slugOrId = c.req.param('slugOrId');
    const galleryIndex = Number.parseInt(c.req.param('index'), 10);
    if (!Number.isInteger(galleryIndex) || galleryIndex < 0) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid gallery index'), 400);
    }

    const venue = await getPublicVenueBySlugOrId(slugOrId);
    if (!venue) {
        return c.json(apiError('NOT_FOUND', 'Venue not found'), 404);
    }

    const manualGallery = galleryImageUrlsFromMetadata(venue.metadata);
    if (galleryIndex < manualGallery.length) {
        return c.redirect(manualGallery[galleryIndex]!, 302);
    }

    const normalizedSnapshot = normalizeGoogleSourceSnapshot((venue.googleSourceSnapshot || {}) as GoogleSourceSnapshot);
    const { gallery } = resolveSelectedGooglePhotos(normalizedSnapshot);
    const googleIndex = galleryIndex - manualGallery.length;
    const googlePhoto = gallery[googleIndex] || null;
    if (!googlePhoto?.name) {
        return c.json(apiError('NOT_FOUND', 'Venue gallery image not found'), 404);
    }

    try {
        const photoUri = await resolveVenueGooglePhotoRedirect(venue, googlePhoto.name);
        return c.redirect(photoUri, 302);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Google gallery image lookup failed';
        return c.json(apiError('SERVICE_UNAVAILABLE', message), 503);
    }
});

venueRoutes.get('/:slugOrId/google-photo', async (c) => {
    const slugOrId = c.req.param('slugOrId');
    const photoName = c.req.query('name')?.trim();
    if (!photoName) {
        return c.json(apiError('VALIDATION_ERROR', 'Google photo name is required'), 400);
    }

    const venue = await getPublicVenueBySlugOrId(slugOrId);
    if (!venue) {
        return c.json(apiError('NOT_FOUND', 'Venue not found'), 404);
    }

    const normalizedSnapshot = normalizeGoogleSourceSnapshot((venue.googleSourceSnapshot || {}) as GoogleSourceSnapshot);
    if (!(normalizedSnapshot.photos || []).some((photo) => photo.name === photoName)) {
        return c.json(apiError('NOT_FOUND', 'Google photo not found for venue'), 404);
    }

    try {
        const photoUri = await resolveVenueGooglePhotoRedirect(venue, photoName);
        return c.redirect(photoUri, 302);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Google photo lookup failed';
        return c.json(apiError('SERVICE_UNAVAILABLE', message), 503);
    }
});
venueRoutes.get('/', async (c) => {
    const query = venueQuerySchema.safeParse(c.req.query());
    if (!query.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid query', query.error.issues), 400);
    }

    const { q, city, lat, lng, is_verified, page, limit } = query.data;
    const offset = paginationOffset(page, limit);

    let conditions: any[] = [eq(venues.isActive, true), eq(venues.approvalStatus, 'APPROVED')];
    if (city) conditions.push(ilike(venues.city, `%${city}%`));
    if (q) conditions.push(ilike(venues.name, `%${q}%`));
    if (is_verified !== undefined) conditions.push(eq(venues.isVerified, is_verified));

    const whereClause = and(...conditions);

    const [rows, [totalResult]] = await Promise.all([
        db.select()
            .from(venues)
            .where(whereClause)
            .orderBy(
                desc(venues.isFeatured),
                desc(sql`coalesce(${venues.ratingOverride}, ${venues.averageRating})`),
            )
            .limit(limit)
            .offset(offset),
        db.select({ count: count() }).from(venues).where(whereClause),
    ]);

    // Fetch upcoming event counts for all returned venues in one query
    const venueIds = rows.map(v => v.id);
    const eventCounts = venueIds.length > 0
        ? await db.select({ venueId: venueEvents.venueId, cnt: count() })
            .from(venueEvents)
            .innerJoin(matches, eq(venueEvents.matchId, matches.id))
            .where(and(
                inArray(venueEvents.venueId, venueIds),
                eq(venueEvents.isActive, true),
                gte(matches.matchDateUtc, new Date()),
            ))
            .groupBy(venueEvents.venueId)
        : [];
    const eventCountMap = new Map(eventCounts.map(e => [e.venueId, Number(e.cnt)]));

    const results = rows.map((v) => {
        const distance = lat && lng
            ? haversineDistance(lat, lng, Number(v.lat), Number(v.lng))
            : null;
        const { googleSuggestedImages: _googleSuggestedImages, ...imagePayload } = venueImagePayloadForRow(v);


        return {
            id: v.id,
            name: v.name,
            slug: v.slug,
            shortDescription: v.shortDescription,
            addressLine1: v.addressLine1,
            city: v.city,
            stateProvince: v.stateProvince,
            lat: Number(v.lat),
            lng: Number(v.lng),
            coverImageUrl: imagePayload.coverImageUrl,
            galleryImageUrls: imagePayload.galleryImageUrls,
            imageSource: imagePayload.imageSource,
            coverImageAttributions: imagePayload.coverImageAttributions,
            galleryImageAttributions: imagePayload.galleryImageAttributions,
            amenities: v.amenities,
            vibes: v.vibes,
            cuisineTags: v.cuisineTags,
            priceRange: v.priceRange,
            averageRating: v.averageRating,
            totalReviews: v.totalReviews,
            ratingOverride: v.ratingOverride,
            reviewCountOverride: v.reviewCountOverride,
            isVerified: v.isVerified,
            isFeatured: v.isFeatured,
            capacity: v.capacity,
            upcomingEventsCount: eventCountMap.get(v.id) ?? 0,
            distance: distance ? `${distance.toFixed(1)} km` : null,
        };
    });

    if (lat && lng) {
        results.sort((a, b) => parseFloat(a.distance || '9999') - parseFloat(b.distance || '9999'));
    }

    // Cache list for 60s, allow serving stale for up to 5min while revalidating
    c.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return c.json(apiResponse(results, paginationMeta(page, limit, Number(totalResult?.count ?? 0))));
});

// ─── GET /following ─────────────────────────────
venueRoutes.get('/following', authMiddleware, async (c) => {
    const user = c.get('user');
    const query = paginationSchema.safeParse(c.req.query());
    if (!query.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid query', query.error.issues), 400);
    }

    const { page, limit } = query.data;
    const offset = paginationOffset(page, limit);

    const rows = await db.select({
        venue: venues,
        followedAt: follows.createdAt,
    })
        .from(follows)
        .innerJoin(venues, eq(follows.venueId, venues.id))
        .where(eq(follows.userId, user.id))
        .orderBy(desc(follows.createdAt))
        .limit(limit)
        .offset(offset);

    const [totalResult] = await db.select({ count: count() }).from(follows).where(eq(follows.userId, user.id));

    return c.json(apiResponse(
        rows.map(r => {
            const { googleSuggestedImages: _googleSuggestedImages, ...imagePayload } = venueImagePayloadForRow(r.venue);
            return {
                ...r.venue,
                ...imagePayload,
                followedAt: r.followedAt,
            };
        }),
        paginationMeta(page, limit, Number(totalResult?.count ?? 0)),
    ));
});

// ─── GET /:slugOrId ─────────────────────────────
venueRoutes.get('/:slugOrId', optionalAuthMiddleware, async (c) => {
    const slugOrId = c.req.param('slugOrId');
    const venue = await getPublicVenueBySlugOrId(slugOrId);
    if (!venue) {
        return c.json(apiError('NOT_FOUND', 'Venue not found'), 404);
    }
    if (venue.googlePlaceId && isGoogleSyncStale(venue.googleLastSyncedAt)) {
        void refreshVenueFromGoogle(venue).catch(() => undefined);
    }
    const { googleSuggestedImages: _googleSuggestedImages, ...imagePayload } = venueImagePayloadForRow(venue);
    const workingHours = venueWorkingHoursForRow(venue);
    const normalizedSnapshot = normalizeGoogleSourceSnapshot((venue.googleSourceSnapshot || {}) as GoogleSourceSnapshot);
    const googleReviews = getPublicGoogleReviews(normalizedSnapshot);

    const upcomingEvents = await db.select({
        event: venueEvents,
        match: matches,
    })
        .from(venueEvents)
        .innerJoin(matches, eq(venueEvents.matchId, matches.id))
        .where(and(
            eq(venueEvents.venueId, venue.id),
            eq(venueEvents.isActive, true),
        ))
        .orderBy(asc(matches.matchDateUtc))
        .limit(5);

    const customEvents = await db.select().from(venueCustomEvents)
        .where(and(
            eq(venueCustomEvents.venueId, venue.id),
            eq(venueCustomEvents.isActive, true),
        ))
        .orderBy(asc(venueCustomEvents.startsAt))
        .limit(10);

    const promotedVenueEventId = promotedVenueEventIdFromMetadata(venue.metadata);
    const [promotedEventRow] = promotedVenueEventId ? await db.select({
        event: venueEvents,
        match: matches,
    })
        .from(venueEvents)
        .innerJoin(matches, eq(venueEvents.matchId, matches.id))
        .where(and(
            eq(venueEvents.id, promotedVenueEventId),
            eq(venueEvents.venueId, venue.id),
            eq(venueEvents.isActive, true),
        ))
        .limit(1) : [];

    // Get recent posts (3)
    const recentPosts = await db.select().from(posts)
        .where(and(eq(posts.venueId, venue.id), eq(posts.isPublished, true)))
        .orderBy(desc(posts.createdAt))
        .limit(3);

    // Get follower count
    const [followerResult] = await db.select({ count: count() }).from(follows).where(eq(follows.venueId, venue.id));

    // Check if current user follows
    const user = c.get('user');
    let isFollowing = false;
    if (user) {
        const [follow] = await db.select().from(follows)
            .where(and(eq(follows.userId, user.id), eq(follows.venueId, venue.id)))
            .limit(1);
        isFollowing = !!follow;
    }
    const fanTeams = await db.select({
        id: teams.id,
        slug: teams.slug,
        name: teams.name,
        shortName: teams.shortName,
        crestUrl: teams.crestUrl,
        shortDescription: teams.shortDescription,
        leagueId: teams.leagueId,
        leagueName: leagues.name,
        leagueSlug: leagues.slug,
        leagueShortName: leagues.shortName,
        leagueLogoUrl: leagues.logoUrl,
    })
        .from(teamFanVenues)
        .innerJoin(teams, eq(teamFanVenues.teamId, teams.id))
        .leftJoin(leagues, eq(teams.leagueId, leagues.id))
        .where(and(
            eq(teamFanVenues.venueId, venue.id),
            eq(teams.isActive, true),
        ))
        .orderBy(teams.name);

    // Detail endpoint: use full-size photos (1200px)
    const galleryUrls = galleryImageUrlsFromMetadata(venue.metadata);
    c.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return c.json(apiResponse({
        ...venue,
        ...imagePayload,
        workingHours,
        googleEditorialSummary: normalizedSnapshot.editorialSummary || null,
        googlePriceLevel: normalizedSnapshot.priceLevel || null,
        googleReviews,

        promotedVenueEventId,
        followerCount: Number(followerResult?.count ?? 0),
        isFollowing,
        promotedEvent: promotedEventRow ? {
            ...promotedEventRow.event,
            match: promotedEventRow.match,
            spotsRemaining: promotedEventRow.event.bookingLimit
                ? promotedEventRow.event.bookingLimit - promotedEventRow.event.confirmedBookingsCount
                : null,
        } : null,
        nearestUpcomingMatch: upcomingEvents[0] ? {
            ...upcomingEvents[0].event,
            match: upcomingEvents[0].match,
            spotsRemaining: upcomingEvents[0].event.bookingLimit
                ? upcomingEvents[0].event.bookingLimit - upcomingEvents[0].event.confirmedBookingsCount
                : null,
        } : null,
        upcomingEvents: upcomingEvents.map(e => ({
            ...e.event,
            match: e.match,
            spotsRemaining: e.event.bookingLimit ? e.event.bookingLimit - e.event.confirmedBookingsCount : null,
        })),
        customEvents,
        recentPosts,
        fanTeams: fanTeams.map((team) => ({
            id: team.id,
            slug: team.slug,
            name: team.name,
            shortName: team.shortName,
            crestUrl: team.crestUrl,
            shortDescription: team.shortDescription,
            league: team.leagueId ? {
                id: team.leagueId,
                slug: team.leagueSlug,
                name: team.leagueName,
                shortName: team.leagueShortName,
                logoUrl: team.leagueLogoUrl,
            } : null,
        })),
    }));
});

// ─── GET /:slugOrId/events ──────────────────────
venueRoutes.get('/:slugOrId/events', async (c) => {
    const slugOrId = c.req.param('slugOrId');
    const query = paginationSchema.safeParse(c.req.query());
    if (!query.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid query', query.error.issues), 400);
    }

    const { page, limit } = query.data;
    const offset = paginationOffset(page, limit);

    const [venue] = await db.select({ id: venues.id }).from(venues).where(
        sql`${venues.slug} = ${slugOrId} OR ${venues.id}::text = ${slugOrId}`,
    ).limit(1);
    if (!venue) return c.json(apiError('NOT_FOUND', 'Venue not found'), 404);

    const [publicVenue] = await db.select({ approvalStatus: venues.approvalStatus, isActive: venues.isActive }).from(venues).where(eq(venues.id, venue.id)).limit(1);
    if (!publicVenue || !publicVenue.isActive || publicVenue.approvalStatus !== 'APPROVED') {
        return c.json(apiError('NOT_FOUND', 'Venue not found'), 404);
    }

    const rows = await db.select({
        event: venueEvents,
        match: matches,
    })
        .from(venueEvents)
        .innerJoin(matches, eq(venueEvents.matchId, matches.id))
        .where(and(eq(venueEvents.venueId, venue.id), eq(venueEvents.isActive, true)))
        .orderBy(asc(matches.matchDateUtc))
        .limit(limit)
        .offset(offset);

    return c.json(apiResponse(rows.map(r => ({
        ...r.event,
        match: r.match,
        spotsRemaining: r.event.bookingLimit ? r.event.bookingLimit - r.event.confirmedBookingsCount : null,
    }))));
});

venueRoutes.get('/:slugOrId/custom-events', async (c) => {
    const slugOrId = c.req.param('slugOrId');

    const [venue] = await db.select({ id: venues.id }).from(venues).where(
        sql`${venues.slug} = ${slugOrId} OR ${venues.id}::text = ${slugOrId}`,
    ).limit(1);
    if (!venue) return c.json(apiError('NOT_FOUND', 'Venue not found'), 404);
    const [publicVenue] = await db.select({ approvalStatus: venues.approvalStatus, isActive: venues.isActive }).from(venues).where(eq(venues.id, venue.id)).limit(1);
    if (!publicVenue || !publicVenue.isActive || publicVenue.approvalStatus !== 'APPROVED') {
        return c.json(apiError('NOT_FOUND', 'Venue not found'), 404);
    }

    const rows = await db.select().from(venueCustomEvents)
        .where(and(
            eq(venueCustomEvents.venueId, venue.id),
            eq(venueCustomEvents.isActive, true),
        ))
        .orderBy(asc(venueCustomEvents.startsAt));

    return c.json(apiResponse(rows));
});

// ─── GET /:slugOrId/posts ───────────────────────
venueRoutes.get('/:slugOrId/posts', async (c) => {
    const slugOrId = c.req.param('slugOrId');
    const query = paginationSchema.safeParse(c.req.query());
    if (!query.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid query', query.error.issues), 400);
    }

    const { page, limit } = query.data;
    const offset = paginationOffset(page, limit);

    const [venue] = await db.select({ id: venues.id }).from(venues).where(
        sql`${venues.slug} = ${slugOrId} OR ${venues.id}::text = ${slugOrId}`,
    ).limit(1);
    if (!venue) return c.json(apiError('NOT_FOUND', 'Venue not found'), 404);
    const [publicVenue] = await db.select({ approvalStatus: venues.approvalStatus, isActive: venues.isActive }).from(venues).where(eq(venues.id, venue.id)).limit(1);
    if (!publicVenue || !publicVenue.isActive || publicVenue.approvalStatus !== 'APPROVED') {
        return c.json(apiError('NOT_FOUND', 'Venue not found'), 404);
    }

    const rows = await db.select().from(posts)
        .where(and(eq(posts.venueId, venue.id), eq(posts.isPublished, true)))
        .orderBy(desc(posts.createdAt))
        .limit(limit)
        .offset(offset);

    return c.json(apiResponse(rows));
});

// ─── GET /:slugOrId/menu ────────────────────────
venueRoutes.get('/:slugOrId/menu', async (c) => {
    const slugOrId = c.req.param('slugOrId');

    const [venue] = await db.select({ id: venues.id }).from(venues).where(
        sql`${venues.slug} = ${slugOrId} OR ${venues.id}::text = ${slugOrId}`,
    ).limit(1);
    if (!venue) return c.json(apiError('NOT_FOUND', 'Venue not found'), 404);
    const [publicVenue] = await db.select({ approvalStatus: venues.approvalStatus, isActive: venues.isActive }).from(venues).where(eq(venues.id, venue.id)).limit(1);
    if (!publicVenue || !publicVenue.isActive || publicVenue.approvalStatus !== 'APPROVED') {
        return c.json(apiError('NOT_FOUND', 'Venue not found'), 404);
    }

    const categories = await db.select().from(menuCategories)
        .where(and(eq(menuCategories.venueId, venue.id), eq(menuCategories.isActive, true)))
        .orderBy(asc(menuCategories.sortOrder));

    const items = await db.select().from(menuItems)
        .where(eq(menuItems.venueId, venue.id))
        .orderBy(asc(menuItems.sortOrder));

    const menu = categories.map(cat => ({
        ...cat,
        items: items.filter(item => item.categoryId === cat.id),
    }));

    return c.json(apiResponse(menu));
});

// ─── GET /:slugOrId/reviews ─────────────────────
venueRoutes.get('/:slugOrId/reviews', async (c) => {
    const slugOrId = c.req.param('slugOrId');
    const query = paginationSchema.safeParse(c.req.query());
    if (!query.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid query', query.error.issues), 400);
    }

    const { page, limit } = query.data;
    const offset = paginationOffset(page, limit);

    const [venue] = await db.select({ id: venues.id }).from(venues).where(
        sql`${venues.slug} = ${slugOrId} OR ${venues.id}::text = ${slugOrId}`,
    ).limit(1);
    if (!venue) return c.json(apiError('NOT_FOUND', 'Venue not found'), 404);
    const [publicVenue] = await db.select({ approvalStatus: venues.approvalStatus, isActive: venues.isActive }).from(venues).where(eq(venues.id, venue.id)).limit(1);
    if (!publicVenue || !publicVenue.isActive || publicVenue.approvalStatus !== 'APPROVED') {
        return c.json(apiError('NOT_FOUND', 'Venue not found'), 404);
    }

    const rows = await db.select({
        review: reviews,
        userName: users.name,
        userAvatar: users.avatarUrl,
    })
        .from(reviews)
        .innerJoin(users, eq(reviews.userId, users.id))
        .where(eq(reviews.venueId, venue.id))
        .orderBy(desc(reviews.createdAt))
        .limit(limit)
        .offset(offset);

    const [totalResult] = await db.select({ count: count() }).from(reviews).where(eq(reviews.venueId, venue.id));

    return c.json(apiResponse(
        rows.map(r => ({ ...r.review, userName: r.userName, userAvatar: r.userAvatar })),
        paginationMeta(page, limit, Number(totalResult?.count ?? 0)),
    ));
});

// ─── POST /:slugOrId/follow ─────────────────────
venueRoutes.post('/:slugOrId/follow', authMiddleware, async (c) => {
    const user = c.get('user');
    const slugOrId = c.req.param('slugOrId');

    const [venue] = await db.select({ id: venues.id }).from(venues).where(
        sql`${venues.slug} = ${slugOrId} OR ${venues.id}::text = ${slugOrId}`,
    ).limit(1);
    if (!venue) return c.json(apiError('NOT_FOUND', 'Venue not found'), 404);

    const [existing] = await db.select().from(follows)
        .where(and(eq(follows.userId, user.id), eq(follows.venueId, venue.id)))
        .limit(1);

    if (existing) {
        await db.delete(follows).where(eq(follows.id, existing.id));
        return c.json(apiResponse({ following: false }));
    } else {
        await db.insert(follows).values({ userId: user.id, venueId: venue.id });
        return c.json(apiResponse({ following: true }));
    }
});

// ─── POST /:slugOrId/reviews ────────────────────
venueRoutes.post('/:slugOrId/reviews', authMiddleware, async (c) => {
    const user = c.get('user');
    const slugOrId = c.req.param('slugOrId');
    const body = await c.req.json();

    const { createReviewSchema } = await import('@matchwatch/shared');
    const parsed = createReviewSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const [venue] = await db.select({ id: venues.id }).from(venues).where(
        sql`${venues.slug} = ${slugOrId} OR ${venues.id}::text = ${slugOrId}`,
    ).limit(1);
    if (!venue) return c.json(apiError('NOT_FOUND', 'Venue not found'), 404);

    const [review] = await db.insert(reviews).values({
        userId: user.id,
        venueId: venue.id,
        rating: parsed.data.rating,
        title: parsed.data.title,
        content: parsed.data.content,
        venueEventId: parsed.data.venueEventId,
    }).returning();

    // Update venue average rating
    const [ratingResult] = await db.select({
        avg: sql<string>`AVG(${reviews.rating})`,
        count: count(),
    }).from(reviews).where(eq(reviews.venueId, venue.id));

    await db.update(venues).set({
        averageRating: ratingResult.avg || '0',
        totalReviews: Number(ratingResult.count),
        updatedAt: new Date(),
    }).where(eq(venues.id, venue.id));

    return c.json(apiResponse(review), 201);
});

export default venueRoutes;


