import { Hono } from 'hono';
import { z } from 'zod';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import os from 'os';
import { execSync } from 'child_process';
import { timingSafeEqual } from 'crypto';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { and, count, desc, eq, gte, ilike, or, sql } from 'drizzle-orm';
import { db } from '../db/client';
import {
    bookings,
    leagues,
    matches,
    menuCategories,
    users,
    venueCustomEvents,
    venueEvents,
    venues,
} from '../db/schema';
import { apiError, apiResponse, generateUniqueSlug, paginationMeta, paginationOffset } from '../lib/utils';
import { hashPassword } from '../lib/auth';
import { authRateLimit } from '../middleware';

declare module 'hono' {
    interface ContextVariableMap {
        superAdmin: {
            username: string;
        };
    }
}

const superAdminRoutes = new Hono();

const SESSION_COOKIE_NAME = 'mw_super_admin';
const SESSION_ISSUER = 'matchwatch-super-admin';
const SESSION_TTL_SECONDS = 8 * 60 * 60;

const paginationQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    search: z.string().trim().optional(),
});

const superAdminLoginSchema = z.object({
    username: z.string().trim().min(3).max(120),
    password: z.string().min(8).max(200),
});

const createUserSchema = z.object({
    email: z.string().email(),
    name: z.string().min(2).max(100),
    password: z.string().min(10).max(200),
    role: z.enum(['USER', 'VENUE_OWNER', 'ADMIN', 'SUPER_ADMIN']).default('USER'),
});

const updateUserSchema = z.object({
    email: z.string().email().optional(),
    name: z.string().min(2).max(100).optional(),
    role: z.enum(['USER', 'VENUE_OWNER', 'ADMIN', 'SUPER_ADMIN']).optional(),
    isActive: z.boolean().optional(),
    isSuspended: z.boolean().optional(),
    password: z.string().min(10).max(200).optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });

const createVenueSchema = z.object({
    ownerEmail: z.string().email(),
    name: z.string().min(2).max(150),
    description: z.string().max(5000).optional(),
    addressLine1: z.string().min(3).max(255),
    city: z.string().min(2).max(100),
    country: z.string().min(2).max(100),
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    timezone: z.string().default('America/Chicago'),
    phone: z.string().max(30).optional(),
    coverImageUrl: z.string().url().optional(),
    priceRange: z.enum(['BUDGET', 'MID', 'UPSCALE', 'LUXURY']).default('MID'),
    capacity: z.coerce.number().int().positive().optional(),
});

const updateVenueSchema = z.object({
    name: z.string().min(2).max(150).optional(),
    description: z.string().max(5000).nullable().optional(),
    shortDescription: z.string().max(280).nullable().optional(),
    addressLine1: z.string().min(3).max(255).optional(),
    city: z.string().min(2).max(100).optional(),
    country: z.string().min(2).max(100).optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    timezone: z.string().min(3).max(50).optional(),
    phone: z.string().max(30).nullable().optional(),
    coverImageUrl: z.string().url().nullable().optional(),
    coverImageS3Key: z.string().nullable().optional(),
    galleryImageUrls: z.array(z.string().url()).max(5).optional(),
    galleryS3Keys: z.array(z.string()).max(5).optional(),
    isVerified: z.boolean().optional(),
    isActive: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    priceRange: z.enum(['BUDGET', 'MID', 'UPSCALE', 'LUXURY']).optional(),
    capacity: z.coerce.number().int().positive().nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });

const createMatchEventSchema = z.object({
    venueId: z.string().uuid(),
    matchId: z.string().uuid(),
    bookingLimit: z.coerce.number().int().positive().optional(),
    specialNotes: z.string().max(2000).optional(),
    customPrice: z.coerce.number().nonnegative().optional(),
    currency: z.string().length(3).default('USD'),
    doorsOpenAt: z.string().datetime().optional(),
    requiresApproval: z.boolean().default(false),
});

const updateMatchEventSchema = z.object({
    isActive: z.boolean().optional(),
    bookingLimit: z.coerce.number().int().positive().nullable().optional(),
    specialNotes: z.string().max(2000).nullable().optional(),
    customPrice: z.coerce.number().nonnegative().nullable().optional(),
    currency: z.string().length(3).optional(),
    doorsOpenAt: z.string().datetime().nullable().optional(),
    requiresApproval: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });

const createCustomEventSchema = z.object({
    venueId: z.string().uuid(),
    title: z.string().min(3).max(160),
    description: z.string().max(5000).optional(),
    eventTypeTags: z.array(z.string().max(50)).max(12).default([]),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    imageUrl: z.string().url().optional(),
    imageS3Key: z.string().optional(),
    bookingNotes: z.string().max(2000).optional(),
});

