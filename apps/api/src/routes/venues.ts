import { Hono } from 'hono';
import { db } from '../db/client';
import { venues, venueEvents, matches, posts, menuCategories, menuItems, follows, reviews, users, venueCustomEvents } from '../db/schema';
import { eq, and, gte, count, desc, asc, sql, ilike } from 'drizzle-orm';
import { apiResponse, apiError, paginationMeta, paginationOffset, haversineDistance } from '../lib/utils';
import { venueQuerySchema, paginationSchema } from '@matchwatch/shared';
import { authMiddleware, optionalAuthMiddleware } from '../middleware';

const venueRoutes = new Hono();

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

// ─── GET / ──────────────────────────────────────
venueRoutes.get('/', async (c) => {
    const query = venueQuerySchema.safeParse(c.req.query());
    if (!query.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid query', query.error.issues), 400);
    }

    const { q, city, lat, lng, is_verified, page, limit } = query.data;
    const offset = paginationOffset(page, limit);

    let conditions: any[] = [eq(venues.isActive, true)];
    if (city) conditions.push(ilike(venues.city, `%${city}%`));
    if (q) conditions.push(ilike(venues.name, `%${q}%`));
    if (is_verified !== undefined) conditions.push(eq(venues.isVerified, is_verified));

    const whereClause = and(...conditions);

    const [rows, [totalResult]] = await Promise.all([
        db.select().from(venues).where(whereClause).orderBy(desc(venues.isFeatured), desc(venues.averageRating)).limit(limit).offset(offset),
        db.select({ count: count() }).from(venues).where(whereClause),
    ]);

    const results = rows.map((v) => {
        const distance = lat && lng
            ? haversineDistance(lat, lng, Number(v.lat), Number(v.lng))
            : null;
        const galleryImageUrls = galleryImageUrlsFromMetadata(v.metadata);
        const coverImageUrl = v.coverImageUrl || galleryImageUrls[0] || null;

        return {
            id: v.id,
            name: v.name,
            slug: v.slug,
            shortDescription: v.shortDescription,
            addressLine1: v.addressLine1,
            city: v.city,
            lat: Number(v.lat),
            lng: Number(v.lng),
            coverImageUrl,
            galleryImageUrls,
            amenities: v.amenities,
            cuisineTags: v.cuisineTags,
            priceRange: v.priceRange,
            averageRating: v.averageRating,
            totalReviews: v.totalReviews,
            isVerified: v.isVerified,
            isFeatured: v.isFeatured,
            capacity: v.capacity,
            distance: distance ? `${distance.toFixed(1)} km` : null,
        };
    });

    if (lat && lng) {
        results.sort((a, b) => parseFloat(a.distance || '9999') - parseFloat(b.distance || '9999'));
    }

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
        rows.map(r => ({
            ...r.venue,
            coverImageUrl: r.venue.coverImageUrl || galleryImageUrlsFromMetadata(r.venue.metadata)[0] || null,
            galleryImageUrls: galleryImageUrlsFromMetadata(r.venue.metadata),
            followedAt: r.followedAt,
        })),
        paginationMeta(page, limit, Number(totalResult?.count ?? 0)),
    ));
});

// ─── GET /:slugOrId ─────────────────────────────
venueRoutes.get('/:slugOrId', optionalAuthMiddleware, async (c) => {
    const slugOrId = c.req.param('slugOrId');

    const [venue] = await db.select().from(venues).where(
        sql`${venues.slug} = ${slugOrId} OR ${venues.id}::text = ${slugOrId}`,
    ).limit(1);

    if (!venue || !venue.isActive) {
        return c.json(apiError('NOT_FOUND', 'Venue not found'), 404);
    }

    // Get upcoming events (next 5)
    const now = new Date().toISOString();
    await db.update(venueCustomEvents).set({
        isActive: false,
        updatedAt: new Date(),
    }).where(and(
        eq(venueCustomEvents.venueId, venue.id),
        eq(venueCustomEvents.isActive, true),
        sql`${venueCustomEvents.endsAt} < ${now}`,
    ));

    const upcomingEvents = await db.select({
        event: venueEvents,
        match: matches,
    })
        .from(venueEvents)
        .innerJoin(matches, eq(venueEvents.matchId, matches.id))
        .where(and(
            eq(venueEvents.venueId, venue.id),
            eq(venueEvents.isActive, true),
            gte(matches.matchDateUtc, now),
        ))
        .orderBy(asc(matches.matchDateUtc))
        .limit(5);

    const customEvents = await db.select().from(venueCustomEvents)
        .where(and(
            eq(venueCustomEvents.venueId, venue.id),
            eq(venueCustomEvents.isActive, true),
            gte(venueCustomEvents.endsAt, now),
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
            gte(matches.matchDateUtc, now),
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

    return c.json(apiResponse({
        ...venue,
        coverImageUrl: venue.coverImageUrl || galleryImageUrlsFromMetadata(venue.metadata)[0] || null,
        galleryImageUrls: galleryImageUrlsFromMetadata(venue.metadata),
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

    const now = new Date().toISOString();
    await db.update(venueCustomEvents).set({
        isActive: false,
        updatedAt: new Date(),
    }).where(and(
        eq(venueCustomEvents.venueId, venue.id),
        eq(venueCustomEvents.isActive, true),
        sql`${venueCustomEvents.endsAt} < ${now}`,
    ));

    const rows = await db.select().from(venueCustomEvents)
        .where(and(
            eq(venueCustomEvents.venueId, venue.id),
            eq(venueCustomEvents.isActive, true),
            gte(venueCustomEvents.endsAt, now),
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
