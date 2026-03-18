import { Hono } from 'hono';
import { db } from '../db/client';
import { users, auditLogs, refreshTokenSessions, venues } from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import {
    hashPassword, verifyPassword, generateAccessToken,
    generateRefreshToken, rotateRefreshToken, revokeSession, revokeAllSessions,
} from '../lib/auth';
import { apiResponse, apiError, generateUniqueSlug } from '../lib/utils';
import { redis } from '../lib/redis';
import { logger } from '../lib/logger';
import {
    registerSchema, registerVenueSchema, loginSchema,
    verifyEmailSchema, forgotPasswordSchema, resetPasswordSchema,
    changePasswordSchema,
} from '@matchwatch/shared';
import { authMiddleware, authRateLimit, type AuthUser } from '../middleware';

const auth = new Hono();
const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_PATH = '/api/v1/auth';
const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

function normalizeEmail(email: string) {
    return email.trim().toLowerCase();
}

function useSecureCookies() {
    if (process.env.COOKIE_SECURE === 'true') return true;
    if (process.env.COOKIE_SECURE === 'false') return false;
    if (process.env.NODE_ENV !== 'production') return false;
    return process.env.APP_URL?.startsWith('https://') ?? false;
}

function buildRefreshCookie(token: string, maxAge = REFRESH_COOKIE_MAX_AGE) {
    const securePart = useSecureCookies() ? '; Secure' : '';
    return `${REFRESH_COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=${REFRESH_COOKIE_PATH}; Max-Age=${maxAge}${securePart}`;
}

function shouldAutoVerifyEmail() {
    if (process.env.AUTO_VERIFY_EMAIL === 'true') return true;
    if (process.env.AUTO_VERIFY_EMAIL === 'false') return false;
    return process.env.NODE_ENV !== 'production';
}

async function compareHash(raw: string, hash: string) {
    const bcryptModule = await import('bcryptjs');
    const compare =
        (bcryptModule as unknown as { compare?: (a: string, b: string) => Promise<boolean> }).compare
        || (bcryptModule as unknown as { default?: { compare?: (a: string, b: string) => Promise<boolean> } }).default?.compare;

    if (!compare) {
        throw new Error('bcryptjs.compare unavailable');
    }

    return compare(raw, hash);
}

// ─── POST /register ─────────────────────────────
auth.post('/register', authRateLimit, async (c) => {
    const body = await c.req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const { email, password, name, timezone, locale, website } = parsed.data;
    const normalizedEmail = normalizeEmail(email);

    // Honeypot check
    if (website) {
        return c.json(apiResponse({ message: 'Verification email sent' }), 201);
    }

    // Check if user already exists
    const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(sql`lower(${users.email}) = ${normalizedEmail}`)
        .limit(1);
    if (existing.length > 0) {
        return c.json(apiError('CONFLICT', 'An account with this email already exists'), 409);
    }

    const passwordHash = await hashPassword(password);
    const verificationToken = uuidv4();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await db.insert(users).values({
        email: normalizedEmail,
        passwordHash,
        name,
        timezone,
        locale,
        emailVerified: shouldAutoVerifyEmail(),
        emailVerificationToken: shouldAutoVerifyEmail() ? null : verificationToken,
        emailVerificationExpiresAt: shouldAutoVerifyEmail() ? null : verificationExpires,
    });

    // Verification email delivery is expected to be handled by background workers.
    logger.info({ email: normalizedEmail }, 'User registered, verification token generated');

    return c.json(apiResponse({ message: 'Verification email sent' }), 201);
});

// ─── POST /register-venue ───────────────────────
auth.post('/register-venue', authRateLimit, async (c) => {
    const body = await c.req.json();
    const parsed = registerVenueSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const { email, password, name, timezone, locale, website, venue } = parsed.data;
    const normalizedEmail = normalizeEmail(email);
    if (website) {
        return c.json(apiResponse({ message: 'Verification email sent' }), 201);
    }

    const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(sql`lower(${users.email}) = ${normalizedEmail}`)
        .limit(1);
    if (existing.length > 0) {
        return c.json(apiError('CONFLICT', 'An account with this email already exists'), 409);
    }

    const passwordHash = await hashPassword(password);
    const verificationToken = uuidv4();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Transaction: create user + venue
    const [newUser] = await db.insert(users).values({
        email: normalizedEmail,
        passwordHash,
        name,
        timezone,
        locale,
        role: 'BUSINESS',
        emailVerified: shouldAutoVerifyEmail(),
        emailVerificationToken: shouldAutoVerifyEmail() ? null : verificationToken,
        emailVerificationExpiresAt: shouldAutoVerifyEmail() ? null : verificationExpires,
    }).returning();

    const slug = generateUniqueSlug(venue.name);

    await db.insert(venues).values({
        ownerId: newUser.id,
        name: venue.name,
        slug,
        addressLine1: venue.address,
        city: venue.city,
        country: venue.country,
        lat: String(venue.lat),
        lng: String(venue.lng),
        timezone: venue.timezone,
        phone: venue.phone,
        description: venue.description,
        amenities: venue.amenities,
        cuisineTags: venue.cuisineTags,
        priceRange: venue.priceRange,
        capacity: venue.capacity,
    });

    logger.info({ email: normalizedEmail, venueName: venue.name }, 'Venue owner registered');
    return c.json(apiResponse({ message: 'Verification email sent' }), 201);
});