const updateCustomEventSchema = z.object({
    title: z.string().min(3).max(160).optional(),
    description: z.string().max(5000).nullable().optional(),
    eventTypeTags: z.array(z.string().max(50)).max(12).optional(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    imageUrl: z.string().url().nullable().optional(),
    imageS3Key: z.string().nullable().optional(),
    bookingNotes: z.string().max(2000).nullable().optional(),
    isActive: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });

const createMatchSchema = z.object({
    leagueId: z.string().uuid().nullable().optional(),
    homeTeamId: z.string().uuid().nullable().optional(),
    awayTeamId: z.string().uuid().nullable().optional(),
    homeTeamName: z.string().min(2).max(150),
    awayTeamName: z.string().min(2).max(150),
    homeTeamCrestUrl: z.string().url().nullable().optional(),
    awayTeamCrestUrl: z.string().url().nullable().optional(),
    matchDateUtc: z.string().datetime(),
    status: z.enum(['SCHEDULED', 'TIMED', 'IN_PLAY', 'PAUSED', 'FINISHED', 'POSTPONED', 'CANCELLED', 'SUSPENDED']).default('SCHEDULED'),
    matchDay: z.coerce.number().int().nullable().optional(),
    stage: z.string().max(50).nullable().optional(),
    venueName: z.string().max(200).nullable().optional(),
    externalMatchId: z.string().max(50).optional(),
});

const updateMatchSchema = z.object({
    leagueId: z.string().uuid().nullable().optional(),
    homeTeamId: z.string().uuid().nullable().optional(),
    awayTeamId: z.string().uuid().nullable().optional(),
    homeTeamName: z.string().min(2).max(150).optional(),
    awayTeamName: z.string().min(2).max(150).optional(),
    homeTeamCrestUrl: z.string().url().nullable().optional(),
    awayTeamCrestUrl: z.string().url().nullable().optional(),
    matchDateUtc: z.string().datetime().optional(),
    status: z.enum(['SCHEDULED', 'TIMED', 'IN_PLAY', 'PAUSED', 'FINISHED', 'POSTPONED', 'CANCELLED', 'SUSPENDED']).optional(),
    matchDay: z.coerce.number().int().nullable().optional(),
    stage: z.string().max(50).nullable().optional(),
    venueName: z.string().max(200).nullable().optional(),
    externalMatchId: z.string().max(50).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });

function galleryImageUrlsFromMetadata(metadata: unknown): string[] {
    if (!metadata || typeof metadata !== 'object') return [];
    const raw = (metadata as Record<string, unknown>).galleryImageUrls;
    if (!Array.isArray(raw)) return [];
    return raw
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean);
}

function getSuperAdminUsername(): string | null {
    const username = process.env.SUPER_ADMIN_USERNAME?.trim();
    return username || null;
}

function getSuperAdminPasswordRaw(): string | null {
    const password = process.env.SUPER_ADMIN_PASSWORD?.trim();
    return password || null;
}

function getSuperAdminPasswordHash(): string | null {
    const passwordHash = process.env.SUPER_ADMIN_PASSWORD_HASH?.trim();
    return passwordHash || null;
}

function getSessionSecret(): Uint8Array | null {
    const secret = process.env.SUPER_ADMIN_SESSION_SECRET?.trim();
    if (!secret) return null;
    return new TextEncoder().encode(secret);
}

function safeCompare(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    if (leftBuffer.length !== rightBuffer.length) return false;
    return timingSafeEqual(leftBuffer, rightBuffer);
}

async function verifySuperAdminPassword(inputPassword: string): Promise<boolean> {
    const passwordHash = getSuperAdminPasswordHash();
    if (passwordHash) {
        return bcrypt.compare(inputPassword, passwordHash);
    }

    const rawPassword = getSuperAdminPasswordRaw();
    if (!rawPassword) return false;
    return safeCompare(inputPassword, rawPassword);
}

