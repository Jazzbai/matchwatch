import { Hono } from 'hono';
import { db } from '../db/client';
import { users, venues, matches, bookings, auditLogs, venueEvents, syncHistory, leagues } from '../db/schema';
import { eq, count, desc, sql, gte, and } from 'drizzle-orm';
import { apiResponse, apiError, paginationMeta, paginationOffset } from '../lib/utils';
import { adminUpdateUserSchema, adminUpdateVenueSchema, paginationSchema } from '@matchwatch/shared';
import { authMiddleware, requireRole, adminRateLimit } from '../middleware';
import { triggerManualSync } from '../workers/matchSync';
import { ensureLeaguesSeeded, seedDatabase } from '../db/seed';

const adminRoutes = new Hono();

adminRoutes.use('*', authMiddleware);
adminRoutes.use('*', requireRole('ADMIN', 'SUPER_ADMIN'));
adminRoutes.use('*', adminRateLimit);

// ─── GET /stats ─────────────────────────────────
adminRoutes.get('/stats', async (c) => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [userCount] = await db.select({ count: count() }).from(users);
    const [venueCount] = await db.select({ count: count() }).from(venues).where(eq(venues.isActive, true));
    const [matchCount] = await db.select({ count: count() }).from(matches);
    const [bookingCount] = await db.select({ count: count() }).from(bookings);
    const [recentBookingCount] = await db.select({ count: count() }).from(bookings).where(gte(bookings.createdAt, thirtyDaysAgo));
    const [recentUserCount] = await db.select({ count: count() }).from(users).where(gte(users.createdAt, thirtyDaysAgo));
    const [verifiedVenuesCount] = await db.select({ count: count() }).from(venues).where(and(eq(venues.isActive, true), eq(venues.isVerified, true)));

    return c.json(apiResponse({
        users: { total: Number(userCount?.count ?? 0), recent: Number(recentUserCount?.count ?? 0) },
        venues: { total: Number(venueCount?.count ?? 0), verified: Number(verifiedVenuesCount?.count ?? 0) },
        matches: { total: Number(matchCount?.count ?? 0) },
        bookings: { total: Number(bookingCount?.count ?? 0), recent: Number(recentBookingCount?.count ?? 0) },
    }));
});

// ─── GET /users ─────────────────────────────────
adminRoutes.get('/users', async (c) => {
    const query = paginationSchema.safeParse(c.req.query());
    if (!query.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid query', query.error.issues), 400);
    }

    const { page, limit } = query.data;
    const offset = paginationOffset(page, limit);

    const [rows, [totalResult]] = await Promise.all([
        db.select({
            id: users.id, email: users.email, name: users.name, role: users.role,
            isActive: users.isActive, isSuspended: users.isSuspended, emailVerified: users.emailVerified,
            createdAt: users.createdAt, lastLoginAt: users.lastLoginAt,
        }).from(users).orderBy(desc(users.createdAt)).limit(limit).offset(offset),
        db.select({ count: count() }).from(users),
    ]);

    return c.json(apiResponse(rows, paginationMeta(page, limit, Number(totalResult?.count ?? 0))));
});

// ─── PATCH /users/:userId ───────────────────────
adminRoutes.patch('/users/:userId', async (c) => {
    const userId = c.req.param('userId');
    const body = await c.req.json();
    const parsed = adminUpdateUserSchema.safeParse(body);
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return c.json(apiError('NOT_FOUND', 'User not found'), 404);

    // Prevent modifying super admins
    if (user.role === 'SUPER_ADMIN') {
        return c.json(apiError('FORBIDDEN', 'Cannot modify super admin'), 403);
    }

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (parsed.data.role) updates.role = parsed.data.role;
    if (parsed.data.isSuspended !== undefined) {
        updates.isSuspended = parsed.data.isSuspended;
        if (parsed.data.isSuspended) {
            updates.suspensionReason = parsed.data.suspensionReason;
        } else {
            updates.suspensionReason = null;
        }
    }

    await db.update(users).set(updates).where(eq(users.id, userId));

    const admin = c.get('user');
    await db.insert(auditLogs).values({
        userId: admin.id,
        action: 'ADMIN_ACTION',
        entityType: 'User',
        entityId: userId,
        metadata: { updates: parsed.data },
    });

    return c.json(apiResponse({ message: 'User updated' }));
});

