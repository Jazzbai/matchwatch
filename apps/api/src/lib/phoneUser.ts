/**
 * Phone normalization + atomic find-or-create user by phone.
 *
 * Used by both the OTP-based phoneAuth route (legacy callers) and the
 * no-OTP prediction-entry submit. The find-or-create is RACE-SAFE: it
 * tries INSERT ... ON CONFLICT DO NOTHING first, then falls back to a
 * SELECT by phone if the insert collided (another concurrent request
 * created the row first).
 *
 * The synthetic email format `phone_<digits>@matchwatch.internal` matches
 * what phoneAuth.ts has always produced, so users created via either
 * route map back to the same row.
 */

import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { eq, or } from 'drizzle-orm';
import { db } from '../db/client';
import { users } from '../db/schema';

// E.164: `+` followed by 10–15 digits. Most permissive valid form.
const E164_RE = /^\+\d{10,15}$/;

/**
 * Strip whitespace, dashes, parens, dots from a raw phone string.
 * If it doesn't already start with `+`, default-prepend `+1` (US).
 * Matches the legacy logic in routes/phoneAuth.ts so the same user is
 * found-or-created regardless of which entry point fans use.
 */
export function normalizePhone(raw: string): string {
    const cleaned = raw.replace(/[\s\-().]/g, '');
    return cleaned.startsWith('+') ? cleaned : `+1${cleaned}`;
}

export function isValidE164(phone: string): boolean {
    return E164_RE.test(phone);
}

/**
 * Atomic find-or-create. Returns the User row.
 *
 * Race-safety: two concurrent submits with the same phone both try
 * INSERT with onConflictDoNothing. At most one inserts; the other gets
 * an empty `returning()` and falls through to the SELECT, which now
 * sees the freshly-created row from the winner.
 *
 * Optimization: try SELECT-by-phone FIRST. Most submits in a busy bar
 * hit existing users (returning predictors). That avoids the bcrypt
 * burn (~200ms) on every duplicate-attempt request — a CPU DOS vector
 * if we always hashed first.
 *
 * The bcrypt cost factor 12 matches the rest of the codebase. The random
 * password makes the synthetic account un-loginable via email/password —
 * it can only be re-entered through phone OTP (or this helper).
 */
export async function findOrCreateUserByPhone(phone: string, displayNameHint?: string) {
    if (!isValidE164(phone)) {
        throw new Error(`Phone is not E.164: ${phone}`);
    }
    const email = `phone_${phone.replace(/\+/g, '')}@matchwatch.internal`;
    const fallbackName = displayNameHint?.trim() || `Fan_${phone.slice(-4)}`;

    // Fast path: existing user? Skip the bcrypt hash entirely.
    const [hit] = await db.select().from(users)
        .where(eq(users.phone, phone))
        .limit(1);
    if (hit) return hit;

    // Insert with explicit conflict target on phone — this is the only
    // collision we expect at race time. Email collisions would only happen
    // if a legacy row was seeded with the synthetic email but a different
    // phone (or NULL phone); those are vanishingly rare and we fall through
    // to the SELECT-by-email defensive lookup below.
    const passwordHash = await bcrypt.hash(randomUUID(), 12);
    const [inserted] = await db.insert(users).values({
        email,
        passwordHash,
        name: fallbackName,
        phone,
        emailVerified: true,
        role: 'USER',
    }).onConflictDoNothing({ target: users.phone }).returning();

    if (inserted) return inserted;

    // Race: another concurrent submit created the row between our SELECT
    // and INSERT. Re-fetch by phone OR the derived email — covers both the
    // common race and the rare email-only-collision case.
    const [racedIn] = await db.select().from(users)
        .where(or(eq(users.phone, phone), eq(users.email, email)))
        .limit(1);
    if (!racedIn) {
        throw new Error(`Failed to find-or-create user for phone ${phone}`);
    }
    return racedIn;
}