async function signSessionToken(username: string): Promise<string> {
    const secret = getSessionSecret();
    if (!secret) throw new Error('SUPER_ADMIN_SESSION_SECRET is not configured');
    return new SignJWT({
        username,
        scope: 'super_admin',
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(username)
        .setIssuedAt()
        .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
        .setIssuer(SESSION_ISSUER)
        .sign(secret);
}

async function verifySessionToken(token: string): Promise<{ username: string } | null> {
    const secret = getSessionSecret();
    if (!secret) return null;
    try {
        const { payload } = await jwtVerify(token, secret, { issuer: SESSION_ISSUER });
        if (payload.scope !== 'super_admin') return null;
        const username = String(payload.username || payload.sub || '').trim();
        if (!username) return null;
        return { username };
    } catch {
        return null;
    }
}

async function getSuperAdminSession(c: any): Promise<{ username: string } | null> {
    const token = getCookie(c, SESSION_COOKIE_NAME);
    if (!token) return null;
    return verifySessionToken(token);
}

async function superAdminAuthMiddleware(c: any, next: any) {
    const session = await getSuperAdminSession(c);
    if (!session) {
        return c.json(apiError('UNAUTHORIZED', 'Super admin authentication required'), 401);
    }
    c.set('superAdmin', session);
    await next();
}

superAdminRoutes.post('/login', authRateLimit, async (c) => {
    const configuredUsername = getSuperAdminUsername();
    const hasPasswordConfig = Boolean(getSuperAdminPasswordHash() || getSuperAdminPasswordRaw());
    const hasSecretConfig = Boolean(getSessionSecret());

    if (!configuredUsername || !hasPasswordConfig || !hasSecretConfig) {
        return c.json(
            apiError(
                'SUPER_ADMIN_MISCONFIGURED',
                'Super admin credentials are not configured. Set SUPER_ADMIN_USERNAME, SUPER_ADMIN_PASSWORD (or SUPER_ADMIN_PASSWORD_HASH), and SUPER_ADMIN_SESSION_SECRET.',
            ),
            500,
        );
    }

    const body = await c.req.json().catch(() => ({}));
    const parsed = superAdminLoginSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid credentials payload', parsed.error.issues), 400);
    }

    const inputUsername = parsed.data.username.trim();
    const usernameMatches = safeCompare(inputUsername, configuredUsername);
    const passwordMatches = await verifySuperAdminPassword(parsed.data.password);

    if (!usernameMatches || !passwordMatches) {
        return c.json(apiError('UNAUTHORIZED', 'Invalid super admin username or password'), 401);
    }

    const sessionToken = await signSessionToken(configuredUsername);
    setCookie(c, SESSION_COOKIE_NAME, sessionToken, {
        path: '/api/v1/super-admin',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        maxAge: SESSION_TTL_SECONDS,
    });

    return c.json(apiResponse({
        username: configuredUsername,
        expiresIn: SESSION_TTL_SECONDS,
    }));
});

superAdminRoutes.post('/logout', async (c) => {
    deleteCookie(c, SESSION_COOKIE_NAME, {
        path: '/api/v1/super-admin',
    });
    return c.json(apiResponse({ message: 'Logged out' }));
});

superAdminRoutes.get('/session', async (c) => {
    const session = await getSuperAdminSession(c);
    if (!session) {
        return c.json(apiError('UNAUTHORIZED', 'Session not found'), 401);
    }
    return c.json(apiResponse({
        authenticated: true,
        username: session.username,
    }));
});

superAdminRoutes.use('*', superAdminAuthMiddleware);

superAdminRoutes.get('/stats', async (c) => {
    const now = new Date();
    const [totalUsersResult] = await db.select({ count: count() }).from(users);
    const [activeUsersResult] = await db.select({ count: count() }).from(users).where(eq(users.isActive, true));
    const [totalVenuesResult] = await db.select({ count: count() }).from(venues);
    const [activeVenuesResult] = await db.select({ count: count() }).from(venues).where(eq(venues.isActive, true));
    const [totalMatchesResult] = await db.select({ count: count() }).from(matches);
    const [totalBookingsResult] = await db.select({ count: count() }).from(bookings);

    const [upcomingMatchEventsResult] = await db
        .select({ count: count() })
        .from(venueEvents)
        .innerJoin(matches, eq(venueEvents.matchId, matches.id))
        .where(and(
            eq(venueEvents.isActive, true),
            gte(matches.matchDateUtc, now),
            sql`${matches.status} IN ('SCHEDULED', 'TIMED')`,
        ));

    const [ongoingMatchEventsResult] = await db
        .select({ count: count() })
        .from(venueEvents)
        .innerJoin(matches, eq(venueEvents.matchId, matches.id))
        .where(and(
            eq(venueEvents.isActive, true),
            sql`${matches.status} IN ('IN_PLAY', 'PAUSED')`,
        ));

    const [upcomingCustomEventsResult] = await db
        .select({ count: count() })
        .from(venueCustomEvents)
        .where(and(eq(venueCustomEvents.isActive, true), gte(venueCustomEvents.startsAt, now)));

    const [ongoingCustomEventsResult] = await db
        .select({ count: count() })
        .from(venueCustomEvents)
        .where(and(
            eq(venueCustomEvents.isActive, true),
            sql`${venueCustomEvents.startsAt} <= ${now} AND ${venueCustomEvents.endsAt} >= ${now}`,
        ));

    return c.json(apiResponse({
        users: {
            total: Number(totalUsersResult?.count || 0),
            active: Number(activeUsersResult?.count || 0),
        },
        venues: {
            total: Number(totalVenuesResult?.count || 0),
            active: Number(activeVenuesResult?.count || 0),
        },
        matches: {
            total: Number(totalMatchesResult?.count || 0),
        },
        bookings: {
            total: Number(totalBookingsResult?.count || 0),
        },
        events: {
            upcoming: Number(upcomingMatchEventsResult?.count || 0) + Number(upcomingCustomEventsResult?.count || 0),
            ongoing: Number(ongoingMatchEventsResult?.count || 0) + Number(ongoingCustomEventsResult?.count || 0),
            upcomingMatchEvents: Number(upcomingMatchEventsResult?.count || 0),
            upcomingCustomEvents: Number(upcomingCustomEventsResult?.count || 0),
        },
    }));
});

superAdminRoutes.get('/system', async (c) => {
    const totalMemoryBytes = os.totalmem();
    const freeMemoryBytes = os.freemem();
    const usedMemoryBytes = totalMemoryBytes - freeMemoryBytes;
    const toGb = (bytes: number) => Number((bytes / (1024 ** 3)).toFixed(2));

    let disk = {
        totalGb: null as number | null,
        usedGb: null as number | null,
        freeGb: null as number | null,
        usedPercent: null as number | null,
    };
    try {
        const raw = execSync("df -k / | tail -1 | awk '{print $2\" \"$3\" \"$4\" \"$5}'", { encoding: 'utf8' }).trim();
        const [totalKb, usedKb, freeKb, usedPercentRaw] = raw.split(/\s+/);
        disk = {
            totalGb: Number((Number(totalKb) / 1024 / 1024).toFixed(2)),
            usedGb: Number((Number(usedKb) / 1024 / 1024).toFixed(2)),
            freeGb: Number((Number(freeKb) / 1024 / 1024).toFixed(2)),
            usedPercent: Number(String(usedPercentRaw || '0').replace('%', '')),
        };
    } catch {
        // Best effort only
    }

    let dbStatus: { ok: boolean; error?: string } = { ok: true };
    try {
        await db.execute(sql`select 1`);
    } catch (err) {
        dbStatus = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }

    const region = process.env.AWS_REGION || 'us-east-1';
    const bucket = process.env.S3_BUCKET || '';
    const hasAccessKey = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
    const hasCdnUrl = Boolean(process.env.CDN_URL);
    let bucketAccess = {
        configured: Boolean(bucket),
        reachable: false,
        error: '' as string | null,
    };

    if (bucket) {
        try {
            const s3 = new S3Client({
                region,
                ...(process.env.AWS_ACCESS_KEY_ID ? {
                    credentials: {
                        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
                    },
                } : {}),
            });
            await s3.send(new HeadBucketCommand({ Bucket: bucket }));
            bucketAccess = { configured: true, reachable: true, error: null };
        } catch (err) {
            bucketAccess = {
                configured: true,
                reachable: false,
                error: err instanceof Error ? err.message : String(err),
            };
        }
    }

    return c.json(apiResponse({
        node: process.version,
        platform: process.platform,
        uptimeSeconds: Math.floor(os.uptime()),
        loadAverage: os.loadavg(),
        cpuCores: os.cpus().length,
        memory: {
            totalGb: toGb(totalMemoryBytes),
            usedGb: toGb(usedMemoryBytes),
            freeGb: toGb(freeMemoryBytes),
            usedPercent: Number(((usedMemoryBytes / totalMemoryBytes) * 100).toFixed(2)),
        },
        disk,
        database: dbStatus,
        s3: {
            region,
            bucket,
            hasAccessKey,
            hasCdnUrl,
            ...bucketAccess,
        },
    }));
});

superAdminRoutes.get('/lookups', async (c) => {
    const now = new Date();
    const [venueRows, matchRows, leagueRows] = await Promise.all([
        db.select({
            id: venues.id,
            name: venues.name,
            city: venues.city,
            ownerId: venues.ownerId,
        }).from(venues).where(eq(venues.isActive, true)).orderBy(desc(venues.createdAt)).limit(300),
        db.select({
            id: matches.id,
            homeTeamName: matches.homeTeamName,
            awayTeamName: matches.awayTeamName,
            matchDateUtc: matches.matchDateUtc,
            status: matches.status,
            leagueId: matches.leagueId,
        })
            .from(matches)
            .where(gte(matches.matchDateUtc, now))
            .orderBy(matches.matchDateUtc)
            .limit(500),
        db.select({
            id: leagues.id,
            name: leagues.name,
            shortName: leagues.shortName,
        }).from(leagues).where(eq(leagues.isActive, true)).orderBy(leagues.name),
    ]);

    return c.json(apiResponse({
        venues: venueRows,
        matches: matchRows,
        leagues: leagueRows,
    }));
});

// Users
superAdminRoutes.get('/users', async (c) => {
    const parsed = paginationQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid query', parsed.error.issues), 400);
    }
    const { page, limit, search } = parsed.data;
    const offset = paginationOffset(page, limit);
    const where = search
        ? or(
            ilike(users.email, `%${search}%`),
            ilike(users.name, `%${search}%`),
        )
        : undefined;

    const [rows, [totalResult]] = await Promise.all([
        db.select({
            id: users.id,
            email: users.email,
            name: users.name,
            role: users.role,
            isActive: users.isActive,
            isSuspended: users.isSuspended,
            emailVerified: users.emailVerified,
            createdAt: users.createdAt,
            lastLoginAt: users.lastLoginAt,
            avatarUrl: users.avatarUrl,
        }).from(users).where(where).orderBy(desc(users.createdAt)).limit(limit).offset(offset),
        db.select({ count: count() }).from(users).where(where),
    ]);

    return c.json(apiResponse(rows, paginationMeta(page, limit, Number(totalResult?.count || 0))));
});

