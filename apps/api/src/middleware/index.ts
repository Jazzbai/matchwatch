import { Context, Next } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { verifyAccessToken } from '../lib/auth';
import { redis } from '../lib/redis';
import { logger } from '../lib/logger';
import { apiError } from '../lib/utils';

// ─── Types ──────────────────────────────────────

export interface AuthUser {
    id: string;
    email: string;
    role: string;
    name: string;
}

// We store auth user on the context variables
declare module 'hono' {
    interface ContextVariableMap {
        user: AuthUser;
        requestId: string;
    }
}

// ─── Request ID Middleware ───────────────────────

export async function requestIdMiddleware(c: Context, next: Next) {
    const requestId = c.req.header('x-request-id') || uuidv4();
    c.set('requestId', requestId);
    c.header('X-Request-ID', requestId);
    await next();
}

// ─── Logger Middleware ───────────────────────────

export async function loggerMiddleware(c: Context, next: Next) {
    const start = Date.now();
    await next();
    const duration = Date.now() - start;
    logger.info({
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        duration: `${duration}ms`,
        requestId: c.get('requestId'),
    });
}

// ─── CORS Middleware ────────────────────────────

export async function corsMiddleware(c: Context, next: Next) {
    const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'];
    const origin = c.req.header('origin');

    if (origin && allowedOrigins.includes(origin)) {
        c.header('Access-Control-Allow-Origin', origin);
    }
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
    c.header('Access-Control-Allow-Credentials', 'true');
    c.header('Access-Control-Max-Age', '86400');

    if (c.req.method === 'OPTIONS') {
        return c.body(null, 204);
    }
    await next();
}

// ─── Security Headers Middleware ────────────────

export async function securityHeadersMiddleware(c: Context, next: Next) {
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('X-XSS-Protection', '0');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    c.header('Content-Security-Policy', "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'");
    await next();
}

// ─── Auth Middleware ────────────────────────────

export async function authMiddleware(c: Context, next: Next) {
    const authHeader = c.req.header('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json(apiError('UNAUTHORIZED', 'Missing or invalid authorization header'), 401);
    }

    const token = authHeader.slice(7);
    try {
        const payload = await verifyAccessToken(token);
        c.set('user', {
            id: payload.sub,
            email: payload.email,
            role: payload.role,
            name: payload.name,
        });
        await next();
    } catch (err) {
        return c.json(apiError('UNAUTHORIZED', 'Invalid or expired token'), 401);
    }
}

// ─── Optional Auth Middleware ────────────────────

export async function optionalAuthMiddleware(c: Context, next: Next) {
    const authHeader = c.req.header('authorization');
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        try {
            const payload = await verifyAccessToken(token);
            c.set('user', {
                id: payload.sub,
                email: payload.email,
                role: payload.role,
                name: payload.name,
            });
        } catch {
            // Token invalid, continue as guest
        }
    }
    await next();
}

// ─── Role Guard Middleware ──────────────────────

export function requireRole(...roles: string[]) {
    return async (c: Context, next: Next) => {
        const user = c.get('user');
        if (!user) {
            return c.json(apiError('UNAUTHORIZED', 'Authentication required'), 401);
        }
        if (!roles.includes(user.role)) {
            return c.json(apiError('FORBIDDEN', 'Insufficient permissions'), 403);
        }
        await next();
    };
}

// ─── Rate Limiter Middleware ────────────────────

interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
    keyPrefix: string;
    keyExtractor?: (c: Context) => string;
    /**
     * When Redis is unavailable: fail OPEN (allow through, default) or fail
     * CLOSED (reject with 503). Use fail-closed for high-privilege surfaces
     * like super-admin so a Redis blip can't be used to bypass the limit.
     */
    failClosed?: boolean;
}

export function rateLimiter(config: RateLimitConfig) {
    return async (c: Context, next: Next) => {
        try {
            const key = config.keyExtractor
                ? config.keyExtractor(c)
                : c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';

            const redisKey = `rl:${config.keyPrefix}:${key}`;
            const windowSeconds = Math.ceil(config.windowMs / 1000);

            const current = await redis.incr(redisKey);
            if (current === 1) {
                await redis.expire(redisKey, windowSeconds);
            }

            c.header('X-RateLimit-Limit', String(config.maxRequests));
            c.header('X-RateLimit-Remaining', String(Math.max(0, config.maxRequests - current)));

            if (current > config.maxRequests) {
                const ttl = await redis.ttl(redisKey);
                c.header('Retry-After', String(ttl));
                return c.json(apiError('RATE_LIMITED', 'Too many requests, slow down'), 429);
            }
        } catch (err) {
            if (config.failClosed) {
                logger.warn({ err, keyPrefix: config.keyPrefix }, 'Rate limiter: Redis unavailable, REJECTING (fail-closed)');
                return c.json(apiError('SERVICE_UNAVAILABLE', 'Rate limit service unavailable; try again shortly'), 503);
            }
            logger.warn({ err, keyPrefix: config.keyPrefix }, 'Rate limiter: Redis unavailable, allowing request');
        }
        await next();
    };
}

// Pre-configured rate limiters
export const authRateLimit = rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: Number(
        process.env.AUTH_RATE_LIMIT_MAX
        || (process.env.NODE_ENV === 'production' ? '10' : '200'),
    ),
    keyPrefix: 'auth_v2',
    keyExtractor: (c) => {
        const ipHeader = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || c.req.header('cf-connecting-ip') || '';
        const ip = ipHeader.split(',')[0]?.trim();
        const ua = c.req.header('user-agent') || 'unknown-ua';
        const origin = c.req.header('origin') || 'unknown-origin';
        return ip ? `${ip}:${ua}` : `${origin}:${ua}`;
    },
});

export const publicRateLimit = rateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: Number(
        process.env.PUBLIC_RATE_LIMIT_MAX
        || (process.env.NODE_ENV === 'production' ? '100' : '2000'),
    ),
    keyPrefix: 'public',
});

export const authenticatedRateLimit = rateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 300,
    keyPrefix: 'authed',
    keyExtractor: (c) => c.get('user')?.id || 'unknown',
});

// Super-admin: tight cap on writes per session-username, fail-CLOSED on
// Redis outage. If the cookie ever leaks, this is the last line preventing
// a wipe-the-table attack.
export const superAdminWriteRateLimit = rateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: Number(process.env.SUPER_ADMIN_WRITE_RATE_LIMIT_MAX || '30'),
    keyPrefix: 'super_admin_write',
    failClosed: true,
    keyExtractor: (c) => {
        const session = c.get('superAdmin') as { username?: string } | undefined;
        return session?.username || 'anon';
    },
});

export const adminRateLimit = rateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 50,
    keyPrefix: 'admin',
    keyExtractor: (c) => c.get('user')?.id || 'unknown',
});

// ─── Error Handler Middleware ───────────────────

export async function errorHandler(c: Context, next: Next) {
    try {
        await next();
    } catch (err: unknown) {
        const requestId = c.get('requestId') || 'unknown';
        const error = err instanceof Error ? err : new Error(String(err));

        logger.error({
            err: error.message,
            stack: error.stack,
            requestId,
            path: c.req.path,
            method: c.req.method,
        });

        return c.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: process.env.NODE_ENV === 'production'
                        ? 'An unexpected error occurred'
                        : error.message,
                },
                requestId,
            },
            500,
        );
    }
}