// ─── POST /verify-email ─────────────────────────
auth.post('/verify-email', async (c) => {
    const body = await c.req.json();
    const parsed = verifyEmailSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid token'), 400);
    }

    const [user] = await db.select()
        .from(users)
        .where(eq(users.emailVerificationToken, parsed.data.token))
        .limit(1);

    if (!user) {
        return c.json(apiError('NOT_FOUND', 'Invalid or expired verification token'), 404);
    }

    if (user.emailVerificationExpiresAt && new Date() > user.emailVerificationExpiresAt) {
        return c.json(apiError('UNAUTHORIZED', 'Verification token has expired'), 401);
    }

    await db.update(users).set({
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
        updatedAt: new Date(),
    }).where(eq(users.id, user.id));

    return c.json(apiResponse({ message: 'Email verified successfully' }));
});

// ─── POST /login ────────────────────────────────
auth.post('/login', authRateLimit, async (c) => {
    const body = await c.req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const { email, password, deviceName } = parsed.data;
    const normalizedEmail = normalizeEmail(email);

    const [user] = await db
        .select()
        .from(users)
        .where(sql`lower(${users.email}) = ${normalizedEmail}`)
        .limit(1);
    if (!user) {
        return c.json(apiError('UNAUTHORIZED', 'Invalid email or password'), 401);
    }

    // Check if account is locked
    if (user.lockedUntil && new Date() < user.lockedUntil) {
        return c.json(apiError('ACCOUNT_LOCKED', 'Account is temporarily locked. Try again later.'), 423);
    }

    // Check email verification
    if (!user.emailVerified) {
        return c.json(apiError('EMAIL_NOT_VERIFIED', 'Please verify your email before logging in'), 403);
    }

    // Check suspension
    if (user.isSuspended) {
        return c.json(apiError('FORBIDDEN', 'Account has been suspended'), 403);
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
        // Increment failed attempts
        const attempts = user.failedLoginAttempts + 1;
        const updates: Record<string, unknown> = { failedLoginAttempts: attempts };

        if (attempts >= 5) {
            // Lock for 15 minutes
            updates.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        }

        await db.update(users).set(updates).where(eq(users.id, user.id));
        return c.json(apiError('UNAUTHORIZED', 'Invalid email or password'), 401);
    }

    // Reset failed attempts on successful login
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || '';
    await db.update(users).set({
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: ip,
        updatedAt: new Date(),
    }).where(eq(users.id, user.id));

    // Generate tokens
    const accessToken = await generateAccessToken({
        sub: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
    });

    const { token: refreshToken } = await generateRefreshToken(user.id, {
        userAgent: c.req.header('user-agent'),
        ip,
        deviceName,
    });

    // Audit log
    await db.insert(auditLogs).values({
        userId: user.id,
        action: 'USER_LOGIN',
        ipAddress: ip,
        userAgent: c.req.header('user-agent'),
    });

    // Set refresh token as httpOnly cookie
    c.header('Set-Cookie', buildRefreshCookie(refreshToken));

    return c.json(apiResponse({
        accessToken,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            avatarUrl: user.avatarUrl,
            timezone: user.timezone,
        },
    }));
});

// ─── POST /refresh ──────────────────────────────
auth.post('/refresh', async (c) => {
    const cookieHeader = c.req.header('cookie') || '';
    const refreshTokenMatch = cookieHeader.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`));
    if (!refreshTokenMatch) {
        return c.json(apiError('UNAUTHORIZED', 'No refresh token provided'), 401);
    }

    const oldRefreshToken = refreshTokenMatch[1];

    // We need to find which user this token belongs to
    // This requires checking all active sessions (not ideal but necessary with hashed tokens)
    const sessions = await db.select().from(refreshTokenSessions).where(eq(refreshTokenSessions.isRevoked, false));

    let matchedUserId: string | null = null;
    for (const session of sessions) {
        if (await compareHash(oldRefreshToken, session.tokenHash)) {
            matchedUserId = session.userId;
            break;
        }
    }

    if (!matchedUserId) {
        return c.json(apiError('UNAUTHORIZED', 'Invalid refresh token'), 401);
    }

    const result = await rotateRefreshToken(oldRefreshToken, matchedUserId, {
        userAgent: c.req.header('user-agent'),
        ip: c.req.header('x-forwarded-for') || '',
    });

    if (!result) {
        // Clear cookie on theft detection
        c.header('Set-Cookie', buildRefreshCookie('', 0));
        return c.json(apiError('UNAUTHORIZED', 'Token reuse detected, all sessions revoked'), 401);
    }

    c.header('Set-Cookie', buildRefreshCookie(result.refreshToken));

    return c.json(apiResponse({ accessToken: result.accessToken }));
});

// ─── POST /logout ───────────────────────────────
auth.post('/logout', authMiddleware, async (c) => {
    const user = c.get('user');

    // Revoke current session's refresh token
    const cookieHeader = c.req.header('cookie') || '';
    const refreshTokenMatch = cookieHeader.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`));

    if (refreshTokenMatch) {
        const sessions = await db.select().from(refreshTokenSessions).where(
            and(eq(refreshTokenSessions.userId, user.id), eq(refreshTokenSessions.isRevoked, false)),
        );

        for (const session of sessions) {
            if (await compareHash(refreshTokenMatch[1], session.tokenHash)) {
                await revokeSession(session.id);
                break;
            }
        }
    }

    c.header('Set-Cookie', buildRefreshCookie('', 0));

    await db.insert(auditLogs).values({
        userId: user.id,
        action: 'USER_LOGOUT',
    });

    return c.json(apiResponse({ message: 'Logged out successfully' }));
});