superAdminRoutes.post('/users', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const email = parsed.data.email.trim().toLowerCase();
    const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existingUser) {
        return c.json(apiError('CONFLICT', 'User with this email already exists'), 409);
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const [created] = await db.insert(users).values({
        email,
        passwordHash,
        name: parsed.data.name.trim(),
        role: parsed.data.role,
        emailVerified: true,
        isActive: true,
        timezone: 'UTC',
        locale: 'en',
    }).returning({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
    });

    return c.json(apiResponse(created), 201);
});

superAdminRoutes.patch('/users/:userId', async (c) => {
    const userId = c.req.param('userId');
    const body = await c.req.json().catch(() => ({}));
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
    if (!existingUser) {
        return c.json(apiError('NOT_FOUND', 'User not found'), 404);
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.email) updates.email = parsed.data.email.trim().toLowerCase();
    if (parsed.data.name) updates.name = parsed.data.name.trim();
    if (parsed.data.role) updates.role = parsed.data.role;
    if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;
    if (parsed.data.isSuspended !== undefined) updates.isSuspended = parsed.data.isSuspended;
    if (parsed.data.password) {
        updates.passwordHash = await hashPassword(parsed.data.password);
        updates.failedLoginAttempts = 0;
        updates.lockedUntil = null;
    }

    await db.update(users).set(updates).where(eq(users.id, userId));

    return c.json(apiResponse({ message: 'User updated' }));
});

