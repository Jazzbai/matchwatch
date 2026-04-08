import { Hono } from 'hono';
import { db } from '../db/client';
import { users, bookings, follows, notifications, userTeamInterests, posts, venues, venueEvents, matches, teams } from '../db/schema';
import { eq, and, desc, count, sql, inArray } from 'drizzle-orm';
import { apiResponse, apiError, paginationMeta, paginationOffset } from '../lib/utils';
import { updateProfileSchema, updateInterestsSchema, paginationSchema, readNotificationsSchema } from '@matchwatch/shared';
import { authMiddleware } from '../middleware';

const userRoutes = new Hono();
userRoutes.use('*', authMiddleware);

// ─── Profile ─────────────────────────────────────
async function getProfileHandler(c: any) {
    const auth = c.get('user');

    const [user] = await db.select({
        id: users.id,
        email: users.email,
        name: users.name,
        avatarUrl: users.avatarUrl,
        avatarS3Key: users.avatarS3Key,
        role: users.role,
        timezone: users.timezone,
        locale: users.locale,
        emailVerified: users.emailVerified,
        businessApprovalStatus: users.businessApprovalStatus,
        businessApprovalNotes: users.businessApprovalNotes,
        createdAt: users.createdAt,
    }).from(users).where(eq(users.id, auth.id)).limit(1);

    if (!user) return c.json(apiError('NOT_FOUND', 'User not found'), 404);

    // Get counts
    const [bookingCount] = await db.select({ count: count() }).from(bookings)
        .where(and(eq(bookings.userId, auth.id), sql`${bookings.status} NOT IN ('CANCELLED_BY_USER', 'CANCELLED_BY_VENUE')`));
    const [followCount] = await db.select({ count: count() }).from(follows).where(eq(follows.userId, auth.id));
    const [unreadNotifCount] = await db.select({ count: count() }).from(notifications)
        .where(and(eq(notifications.userId, auth.id), eq(notifications.isRead, false)));

    return c.json(apiResponse({
        ...user,
        stats: {
            bookings: Number(bookingCount?.count ?? 0),
            following: Number(followCount?.count ?? 0),
            unreadNotifications: Number(unreadNotifCount?.count ?? 0),
        },
    }));
}

async function updateProfileHandler(c: any) {
    const auth = c.get('user');
    const body = await c.req.json();
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    await db.update(users).set({
        ...parsed.data,
        updatedAt: new Date(),
    }).where(eq(users.id, auth.id));

    return c.json(apiResponse({ message: 'Profile updated' }));
}

userRoutes.get('/me', getProfileHandler);
userRoutes.get('/profile', getProfileHandler);
userRoutes.put('/me', updateProfileHandler);
userRoutes.put('/profile', updateProfileHandler);
userRoutes.patch('/profile', updateProfileHandler);

// ─── Avatar ─────────────────────────────────────
async function updateAvatarHandler(c: any) {
    const auth = c.get('user');
    const body = await c.req.json().catch(() => ({}));
    const avatarUrl = typeof body.avatarUrl === 'string' ? body.avatarUrl : null;
    const avatarS3Key = typeof body.avatarS3Key === 'string' ? body.avatarS3Key : null;

    if (!avatarUrl) {
        return c.json(apiError('VALIDATION_ERROR', 'avatarUrl is required'), 400);
    }

    await db.update(users).set({
        avatarUrl,
        avatarS3Key,
        updatedAt: new Date(),
    }).where(eq(users.id, auth.id));

    return c.json(apiResponse({ message: 'Avatar updated', avatarUrl, avatarS3Key }));
}

userRoutes.post('/avatar', updateAvatarHandler);
userRoutes.put('/avatar', updateAvatarHandler);
userRoutes.patch('/avatar', updateAvatarHandler);

// ─── GET /interests ─────────────────────────────
userRoutes.get('/interests', async (c) => {
    const auth = c.get('user');

    const interests = await db.select({
        team: teams,
    })
        .from(userTeamInterests)
        .innerJoin(teams, eq(userTeamInterests.teamId, teams.id))
        .where(eq(userTeamInterests.userId, auth.id));

    return c.json(apiResponse(interests.map(i => i.team)));
});

