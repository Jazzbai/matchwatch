import * as jose from 'jose';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/client';
import { refreshTokenSessions, users } from '../db/schema';
import { eq, and, lt, desc } from 'drizzle-orm';

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 30;
const MAX_SESSIONS = 5;

// ─── Key Management ─────────────────────────────
// In production, use RS256 with keys from AWS Secrets Manager.
// For dev, we use HS256 with a secret string for simplicity.

function getJwtSecret(): Uint8Array {
    const secret = process.env.JWT_SECRET || 'matchwatch-dev-secret-key-change-in-production-32chars!';
    return new TextEncoder().encode(secret);
}

// ─── Password Hashing ───────────────────────────

export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

// ─── Access Token (JWT) ─────────────────────────

export interface JwtPayload {
    sub: string; // user ID
    email: string;
    role: string;
    name: string;
}

export async function generateAccessToken(payload: JwtPayload): Promise<string> {
    return new jose.SignJWT({
        email: payload.email,
        role: payload.role,
        name: payload.name,
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(payload.sub)
        .setIssuedAt()
        .setExpirationTime(ACCESS_TOKEN_EXPIRY)
        .setIssuer('matchwatch')
        .sign(getJwtSecret());
}

export async function verifyAccessToken(token: string): Promise<JwtPayload & { exp?: number }> {
    const { payload } = await jose.jwtVerify(token, getJwtSecret(), {
        issuer: 'matchwatch',
    });
    return {
        sub: payload.sub as string,
        email: payload.email as string,
        role: payload.role as string,
        name: payload.name as string,
        exp: payload.exp,
    };
}

// ─── Refresh Token ──────────────────────────────

export async function generateRefreshToken(
    userId: string,
    deviceInfo?: { userAgent?: string; ip?: string; deviceName?: string },
    existingFamilyId?: string,
): Promise<{ token: string; familyId: string }> {
    const token = uuidv4();
    const familyId = existingFamilyId || uuidv4();
    const tokenHash = await bcrypt.hash(token, 10);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    // Enforce max sessions
    const existingSessions = await db
        .select()
        .from(refreshTokenSessions)
        .where(
            and(
                eq(refreshTokenSessions.userId, userId),
                eq(refreshTokenSessions.isRevoked, false),
            ),
        )
        .orderBy(desc(refreshTokenSessions.createdAt));

    if (existingSessions.length >= MAX_SESSIONS) {
        // Revoke oldest session
        const oldest = existingSessions[existingSessions.length - 1];
        await db
            .update(refreshTokenSessions)
            .set({ isRevoked: true })
            .where(eq(refreshTokenSessions.id, oldest.id));
    }

    await db.insert(refreshTokenSessions).values({
        userId,
        tokenHash,
        familyId,
        deviceInfo: deviceInfo ? {
            userAgent: deviceInfo.userAgent,
            ipHash: deviceInfo.ip,
            deviceName: deviceInfo.deviceName,
        } : null,
        expiresAt,
    });

    return { token, familyId };
}

export async function rotateRefreshToken(
    oldToken: string,
    userId: string,
    deviceInfo?: { userAgent?: string; ip?: string; deviceName?: string },
): Promise<{ accessToken: string; refreshToken: string; familyId: string } | null> {
    // Find all non-revoked sessions for this user
    const sessions = await db
        .select()
        .from(refreshTokenSessions)
        .where(
            and(
                eq(refreshTokenSessions.userId, userId),
                eq(refreshTokenSessions.isRevoked, false),
            ),
        );

    // Find the session that matches the token
    let matchedSession = null;
    for (const session of sessions) {
        const isMatch = await bcrypt.compare(oldToken, session.tokenHash);
        if (isMatch) {
            matchedSession = session;
            break;
        }
    }

    if (!matchedSession) {
        // Token theft detection: if token was already used (revoked), revoke entire family
        const allSessions = await db
            .select()
            .from(refreshTokenSessions)
            .where(eq(refreshTokenSessions.userId, userId));

        for (const s of allSessions) {
            const isMatch = await bcrypt.compare(oldToken, s.tokenHash);
            if (isMatch && s.isRevoked) {
                // Stolen token detected — revoke entire family
                await db
                    .update(refreshTokenSessions)
                    .set({ isRevoked: true })
                    .where(eq(refreshTokenSessions.familyId, s.familyId));
                return null;
            }
        }
        return null;
    }

    // Check expiry
    if (new Date() > matchedSession.expiresAt) {
        await db
            .update(refreshTokenSessions)
            .set({ isRevoked: true })
            .where(eq(refreshTokenSessions.id, matchedSession.id));
        return null;
    }

    // Revoke old token
    await db
        .update(refreshTokenSessions)
        .set({ isRevoked: true })
        .where(eq(refreshTokenSessions.id, matchedSession.id));

    // Get user for access token claims
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user.length) return null;

    // Generate new tokens
    const accessToken = await generateAccessToken({
        sub: user[0].id,
        email: user[0].email,
        role: user[0].role,
        name: user[0].name,
    });

    const { token: refreshToken, familyId } = await generateRefreshToken(
        userId, deviceInfo, matchedSession.familyId,
    );

    return { accessToken, refreshToken, familyId };
}

export async function revokeSession(sessionId: string): Promise<void> {
    await db
        .update(refreshTokenSessions)
        .set({ isRevoked: true })
        .where(eq(refreshTokenSessions.id, sessionId));
}

export async function revokeAllSessions(userId: string): Promise<void> {
    await db
        .update(refreshTokenSessions)
        .set({ isRevoked: true })
        .where(eq(refreshTokenSessions.userId, userId));
}