superAdminRoutes.delete('/users/:userId', async (c) => {
    const userId = c.req.param('userId');
    const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
    if (!existingUser) return c.json(apiError('NOT_FOUND', 'User not found'), 404);

    await db.update(users).set({
        isActive: false,
        isSuspended: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
    }).where(eq(users.id, userId));

    return c.json(apiResponse({ message: 'User deactivated' }));
});

// Venues
superAdminRoutes.get('/venues', async (c) => {
    const parsed = paginationQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid query', parsed.error.issues), 400);
    }
    const { page, limit, search } = parsed.data;
    const offset = paginationOffset(page, limit);

    const where = search
        ? or(
            ilike(venues.name, `%${search}%`),
            ilike(venues.city, `%${search}%`),
            ilike(venues.addressLine1, `%${search}%`),
        )
        : undefined;

    const [rows, [totalResult]] = await Promise.all([
        db.select({
            id: venues.id,
            ownerId: venues.ownerId,
            ownerEmail: users.email,
            name: venues.name,
            slug: venues.slug,
            city: venues.city,
            country: venues.country,
            addressLine1: venues.addressLine1,
            lat: venues.lat,
            lng: venues.lng,
            coverImageUrl: venues.coverImageUrl,
            galleryS3Keys: venues.galleryS3Keys,
            metadata: venues.metadata,
            isActive: venues.isActive,
            isVerified: venues.isVerified,
            isFeatured: venues.isFeatured,
            phone: venues.phone,
            createdAt: venues.createdAt,
        })
            .from(venues)
            .leftJoin(users, eq(venues.ownerId, users.id))
            .where(where)
            .orderBy(desc(venues.createdAt))
            .limit(limit)
            .offset(offset),
        db.select({ count: count() }).from(venues).where(where),
    ]);

    const mapped = rows.map((row) => ({
        ...row,
        galleryImageUrls: galleryImageUrlsFromMetadata(row.metadata),
    }));

    return c.json(apiResponse(mapped, paginationMeta(page, limit, Number(totalResult?.count || 0))));
});

superAdminRoutes.post('/venues', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = createVenueSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const ownerEmail = parsed.data.ownerEmail.trim().toLowerCase();
    const [owner] = await db.select({
        id: users.id,
        role: users.role,
    }).from(users).where(eq(users.email, ownerEmail)).limit(1);
    if (!owner) {
        return c.json(apiError('NOT_FOUND', 'Owner user not found'), 404);
    }

    if (owner.role === 'USER') {
        await db.update(users).set({
            role: 'VENUE_OWNER',
            updatedAt: new Date(),
        }).where(eq(users.id, owner.id));
    }

    const [created] = await db.insert(venues).values({
        ownerId: owner.id,
        name: parsed.data.name.trim(),
        slug: generateUniqueSlug(parsed.data.name),
        description: parsed.data.description || null,
        addressLine1: parsed.data.addressLine1.trim(),
        city: parsed.data.city.trim(),
        country: parsed.data.country.trim(),
        lat: String(parsed.data.lat),
        lng: String(parsed.data.lng),
        timezone: parsed.data.timezone.trim(),
        phone: parsed.data.phone?.trim() || null,
        coverImageUrl: parsed.data.coverImageUrl || null,
        priceRange: parsed.data.priceRange,
        capacity: parsed.data.capacity || null,
        isActive: true,
    }).returning({
        id: venues.id,
        slug: venues.slug,
        name: venues.name,
    });

    return c.json(apiResponse(created), 201);
});

superAdminRoutes.patch('/venues/:venueId', async (c) => {
    const venueId = c.req.param('venueId');
    const body = await c.req.json().catch(() => ({}));
    const parsed = updateVenueSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const [existingVenue] = await db.select({
        id: venues.id,
        metadata: venues.metadata,
    }).from(venues).where(eq(venues.id, venueId)).limit(1);
    if (!existingVenue) return c.json(apiError('NOT_FOUND', 'Venue not found'), 404);

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const [key, value] of Object.entries(parsed.data)) {
        if (value === undefined) continue;
        if (key === 'lat' || key === 'lng') {
            updates[key] = String(value);
        } else {
            updates[key] = value;
        }
    }
    if (parsed.data.galleryS3Keys !== undefined) {
        updates.galleryS3Keys = parsed.data.galleryS3Keys.slice(0, 5);
    }
    if (parsed.data.galleryImageUrls !== undefined) {
        const currentMetadata = (existingVenue.metadata || {}) as Record<string, unknown>;
        updates.metadata = {
            ...currentMetadata,
            galleryImageUrls: parsed.data.galleryImageUrls.slice(0, 5),
        };
    }

    await db.update(venues).set(updates).where(eq(venues.id, venueId));
    return c.json(apiResponse({ message: 'Venue updated' }));
});

superAdminRoutes.delete('/venues/:venueId', async (c) => {
    const venueId = c.req.param('venueId');
    const [existingVenue] = await db.select({ id: venues.id }).from(venues).where(eq(venues.id, venueId)).limit(1);
    if (!existingVenue) return c.json(apiError('NOT_FOUND', 'Venue not found'), 404);

    await db.transaction(async (tx) => {
        await tx.update(venueEvents).set({
            isActive: false,
            updatedAt: new Date(),
        }).where(eq(venueEvents.venueId, venueId));

        await tx.update(venueCustomEvents).set({
            isActive: false,
            updatedAt: new Date(),
        }).where(eq(venueCustomEvents.venueId, venueId));

        await tx.update(menuCategories).set({
            isActive: false,
        }).where(eq(menuCategories.venueId, venueId));

        await tx.update(venues).set({
            isActive: false,
            deletedAt: new Date(),
            updatedAt: new Date(),
        }).where(eq(venues.id, venueId));
    });

    return c.json(apiResponse({ message: 'Venue archived' }));
});