// ─── PUT/POST /interests ────────────────────────
async function updateInterestsHandler(c: any) {
    const auth = c.get('user');
    const body = await c.req.json();
    const parsed = updateInterestsSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    // Delete existing interests
    await db.delete(userTeamInterests).where(eq(userTeamInterests.userId, auth.id));

    // Insert new ones
    if (parsed.data.teamIds.length > 0) {
        await db.insert(userTeamInterests).values(
            parsed.data.teamIds.map(teamId => ({ userId: auth.id, teamId })),
        );
    }

    return c.json(apiResponse({ message: 'Interests updated' }));
}

userRoutes.put('/interests', updateInterestsHandler);
userRoutes.post('/interests', updateInterestsHandler);

// ─── GET /feed ──────────────────────────────────
userRoutes.get('/feed', async (c) => {
    const auth = c.get('user');
    const query = paginationSchema.safeParse(c.req.query());
    if (!query.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid query', query.error.issues), 400);
    }

    const { page, limit } = query.data;
    const offset = paginationOffset(page, limit);

    // Get IDs of followed venues
    const followedVenues = await db.select({ venueId: follows.venueId })
        .from(follows).where(eq(follows.userId, auth.id));

    if (followedVenues.length === 0) {
        return c.json(apiResponse([], paginationMeta(page, limit, 0)));
    }

    const venueIds = followedVenues.map(f => f.venueId);

    const feedPosts = await db.select({
        post: posts,
        venue: venues,
    })
        .from(posts)
        .innerJoin(venues, eq(posts.venueId, venues.id))
        .where(and(
            inArray(posts.venueId, venueIds),
            eq(posts.isPublished, true),
        ))
        .orderBy(desc(posts.createdAt))
        .limit(limit)
        .offset(offset);

    return c.json(apiResponse(feedPosts.map(r => ({
        ...r.post,
        venue: { id: r.venue.id, name: r.venue.name, slug: r.venue.slug, coverImageUrl: r.venue.coverImageUrl },
    }))));
});

// ─── GET /notifications ─────────────────────────
userRoutes.get('/notifications', async (c) => {
    const auth = c.get('user');
    const query = paginationSchema.safeParse(c.req.query());
    if (!query.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid query', query.error.issues), 400);
    }

    const { page, limit } = query.data;
    const offset = paginationOffset(page, limit);

    const rows = await db.select().from(notifications)
        .where(eq(notifications.userId, auth.id))
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset);

    const [totalResult] = await db.select({ count: count() }).from(notifications)
        .where(eq(notifications.userId, auth.id));

    return c.json(apiResponse(rows, paginationMeta(page, limit, Number(totalResult?.count ?? 0))));
});

// ─── Read Notifications ─────────────────────────
async function readNotificationsHandler(c: any) {
    const auth = c.get('user');
    const body = await c.req.json().catch(() => ({}));
    const parsed = readNotificationsSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input'), 400);
    }

    if (parsed.data.ids && parsed.data.ids.length > 0) {
        await db.update(notifications).set({
            isRead: true,
            readAt: new Date(),
        }).where(and(
            eq(notifications.userId, auth.id),
            inArray(notifications.id, parsed.data.ids),
        ));
    } else {
        // Mark all as read
        await db.update(notifications).set({
            isRead: true,
            readAt: new Date(),
        }).where(and(
            eq(notifications.userId, auth.id),
            eq(notifications.isRead, false),
        ));
    }

    return c.json(apiResponse({ message: 'Notifications marked as read' }));
}

userRoutes.put('/notifications/read', readNotificationsHandler);
userRoutes.post('/notifications/read', readNotificationsHandler);
userRoutes.put('/notifications/read-all', readNotificationsHandler);
userRoutes.post('/notifications/read-all', readNotificationsHandler);

export default userRoutes;
