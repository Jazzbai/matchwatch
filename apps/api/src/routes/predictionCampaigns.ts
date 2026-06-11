/**
 * Public-facing prediction-campaign routes.
 *
 * Mounted at /api/v1/prediction-campaigns (single-campaign lookups + entry
 * submission) and /api/v1/venues/:slugOrId/prediction-campaigns (per-venue
 * list + by-match lookup, mounted alongside venueRoutes).
 *
 * Dashboard routes (create / settle / draw / etc.) live in
 * routes/dashboard/predictionCampaigns.ts.
 */

import { Hono } from 'hono';
import { createHash } from 'node:crypto';
import { and, asc, desc, eq, gt, gte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client';
import {
    auditLogs,
    matches,
    predictionCampaigns,
    predictionCampaignPrizes,
    predictionEntries,
    predictionWinners,
    venues,
} from '../db/schema';
import { publicRateLimit } from '../middleware';
import { apiError, apiResponse } from '../lib/utils';
import { logger } from '../lib/logger';
import { submitPredictionEntrySchema } from '@matchwatch/shared';
import { isCampaignAcceptingEntries, isKnockoutStage, validateScoreConsistency } from '../lib/predictionStatus';
import { findOrCreateUserByPhone, isValidE164, normalizePhone } from '../lib/phoneUser';

const router = new Hono();

const IP_SALT = process.env.PREDICTION_IP_SALT?.trim() || 'mw-predict-default-salt-rotate-me';

function hashIp(ip: string | undefined) {
    return createHash('sha256').update(`${ip || 'unknown'}:${IP_SALT}`).digest('hex');
}

/**
 * Trusted-hop client IP extraction for the public submit endpoint.
 *
 * The shared `getRequestIp` takes the LEFTMOST x-forwarded-for entry,
 * which is whatever the upstream-most proxy claims — including any value
 * the *attacker* set in their request before it ever hit our infra. The
 * trusted entry (the one our own ALB/ingress injected) sits at the RIGHT
 * end. With one trusted hop in front of the API (ALB on this deploy),
 * that's the last entry. PREDICTION_TRUST_PROXY_HOPS overrides the count
 * if we ever stack additional proxies.
 *
 * We KEEP using `getRequestIp` everywhere else; spoof-hardening it
 * globally would be a wider behavior change. This is just the public
 * write endpoint where IP is the dedup key.
 */
function getTrustedClientIp(headers: Headers): string | undefined {
    const cf = headers.get('cf-connecting-ip')?.trim();
    if (cf) return cf;
    const hops = Math.max(1, Number(process.env.PREDICTION_TRUST_PROXY_HOPS || '1'));
    const xff = headers.get('x-forwarded-for');
    if (xff) {
        const list = xff.split(',').map((s) => s.trim()).filter(Boolean);
        if (list.length > 0) {
            // Pick the Nth-from-the-right (1-indexed). With hops=1 → list[-1].
            const idx = Math.max(0, list.length - hops);
            return list[idx];
        }
    }
    const real = headers.get('x-real-ip')?.trim();
    if (real) return real;
    return undefined;
}

function maskName(displayName: string) {
    const parts = displayName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'Anonymous';
    const first = parts[0];
    const lastInitial = parts.length > 1 ? `${parts[parts.length - 1][0].toUpperCase()}.` : '';
    return [first, lastInitial].filter(Boolean).join(' ');
}

async function loadCampaignWithRelations(campaignId: string) {
    const [row] = await db.select({
        campaign: predictionCampaigns,
        venue: {
            id: venues.id,
            name: venues.name,
            slug: venues.slug,
            city: venues.city,
            coverImageUrl: venues.coverImageUrl,
        },
        match: matches,
    })
        .from(predictionCampaigns)
        .innerJoin(venues, eq(predictionCampaigns.venueId, venues.id))
        .innerJoin(matches, eq(predictionCampaigns.matchId, matches.id))
        .where(eq(predictionCampaigns.id, campaignId))
        .limit(1);
    return row || null;
}

async function loadPrizes(campaignId: string) {
    return db.select().from(predictionCampaignPrizes)
        .where(eq(predictionCampaignPrizes.campaignId, campaignId))
        .orderBy(asc(predictionCampaignPrizes.sortOrder), asc(predictionCampaignPrizes.createdAt));
}

function publicCampaignPayload(row: NonNullable<Awaited<ReturnType<typeof loadCampaignWithRelations>>>, prizes: Awaited<ReturnType<typeof loadPrizes>>) {
    const { campaign, venue, match } = row;
    return {
        id: campaign.id,
        title: campaign.title,
        description: campaign.description,
        status: campaign.status,
        opensAt: campaign.opensAt,
        closesAt: campaign.closesAt,
        pointsExactScore: campaign.pointsExactScore,
        pointsCorrectWinner: campaign.pointsCorrectWinner,
        totalEntries: campaign.totalEntries,
        isOpen: isCampaignAcceptingEntries(campaign.status, campaign.opensAt, campaign.closesAt),
        venue: { id: venue.id, name: venue.name, slug: venue.slug, city: venue.city, coverImageUrl: venue.coverImageUrl },
        match: {
            id: match.id,
            homeTeamName: match.homeTeamName,
            awayTeamName: match.awayTeamName,
            homeTeamCrestUrl: match.homeTeamCrestUrl,
            awayTeamCrestUrl: match.awayTeamCrestUrl,
            matchDateUtc: match.matchDateUtc,
            status: match.status,
            venueName: match.venueName,
            stage: match.stage,
            isKnockout: isKnockoutStage(match.stage),
        },
        prizes: prizes.map((p) => ({
            id: p.id,
            sortOrder: p.sortOrder,
            title: p.title,
            description: p.description,
            imageUrl: p.imageUrl,
            eligibility: p.eligibility,
            drawCount: p.drawCount,
            isDrawn: p.drawnAt !== null,
        })),
    };
}

// ─── GET /:id ── single campaign for the public landing page
router.get('/:id', async (c) => {
    const row = await loadCampaignWithRelations(c.req.param('id'));
    if (!row) return c.json(apiError('NOT_FOUND', 'Prediction campaign not found'), 404);
    const prizes = await loadPrizes(row.campaign.id);
    return c.json(apiResponse(publicCampaignPayload(row, prizes)));
});

// ─── GET /:id/winners ── public reveal (only when DRAWN)
router.get('/:id/winners', async (c) => {
    const campaignId = c.req.param('id');
    const [campaign] = await db.select().from(predictionCampaigns)
        .where(eq(predictionCampaigns.id, campaignId))
        .limit(1);
    if (!campaign) return c.json(apiError('NOT_FOUND', 'Campaign not found'), 404);
    if (campaign.status !== 'DRAWN') {
        return c.json(apiResponse({ status: campaign.status, winners: [], message: 'Winners not yet drawn' }));
    }

    const rows = await db.select({
        winner: predictionWinners,
        prize: predictionCampaignPrizes,
        entry: predictionEntries,
    })
        .from(predictionWinners)
        .innerJoin(predictionCampaignPrizes, eq(predictionWinners.prizeId, predictionCampaignPrizes.id))
        .innerJoin(predictionEntries, eq(predictionWinners.entryId, predictionEntries.id))
        .where(and(
            eq(predictionCampaignPrizes.campaignId, campaignId),
            eq(predictionWinners.isInvalidated, false),
        ))
        .orderBy(asc(predictionCampaignPrizes.sortOrder), asc(predictionWinners.drawnAt));

    return c.json(apiResponse({
        status: campaign.status,
        winners: rows.map((r) => ({
            prizeId: r.prize.id,
            prizeTitle: r.prize.title,
            prizeImageUrl: r.prize.imageUrl,
            winnerName: maskName(r.entry.displayName),
            drawnAt: r.winner.drawnAt,
        })),
    }));
});

// ─── POST /:id/entries ── public submit. Phone collected in form, no OTP.
//
// Auth model: PUBLIC. The fan types their phone directly. We normalize it,
// find-or-create a shadow user account behind the scenes (deterministic
// by phone → synthetic email), and use that userId for the entry.
//
// Dedup is enforced FOUR ways, in order of strictness:
//   1) hard unique constraint on (campaignId, phone)
//   2) hard unique constraint on (campaignId, userId)  [redundant given #1
//      after find-or-create, but defense in depth]
//   3) (campaignId, ipHash) check INSIDE the transaction, serialized by a
//      Postgres advisory lock keyed on hash(campaignId|ipHash). This makes
//      the IP-dedup race-free: two concurrent same-IP submits with
//      different phones can no longer both win the SELECT-then-INSERT race.
//   4) trusted-hop XFF parsing — defeats the leftmost-XFF spoof bypass
//      where an attacker injects fake client IPs to mint unique ipHashes.
//
// User-row pollution is bounded: findOrCreateUserByPhone has a SELECT-first
// fast path, so duplicate-phone attempts don't trigger the bcrypt burn nor
// an INSERT. New phones from rotating IPs still create user rows; the rate
// limit + IP dedup serve as the primary throttle there.
router.post('/:id/entries', publicRateLimit, async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body) return c.json(apiError('VALIDATION_ERROR', 'Invalid JSON'), 400);
    const parsed = submitPredictionEntrySchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const phone = normalizePhone(parsed.data.phone);
    if (!isValidE164(phone)) {
        return c.json(apiError('VALIDATION_ERROR', 'Phone number looks off. Use a number like +1 555 123 4567.'), 400);
    }

    const campaignId = c.req.param('id');
    const [campaignRow] = await db.select({
        campaign: predictionCampaigns,
        matchStage: matches.stage,
    })
        .from(predictionCampaigns)
        .innerJoin(matches, eq(predictionCampaigns.matchId, matches.id))
        .where(eq(predictionCampaigns.id, campaignId))
        .limit(1);
    if (!campaignRow) return c.json(apiError('NOT_FOUND', 'Campaign not found'), 404);
    const campaign = campaignRow.campaign;

    const now = new Date();
    if (now >= campaign.closesAt) {
        return c.json(apiError('CLOSED', 'Submission window has closed'), 409);
    }
    if (!isCampaignAcceptingEntries(campaign.status, campaign.opensAt, campaign.closesAt, now)) {
        return c.json(apiError('NOT_OPEN', `Campaign is in status ${campaign.status} and not accepting entries`), 409);
    }

    // Reject DRAW for knockout matches, then enforce score-vs-pick consistency.
    const isKnockout = isKnockoutStage(campaignRow.matchStage);
    if (isKnockout && parsed.data.predictedWinner === 'DRAW') {
        return c.json(apiError('VALIDATION_ERROR', 'Knockout matches cannot end in a draw. Pick a winner.'), 400);
    }
    const consistency = validateScoreConsistency(
        parsed.data.predictedWinner,
        parsed.data.predictedHomeScore,
        parsed.data.predictedAwayScore,
        isKnockout,
    );
    if (!consistency.ok) {
        return c.json(apiError('VALIDATION_ERROR', consistency.reason), 400);
    }

    // Trusted-hop IP extraction — see getTrustedClientIp.
    const ip = getTrustedClientIp(c.req.raw.headers);
    const ipHash = hashIp(ip);
    const userAgent = c.req.header('user-agent') || null;

    // Find-or-create user (fast-path SELECT skips bcrypt for returning fans).
    const user = await findOrCreateUserByPhone(phone, parsed.data.displayName);

    // Form-supplied email wins. If absent, prefer a real user.email over the
    // synthetic phone_*@matchwatch.internal placeholder (real email = useful
    // for prize-win notify; placeholder = useless, store null instead).
    const placeholderEmail = (email: string | null | undefined) =>
        !email || email.endsWith('@matchwatch.internal');
    const entryEmail = parsed.data.email
        ?? (placeholderEmail(user.email) ? null : user.email);

    try {
        const inserted = await db.transaction(async (tx) => {
            // Advisory transaction-scoped lock keyed on (campaignId, ipHash).
            // Serializes all submit attempts from the same IP against the
            // same campaign. Released automatically on tx commit/rollback.
            // hashtext is a built-in Postgres 32-bit hash — collision risk
            // is negligible across our key space.
            await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`pred:${campaignId}:${ipHash}`}))`);

            // Re-check campaign status INSIDE the lock — admin could have
            // locked the campaign while we waited.
            const [freshCampaign] = await tx.select({
                status: predictionCampaigns.status,
                opensAt: predictionCampaigns.opensAt,
                closesAt: predictionCampaigns.closesAt,
            }).from(predictionCampaigns).where(eq(predictionCampaigns.id, campaignId)).limit(1);
            if (!freshCampaign) return { kind: 'not_found' } as const;
            if (!isCampaignAcceptingEntries(freshCampaign.status, freshCampaign.opensAt, freshCampaign.closesAt, new Date())) {
                return { kind: 'not_open', status: freshCampaign.status } as const;
            }

            // IP dedup check inside the lock.
            const [ipCollision] = await tx.select({ id: predictionEntries.id })
                .from(predictionEntries)
                .where(and(eq(predictionEntries.campaignId, campaignId), eq(predictionEntries.ipHash, ipHash)))
                .limit(1);
            if (ipCollision) return { kind: 'ip_blocked' } as const;

            const [entry] = await tx.insert(predictionEntries).values({
                campaignId,
                userId: user.id,
                displayName: parsed.data.displayName,
                phone,
                email: entryEmail,
                ipHash,
                userAgent,
                predictedWinner: parsed.data.predictedWinner,
                predictedHomeScore: parsed.data.predictedHomeScore ?? null,
                predictedAwayScore: parsed.data.predictedAwayScore ?? null,
            }).onConflictDoNothing().returning();

            if (!entry) return { kind: 'duplicate_phone' } as const;

            await tx.update(predictionCampaigns).set({
                totalEntries: sql`${predictionCampaigns.totalEntries} + 1`,
                updatedAt: new Date(),
            }).where(eq(predictionCampaigns.id, campaignId));

            return { kind: 'ok', entry } as const;
        });

        if (inserted.kind === 'not_found') {
            return c.json(apiError('NOT_FOUND', 'Campaign not found'), 404);
        }
        if (inserted.kind === 'not_open') {
            return c.json(apiError('NOT_OPEN', `Campaign is in status ${inserted.status} and not accepting entries`), 409);
        }
        if (inserted.kind === 'ip_blocked') {
            db.insert(auditLogs).values({
                userId: user.id,
                action: 'PREDICTION_ENTRY_REJECTED',
                entityType: 'PredictionCampaign',
                entityId: campaignId,
                metadata: { reason: 'strict_ip_dedup', ipHash, userAgent },
            }).catch((err) => {
                logger.warn({ err, campaignId }, 'prediction audit_log insert failed (ip_blocked)');
            });
            return c.json(apiError('IP_BLOCKED', 'Someone on this network has already entered this campaign. Switch to cellular data and try again.'), 409);
        }
        if (inserted.kind === 'duplicate_phone') {
            db.insert(auditLogs).values({
                userId: user.id,
                action: 'PREDICTION_ENTRY_REJECTED',
                entityType: 'PredictionCampaign',
                entityId: campaignId,
                metadata: { reason: 'duplicate', ipHash, userAgent },
            }).catch((err) => {
                logger.warn({ err, campaignId }, 'prediction audit_log insert failed (duplicate)');
            });
            return c.json(apiError('DUPLICATE_ENTRY', 'This phone has already entered this campaign.'), 409);
        }

        const entry = inserted.entry;
        return c.json(apiResponse({
            id: entry.id,
            campaignId,
            predictedWinner: entry.predictedWinner,
            predictedHomeScore: entry.predictedHomeScore,
            predictedAwayScore: entry.predictedAwayScore,
            createdAt: entry.createdAt,
        }), 201);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (/duplicate key|unique constraint/i.test(message)) {
            // Belt-and-suspenders: a unique violation outside the path we
            // hand-check (e.g., a new constraint added later).
            return c.json(apiError('DUPLICATE_ENTRY', 'This phone has already entered this campaign.'), 409);
        }
        throw err;
    }
});

export default router;

// ─── Helpers used by venueRoutes for the per-venue listing endpoints ──
//
// venueRoutes mounts these under /venues/:slugOrId/... — we export the
// list-by-venue and lookup-by-match functions so it can call them without
// re-implementing the join.

export async function listVenuePredictionCampaigns(venueId: string) {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rows = await db.select({
        campaign: predictionCampaigns,
        match: matches,
    })
        .from(predictionCampaigns)
        .innerJoin(matches, eq(predictionCampaigns.matchId, matches.id))
        .where(and(
            eq(predictionCampaigns.venueId, venueId),
            sql`${predictionCampaigns.status} IN ('OPEN','LOCKED','SETTLED','DRAWN')`,
            gt(predictionCampaigns.closesAt, twentyFourHoursAgo),
        ))
        .orderBy(desc(predictionCampaigns.opensAt));
    return rows;
}

export async function findVenueCampaignByMatch(venueId: string, matchId: string) {
    const [row] = await db.select({
        campaign: predictionCampaigns,
        venue: {
            id: venues.id,
            name: venues.name,
            slug: venues.slug,
            city: venues.city,
            coverImageUrl: venues.coverImageUrl,
        },
        match: matches,
    })
        .from(predictionCampaigns)
        .innerJoin(venues, eq(predictionCampaigns.venueId, venues.id))
        .innerJoin(matches, eq(predictionCampaigns.matchId, matches.id))
        .where(and(
            eq(predictionCampaigns.venueId, venueId),
            eq(predictionCampaigns.matchId, matchId),
        ))
        .limit(1);
    if (!row) return null;
    const prizes = await loadPrizes(row.campaign.id);
    return publicCampaignPayload(row, prizes);
}