// ─── GET /venues ────────────────────────────────
adminRoutes.get('/venues', async (c) => {
    const query = paginationSchema.safeParse(c.req.query());
    if (!query.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid query', query.error.issues), 400);
    }

    const { page, limit } = query.data;
    const offset = paginationOffset(page, limit);

    const [rows, [totalResult]] = await Promise.all([
        db.select().from(venues).orderBy(desc(venues.createdAt)).limit(limit).offset(offset),
        db.select({ count: count() }).from(venues),
    ]);

    return c.json(apiResponse(rows, paginationMeta(page, limit, Number(totalResult?.count ?? 0))));
});

// ─── PATCH /venues/:venueId ─────────────────────
adminRoutes.patch('/venues/:venueId', async (c) => {
    const venueId = c.req.param('venueId');
    const body = await c.req.json();
    const parsed = adminUpdateVenueSchema.safeParse(body);
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);

    const [venue] = await db.select().from(venues).where(eq(venues.id, venueId)).limit(1);
    if (!venue) return c.json(apiError('NOT_FOUND', 'Venue not found'), 404);

    await db.update(venues).set({ ...parsed.data, updatedAt: new Date() }).where(eq(venues.id, venueId));

    const admin = c.get('user');
    const action = parsed.data.isVerified ? 'VENUE_VERIFIED' : 'ADMIN_ACTION';
    await db.insert(auditLogs).values({
        userId: admin.id,
        action,
        entityType: 'Venue',
        entityId: venueId,
        metadata: { updates: parsed.data },
    });

    return c.json(apiResponse({ message: 'Venue updated' }));
});

// ─── PUT /venues/:id/verify ─────────────────────
async function verifyVenueHandler(c: any) {
    const venueId = c.req.param('venueId') || c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const isVerified = typeof body.isVerified === 'boolean' ? body.isVerified : true;

    const [venue] = await db.select().from(venues).where(eq(venues.id, venueId)).limit(1);
    if (!venue) return c.json(apiError('NOT_FOUND', 'Venue not found'), 404);

    await db.update(venues).set({ isVerified, updatedAt: new Date() }).where(eq(venues.id, venueId));

    const admin = c.get('user');
    await db.insert(auditLogs).values({
        userId: admin.id,
        action: isVerified ? 'VENUE_VERIFIED' : 'ADMIN_ACTION',
        entityType: 'Venue',
        entityId: venueId,
        metadata: { isVerified },
    });

    return c.json(apiResponse({ message: isVerified ? 'Venue verified' : 'Venue unverified', isVerified }));
}

adminRoutes.put('/venues/:venueId/verify', verifyVenueHandler);
adminRoutes.put('/venues/:id/verify', verifyVenueHandler);

// ─── GET /audit-logs ────────────────────────────
adminRoutes.get('/audit-logs', async (c) => {
    const query = paginationSchema.safeParse(c.req.query());
    if (!query.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid query', query.error.issues), 400);
    }

    const { page, limit } = query.data;
    const offset = paginationOffset(page, limit);

    const rows = await db.select({
        log: auditLogs,
        userName: users.name,
        userEmail: users.email,
    })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset);

    const [totalResult] = await db.select({ count: count() }).from(auditLogs);

    return c.json(apiResponse(
        rows.map(r => ({ ...r.log, userName: r.userName, userEmail: r.userEmail })),
        paginationMeta(page, limit, Number(totalResult?.count ?? 0)),
    ));
});

// ─── GET /sync-history ──────────────────────────
adminRoutes.get('/sync-history', async (c) => {
    const rows = await db.select({
        sync: syncHistory,
        leagueName: leagues.name,
    })
        .from(syncHistory)
        .leftJoin(leagues, eq(syncHistory.leagueId, leagues.id))
        .orderBy(desc(syncHistory.createdAt))
        .limit(50);

    return c.json(apiResponse(rows.map(r => ({ ...r.sync, leagueName: r.leagueName }))));
});

// ─── POST /sync-matches ─────────────────────────
adminRoutes.post('/sync-matches', async (c) => {
    const admin = c.get('user');

    const result = await triggerManualSync();

    await db.insert(auditLogs).values({
        userId: admin.id,
        action: 'MATCH_SYNCED',
        metadata: { triggeredManually: true, jobId: result.jobId },
    });

    return c.json(apiResponse(result));
});

// ─── POST /seed ─────────────────────────────────
adminRoutes.post('/seed', async (c) => {
    await seedDatabase();
    return c.json(apiResponse({ message: 'Seed completed' }));
});

// ─── POST /seed-leagues ─────────────────────────
adminRoutes.post('/seed-leagues', async (c) => {
    const inserted = await ensureLeaguesSeeded();
    return c.json(apiResponse({ message: 'Leagues seeded', inserted: inserted.length }));
});

export default adminRoutes;
