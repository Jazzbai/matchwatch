import { Hono } from 'hono';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import * as jose from 'jose';
import { db } from '../db/client';
import { users, phoneAuthSessions } from '../db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { apiResponse, apiError } from '../lib/utils';

const phoneAuthRoutes = new Hono();

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-change-in-production');
const OTP_EXPIRY_MINUTES = 10;

// Generate a 6-digit OTP
function generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Normalize phone: strip spaces/dashes, ensure + prefix
function normalizePhone(raw: string): string {
    const digits = raw.replace(/[\s\-\(\)]/g, '');
    return digits.startsWith('+') ? digits : `+1${digits}`; // default US if no country code
}

// Send OTP via Telnyx (or log in dev if no credentials)
async function sendOtp(phone: string, otp: string): Promise<void> {
    const apiKey = process.env.TELNYX_API_KEY;
    const fromNumber = process.env.TELNYX_PHONE_NUMBER;

    if (!apiKey || !fromNumber) {
        // Dev mode: log OTP to console
        console.log(`\n[PHONE AUTH DEV] OTP for ${phone}: ${otp}\n`);
        return;
    }

    const res = await fetch('https://api.telnyx.com/v2/messages', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: fromNumber,
            to: phone,
            text: `Your MatchWatch code: ${otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes.`,
        }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Telnyx error: ${JSON.stringify(err)}`);
    }
}

// POST /api/v1/auth/phone/send-otp
phoneAuthRoutes.post('/send-otp', async (c) => {
    const schema = z.object({
        phone: z.string().min(7).max(20),
    });

    const body = await c.req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid phone number', parsed.error.flatten().fieldErrors), 400);
    }

    const phone = normalizePhone(parsed.data.phone);
    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Delete old sessions for this phone
    await db.delete(phoneAuthSessions).where(eq(phoneAuthSessions.phone, phone));

    // Insert new session
    await db.insert(phoneAuthSessions).values({ phone, otpHash, expiresAt });

    // Send OTP
    try {
        await sendOtp(phone, otp);
    } catch (err) {
        console.error('Failed to send OTP:', err);
        return c.json(apiError('INTERNAL_ERROR', 'Could not send OTP. Please try again.'), 500);
    }

    return c.json(apiResponse({ message: 'OTP sent', phone }));
});

// POST /api/v1/auth/phone/verify
phoneAuthRoutes.post('/verify', async (c) => {
    const schema = z.object({
        phone: z.string().min(7).max(20),
        otp: z.string().length(6),
        name: z.string().min(1).max(100).optional(),
    });

    const body = await c.req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.flatten().fieldErrors), 400);
    }

    const phone = normalizePhone(parsed.data.phone);
    const now = new Date();

    // Find valid session
    const [session] = await db
        .select()
        .from(phoneAuthSessions)
        .where(
            and(
                eq(phoneAuthSessions.phone, phone),
                gt(phoneAuthSessions.expiresAt, now),
                eq(phoneAuthSessions.verified, false),
            ),
        )
        .limit(1);

    if (!session) {
        return c.json(apiError('UNAUTHORIZED', 'OTP expired or not found. Request a new code.'), 401);
    }

    // Check attempt count
    if (session.attempts >= 5) {
        await db.delete(phoneAuthSessions).where(eq(phoneAuthSessions.id, session.id));
        return c.json(apiError('RATE_LIMITED', 'Too many attempts. Request a new code.'), 429);
    }

    // Verify OTP
    const valid = await bcrypt.compare(parsed.data.otp, session.otpHash);
    if (!valid) {
        await db
            .update(phoneAuthSessions)
            .set({ attempts: session.attempts + 1 })
            .where(eq(phoneAuthSessions.id, session.id));
        return c.json(apiError('UNAUTHORIZED', 'Incorrect code. Please try again.'), 401);
    }

    // Mark session verified + clean up
    await db.delete(phoneAuthSessions).where(eq(phoneAuthSessions.phone, phone));

    // Find or create user
    let [user] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);

    if (!user) {
        const displayName = parsed.data.name || `Fan_${phone.slice(-4)}`;
        const [created] = await db
            .insert(users)
            .values({
                email: `phone_${phone.replace(/\+/g, '')}@matchwatch.internal`,
                passwordHash: await bcrypt.hash(crypto.randomUUID(), 12),
                name: displayName,
                phone,
                emailVerified: true, // phone-verified users skip email flow
                role: 'USER',
            })
            .returning();
        user = created;
    }

    // Issue JWT
    const accessToken = await new jose.SignJWT({
        sub: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        phone: user.phone,
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('7d') // longer for phone-auth users (no refresh token flow)
        .setIssuedAt()
        .sign(JWT_SECRET);

    return c.json(apiResponse({
        accessToken,
        user: {
            id: user.id,
            name: user.name,
            phone: user.phone,
            role: user.role,
        },
    }));
});

export default phoneAuthRoutes;