// Match events
superAdminRoutes.get('/events', async (c) => {
    const parsed = paginationQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid query', parsed.error.issues), 400);
    }
    const { page, limit, search } = parsed.data;
    const offset = paginationOffset(page, limit);

    const where = search
        ? or(
            ilike(venues.name, `%${search}%`),
            ilike(matches.homeTeamName, `%${search}%`),
            ilike(matches.awayTeamName, `%${search}%`),
        )
        : undefined;

    const [rows, [totalResult]] = await Promise.all([
        db.select({
            id: venueEvents.id,
            venueId: venueEvents.venueId,
            matchId: venueEvents.matchId,
            isActive: venueEvents.isActive,
            bookingLimit: venueEvents.bookingLimit,
            confirmedBookingsCount: venueEvents.confirmedBookingsCount,
            specialNotes: venueEvents.specialNotes,
            customPrice: venueEvents.customPrice,
            currency: venueEvents.currency,
            doorsOpenAt: venueEvents.doorsOpenAt,
            requiresApproval: venueEvents.requiresApproval,
            createdAt: venueEvents.createdAt,
            venueName: venues.name,
            homeTeamName: matches.homeTeamName,
            awayTeamName: matches.awayTeamName,
            matchDateUtc: matches.matchDateUtc,
        })
            .from(venueEvents)
            .innerJoin(venues, eq(venueEvents.venueId, venues.id))
            .innerJoin(matches, eq(venueEvents.matchId, matches.id))
            .where(where)
            .orderBy(desc(venueEvents.createdAt))
            .limit(limit)
            .offset(offset),
        db.select({ count: count() })
            .from(venueEvents)
            .innerJoin(venues, eq(venueEvents.venueId, venues.id))
            .innerJoin(matches, eq(venueEvents.matchId, matches.id))
            .where(where),
    ]);

    return c.json(apiResponse(rows, paginationMeta(page, limit, Number(totalResult?.count || 0))));
});

superAdminRoutes.post('/events', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = createMatchEventSchema.safeParse(body);
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);

    const [existingVenue] = await db.select({ id: venues.id }).from(venues).where(eq(venues.id, parsed.data.venueId)).limit(1);
    if (!existingVenue) return c.json(apiError('NOT_FOUND', 'Venue not found'), 404);

    const [existingMatch] = await db.select({ id: matches.id }).from(matches).where(eq(matches.id, parsed.data.matchId)).limit(1);
    if (!existingMatch) return c.json(apiError('NOT_FOUND', 'Match not found'), 404);

    const [duplicate] = await db.select({ id: venueEvents.id }).from(venueEvents).where(and(
        eq(venueEvents.venueId, parsed.data.venueId),
        eq(venueEvents.matchId, parsed.data.matchId),
    )).limit(1);

    if (duplicate) {
        return c.json(apiError('CONFLICT', 'Event already exists for this venue and match'), 409);
    }

    const [created] = await db.insert(venueEvents).values({
        venueId: parsed.data.venueId,
        matchId: parsed.data.matchId,
        bookingLimit: parsed.data.bookingLimit || null,
        specialNotes: parsed.data.specialNotes || null,
        customPrice: parsed.data.customPrice != null ? String(parsed.data.customPrice) : null,
        currency: parsed.data.currency,
        doorsOpenAt: parsed.data.doorsOpenAt ? new Date(parsed.data.doorsOpenAt) : null,
        requiresApproval: parsed.data.requiresApproval,
    }).returning({
        id: venueEvents.id,
        venueId: venueEvents.venueId,
        matchId: venueEvents.matchId,
    });

    return c.json(apiResponse(created), 201);
});

superAdminRoutes.patch('/events/:eventId', async (c) => {
    const eventId = c.req.param('eventId');
    const body = await c.req.json().catch(() => ({}));
    const parsed = updateMatchEventSchema.safeParse(body);
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);

    const [existingEvent] = await db.select({ id: venueEvents.id }).from(venueEvents).where(eq(venueEvents.id, eventId)).limit(1);
    if (!existingEvent) return c.json(apiError('NOT_FOUND', 'Event not found'), 404);

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;
    if (parsed.data.bookingLimit !== undefined) updates.bookingLimit = parsed.data.bookingLimit;
    if (parsed.data.specialNotes !== undefined) updates.specialNotes = parsed.data.specialNotes;
    if (parsed.data.customPrice !== undefined) updates.customPrice = parsed.data.customPrice != null ? String(parsed.data.customPrice) : null;
    if (parsed.data.currency !== undefined) updates.currency = parsed.data.currency;
    if (parsed.data.doorsOpenAt !== undefined) updates.doorsOpenAt = parsed.data.doorsOpenAt ? new Date(parsed.data.doorsOpenAt) : null;
    if (parsed.data.requiresApproval !== undefined) updates.requiresApproval = parsed.data.requiresApproval;

    await db.update(venueEvents).set(updates).where(eq(venueEvents.id, eventId));
    return c.json(apiResponse({ message: 'Event updated' }));
});