// ─── POST /logout-all ───────────────────────────
auth.post('/logout-all', authMiddleware, async (c) => {
    const user = c.get('user');
    await revokeAllSessions(user.id);
    c.header('Set-Cookie', buildRefreshCookie('', 0));
    return c.json(apiResponse({ message: 'All sessions revoked' }));
});

// ─── GET /sessions ──────────────────────────────
auth.get('/sessions', authMiddleware, async (c) => {
    const user = c.get('user');
    const sessions = await db.select({
        id: refreshTokenSessions.id,
        deviceInfo: refreshTokenSessions.deviceInfo,
        lastUsedAt: refreshTokenSessions.lastUsedAt,
        createdAt: refreshTokenSessions.createdAt,
        expiresAt: refreshTokenSessions.expiresAt,
    }).from(refreshTokenSessions).where(
        and(eq(refreshTokenSessions.userId, user.id), eq(refreshTokenSessions.isRevoked, false)),
    );

    return c.json(apiResponse(sessions));
});

// ─── DELETE /sessions/:sessionId ────────────────
auth.delete('/sessions/:sessionId', authMiddleware, async (c) => {
    const sessionId = c.req.param('sessionId');
    const user = c.get('user');

    const [session] = await db.select().from(refreshTokenSessions).where(
        and(eq(refreshTokenSessions.id, sessionId), eq(refreshTokenSessions.userId, user.id)),
    ).limit(1);

    if (!session) {
        return c.json(apiError('NOT_FOUND', 'Session not found'), 404);
    }

    await revokeSession(sessionId);
    return c.json(apiResponse({ message: 'Session revoked' }));
});

// ─── POST /forgot-password ──────────────────────
auth.post('/forgot-password', authRateLimit, async (c) => {
    const body = await c.req.json();
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid email'), 400);
    }

    // Always return same response to prevent user enumeration
    const normalizedEmail = normalizeEmail(parsed.data.email);
    const [user] = await db
        .select()
        .from(users)
        .where(sql`lower(${users.email}) = ${normalizedEmail}`)
        .limit(1);

    if (user) {
        const resetToken = uuidv4();
        // Store in Redis with 1 hour expiry
        await redis.set(`password-reset:${resetToken}`, user.id, 'EX', 3600);
        // Password reset email delivery is expected to be handled by background workers.
        logger.info({ userId: user.id }, 'Password reset requested');
    }

    return c.json(apiResponse({ message: 'If an account with that email exists, a reset link has been sent' }));
});

// ─── POST /reset-password ───────────────────────
auth.post('/reset-password', authRateLimit, async (c) => {
    const body = await c.req.json();
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const userId = await redis.get(`password-reset:${parsed.data.token}`);
    if (!userId) {
        return c.json(apiError('UNAUTHORIZED', 'Invalid or expired reset token'), 401);
    }

    const passwordHash = await hashPassword(parsed.data.password);
    await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));
    await redis.del(`password-reset:${parsed.data.token}`);
    await revokeAllSessions(userId);

    await db.insert(auditLogs).values({ userId, action: 'PASSWORD_RESET' });

    return c.json(apiResponse({ message: 'Password reset successfully. Please log in again.' }));
});

// ─── POST /change-password ──────────────────────
auth.post('/change-password', authMiddleware, async (c) => {
    const user = c.get('user');
    const body = await c.req.json();
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const [dbUser] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    if (!dbUser) {
        return c.json(apiError('NOT_FOUND', 'User not found'), 404);
    }

    const isValid = await verifyPassword(parsed.data.currentPassword, dbUser.passwordHash);
    if (!isValid) {
        return c.json(apiError('UNAUTHORIZED', 'Current password is incorrect'), 401);
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);
    await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, user.id));
    await revokeAllSessions(user.id);

    // Generate new tokens for current session
    const accessToken = await generateAccessToken({
        sub: dbUser.id,
        email: dbUser.email,
        role: dbUser.role,
        name: dbUser.name,
    });

    const { token: refreshToken } = await generateRefreshToken(dbUser.id);
    c.header('Set-Cookie', buildRefreshCookie(refreshToken));

    await db.insert(auditLogs).values({ userId: user.id, action: 'PASSWORD_CHANGED' });

    return c.json(apiResponse({ accessToken, message: 'Password changed. All other sessions revoked.' }));
});

export default auth;