superAdminRoutes.delete('/events/:eventId', async (c) => {
    const eventId = c.req.param('eventId');
    const [existingEvent] = await db.select({ id: venueEvents.id }).from(venueEvents).where(eq(venueEvents.id, eventId)).limit(1);
    if (!existingEvent) return c.json(apiError('NOT_FOUND', 'Event not found'), 404);

    await db.update(venueEvents).set({
        isActive: false,
        updatedAt: new Date(),
    }).where(eq(venueEvents.id, eventId));

    return c.json(apiResponse({ message: 'Event archived' }));
});

// Custom events
superAdminRoutes.get('/custom-events', async (c) => {
    const parsed = paginationQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid query', parsed.error.issues), 400);
    }
    const { page, limit, search } = parsed.data;
    const offset = paginationOffset(page, limit);
    const where = search
        ? or(
            ilike(venueCustomEvents.title, `%${search}%`),
            ilike(venues.name, `%${search}%`),
        )
        : undefined;

    const [rows, [totalResult]] = await Promise.all([
        db.select({
            id: venueCustomEvents.id,
            venueId: venueCustomEvents.venueId,
            title: venueCustomEvents.title,
            description: venueCustomEvents.description,
            eventTypeTags: venueCustomEvents.eventTypeTags,
            startsAt: venueCustomEvents.startsAt,
            endsAt: venueCustomEvents.endsAt,
            imageUrl: venueCustomEvents.imageUrl,
            imageS3Key: venueCustomEvents.imageS3Key,
            bookingNotes: venueCustomEvents.bookingNotes,
            isActive: venueCustomEvents.isActive,
            venueName: venues.name,
            createdAt: venueCustomEvents.createdAt,
        })
            .from(venueCustomEvents)
            .innerJoin(venues, eq(venueCustomEvents.venueId, venues.id))
            .where(where)
            .orderBy(desc(venueCustomEvents.createdAt))
            .limit(limit)
            .offset(offset),
        db.select({ count: count() })
            .from(venueCustomEvents)
            .innerJoin(venues, eq(venueCustomEvents.venueId, venues.id))
            .where(where),
    ]);

    return c.json(apiResponse(rows, paginationMeta(page, limit, Number(totalResult?.count || 0))));
});

superAdminRoutes.post('/custom-events', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = createCustomEventSchema.safeParse(body);
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);

    if (new Date(parsed.data.endsAt).getTime() <= new Date(parsed.data.startsAt).getTime()) {
        return c.json(apiError('VALIDATION_ERROR', 'endsAt must be after startsAt'), 400);
    }

    const [existingVenue] = await db.select({ id: venues.id }).from(venues).where(eq(venues.id, parsed.data.venueId)).limit(1);
    if (!existingVenue) return c.json(apiError('NOT_FOUND', 'Venue not found'), 404);

    const [created] = await db.insert(venueCustomEvents).values({
        venueId: parsed.data.venueId,
        title: parsed.data.title.trim(),
        description: parsed.data.description || null,
        eventTypeTags: parsed.data.eventTypeTags,
        startsAt: new Date(parsed.data.startsAt),
        endsAt: new Date(parsed.data.endsAt),
        imageUrl: parsed.data.imageUrl || null,
        imageS3Key: parsed.data.imageS3Key || null,
        bookingNotes: parsed.data.bookingNotes || null,
        isActive: true,
    }).returning({
        id: venueCustomEvents.id,
        title: venueCustomEvents.title,
    });

    return c.json(apiResponse(created), 201);
});

superAdminRoutes.patch('/custom-events/:eventId', async (c) => {
    const eventId = c.req.param('eventId');
    const body = await c.req.json().catch(() => ({}));
    const parsed = updateCustomEventSchema.safeParse(body);
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);

    const [existingEvent] = await db.select({ id: venueCustomEvents.id }).from(venueCustomEvents).where(eq(venueCustomEvents.id, eventId)).limit(1);
    if (!existingEvent) return c.json(apiError('NOT_FOUND', 'Custom event not found'), 404);

    if (parsed.data.startsAt && parsed.data.endsAt) {
        if (new Date(parsed.data.endsAt).getTime() <= new Date(parsed.data.startsAt).getTime()) {
            return c.json(apiError('VALIDATION_ERROR', 'endsAt must be after startsAt'), 400);
        }
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.title !== undefined) updates.title = parsed.data.title;
    if (parsed.data.description !== undefined) updates.description = parsed.data.description;
    if (parsed.data.eventTypeTags !== undefined) updates.eventTypeTags = parsed.data.eventTypeTags;
    if (parsed.data.startsAt !== undefined) updates.startsAt = new Date(parsed.data.startsAt);
    if (parsed.data.endsAt !== undefined) updates.endsAt = new Date(parsed.data.endsAt);
    if (parsed.data.imageUrl !== undefined) updates.imageUrl = parsed.data.imageUrl;
    if (parsed.data.imageS3Key !== undefined) updates.imageS3Key = parsed.data.imageS3Key;
    if (parsed.data.bookingNotes !== undefined) updates.bookingNotes = parsed.data.bookingNotes;
    if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

    await db.update(venueCustomEvents).set(updates).where(eq(venueCustomEvents.id, eventId));
    return c.json(apiResponse({ message: 'Custom event updated' }));
});

superAdminRoutes.delete('/custom-events/:eventId', async (c) => {
    const eventId = c.req.param('eventId');
    const [existingEvent] = await db.select({ id: venueCustomEvents.id }).from(venueCustomEvents).where(eq(venueCustomEvents.id, eventId)).limit(1);
    if (!existingEvent) return c.json(apiError('NOT_FOUND', 'Custom event not found'), 404);

    await db.update(venueCustomEvents).set({
        isActive: false,
        updatedAt: new Date(),
    }).where(eq(venueCustomEvents.id, eventId));

    return c.json(apiResponse({ message: 'Custom event archived' }));
});

// Matches
superAdminRoutes.get('/matches', async (c) => {
    const parsed = paginationQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid query', parsed.error.issues), 400);
    }
    const { page, limit, search } = parsed.data;
    const offset = paginationOffset(page, limit);

    const where = search
        ? or(
            ilike(matches.homeTeamName, `%${search}%`),
            ilike(matches.awayTeamName, `%${search}%`),
            ilike(leagues.name, `%${search}%`),
        )
        : undefined;

    const [rows, [totalResult]] = await Promise.all([
        db.select({
            id: matches.id,
            leagueId: matches.leagueId,
            leagueName: leagues.name,
            homeTeamId: matches.homeTeamId,
            awayTeamId: matches.awayTeamId,
            homeTeamName: matches.homeTeamName,
            awayTeamName: matches.awayTeamName,
            homeTeamCrestUrl: matches.homeTeamCrestUrl,
            awayTeamCrestUrl: matches.awayTeamCrestUrl,
            matchDateUtc: matches.matchDateUtc,
            status: matches.status,
            stage: matches.stage,
            venueName: matches.venueName,
            createdAt: matches.createdAt,
        })
            .from(matches)
            .leftJoin(leagues, eq(matches.leagueId, leagues.id))
            .where(where)
            .orderBy(desc(matches.matchDateUtc))
            .limit(limit)
            .offset(offset),
        db.select({ count: count() })
            .from(matches)
            .leftJoin(leagues, eq(matches.leagueId, leagues.id))
            .where(where),
    ]);

    return c.json(apiResponse(rows, paginationMeta(page, limit, Number(totalResult?.count || 0))));
});

superAdminRoutes.post('/matches', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = createMatchSchema.safeParse(body);
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);

    const [created] = await db.insert(matches).values({
        leagueId: parsed.data.leagueId || null,
        homeTeamId: parsed.data.homeTeamId || null,
        awayTeamId: parsed.data.awayTeamId || null,
        homeTeamName: parsed.data.homeTeamName.trim(),
        awayTeamName: parsed.data.awayTeamName.trim(),
        homeTeamCrestUrl: parsed.data.homeTeamCrestUrl || null,
        awayTeamCrestUrl: parsed.data.awayTeamCrestUrl || null,
        matchDateUtc: new Date(parsed.data.matchDateUtc),
        status: parsed.data.status,
        matchDay: parsed.data.matchDay || null,
        stage: parsed.data.stage || null,
        venueName: parsed.data.venueName || null,
        externalMatchId: parsed.data.externalMatchId || null,
    }).returning({
        id: matches.id,
        homeTeamName: matches.homeTeamName,
        awayTeamName: matches.awayTeamName,
    });

    return c.json(apiResponse(created), 201);
});

superAdminRoutes.patch('/matches/:matchId', async (c) => {
    const matchId = c.req.param('matchId');
    const body = await c.req.json().catch(() => ({}));
    const parsed = updateMatchSchema.safeParse(body);
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);

    const [existingMatch] = await db.select({ id: matches.id }).from(matches).where(eq(matches.id, matchId)).limit(1);
    if (!existingMatch) return c.json(apiError('NOT_FOUND', 'Match not found'), 404);

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const [key, value] of Object.entries(parsed.data)) {
        if (value === undefined) continue;
        if (key === 'matchDateUtc') {
            updates.matchDateUtc = new Date(String(value));
        } else {
            updates[key] = value;
        }
    }

    await db.update(matches).set(updates).where(eq(matches.id, matchId));
    return c.json(apiResponse({ message: 'Match updated' }));
});

superAdminRoutes.delete('/matches/:matchId', async (c) => {
    const matchId = c.req.param('matchId');
    const [existingMatch] = await db.select({ id: matches.id }).from(matches).where(eq(matches.id, matchId)).limit(1);
    if (!existingMatch) return c.json(apiError('NOT_FOUND', 'Match not found'), 404);

    const [linkedEvents] = await db.select({ count: count() }).from(venueEvents).where(eq(venueEvents.matchId, matchId));
    if (Number(linkedEvents?.count || 0) > 0) {
        await db.update(matches).set({
            status: 'CANCELLED',
            updatedAt: new Date(),
        }).where(eq(matches.id, matchId));
        return c.json(apiResponse({
            message: 'Match has linked venue events, so it was marked as CANCELLED instead of hard deleted.',
            mode: 'cancelled',
        }));
    }

    await db.delete(matches).where(eq(matches.id, matchId));
    return c.json(apiResponse({
        message: 'Match deleted',
        mode: 'deleted',
    }));
});

export default superAdminRoutes;
