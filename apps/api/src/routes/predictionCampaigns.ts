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
import { authMiddleware, authRateLimit } from '../middleware';
import { apiError, apiResponse } from '../lib/utils';
import { getRequestIp } from '../lib/recaptcha';
import { submitPredictionEntrySchema } from '@matchwatch/shared';
import { isCampaignAcceptingEntries } from '../lib/predictionStatus';

const router = new Hono();

const IP_SALT = process.env.PREDICTION_IP_SALT?.trim() || 'mw-predict-default-salt-rotate-me';

function hashIp(ip: string | undefined) {
    return createHash('sha256').update(`${ip || 'unknown'}:${IP_SALT}`).digest('hex');
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

// ─── POST /:id/entries ── submit a prediction. JWT required.
router.post('/:id/entries', authRateLimit, authMiddleware, async (c) => {
    const user = c.get('user') as { id: string; phone?: string | null; email?: string | null; name?: string | null };
    if (!user.phone) {
        return c.json(apiError('FORBIDDEN', 'Phone verification is required to submit a prediction'), 403);
    }

    const body = await c.req.json().catch(() => null);
    if (!body) return c.json(apiError('VALIDATION_ERROR', 'Invalid JSON'), 400);
    const parsed = submitPredictionEntrySchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const campaignId = c.req.param('id');
    const [campaign] = await db.select().from(predictionCampaigns)
        .where(eq(predictionCampaigns.id, campaignId))
        .limit(1);
    if (!campaign) return c.json(apiError('NOT_FOUND', 'Campaign not found'), 404);

    const now = new Date();
    if (now >= campaign.closesAt) {
        return c.json(apiError('CLOSED', 'Submission window has closed'), 409);
    }
    if (!isCampaignAcceptingEntries(campaign.status, campaign.opensAt, campaign.closesAt, now)) {
        return c.json(apiError('NOT_OPEN', `Campaign is in status ${campaign.status} and not accepting entries`), 409);
    }

    const ip = getRequestIp(c.req.raw.headers);
    const ipHash = hashIp(ip);
    const userAgent = c.req.header('user-agent') || null;

    try {
        const inserted = await db.transaction(async (tx) => {
            const [entry] = await tx.insert(predictionEntries).values({
                campaignId,
                userId: user.id,
                displayName: parsed.data.displayName,
                phone: user.phone!,
                email: user.email ?? null,
                ipHash,
                userAgent,
                predictedWinner: parsed.data.predictedWinner,
                predictedHomeScore: parsed.data.predictedHomeScore ?? null,
                predictedAwayScore: parsed.data.predictedAwayScore ?? null,
            }).onConflictDoNothing().returning();

            if (!entry) return null;

            await tx.update(predictionCampaigns).set({
                totalEntries: sql`${predictionCampaigns.totalEntries} + 1`,
                updatedAt: new Date(),
            }).where(eq(predictionCampaigns.id, campaignId));

            return entry;
        });

        if (!inserted) {
            // Soft-log the rejection so the venue owner can spot abuse patterns.
            void db.insert(auditLogs).values({
                userId: user.id,
                action: 'PREDICTION_ENTRY_REJECTED',
                entityType: 'PredictionCampaign',
                entityId: campaignId,
                metadata: { reason: 'duplicate', ipHash, userAgent },
            }).catch(() => undefined);
            return c.json(apiError('DUPLICATE_ENTRY', 'You have already entered this campaign'), 409);
        }

        // Soft IP collision check — logged for forensics, not blocking.
        const [{ ipCount }] = await db.select({
            ipCount: sql<number>`COUNT(*)::int`,
        }).from(predictionEntries)
            .where(and(eq(predictionEntries.campaignId, campaignId), eq(predictionEntries.ipHash, ipHash)));
        const hasIpCollision = ipCount > 1;

        return c.json(apiResponse({
            id: inserted.id,
            campaignId,
            predictedWinner: inserted.predictedWinner,
            predictedHomeScore: inserted.predictedHomeScore,
            predictedAwayScore: inserted.predictedAwayScore,
            createdAt: inserted.createdAt,
            ipCollision: hasIpCollision,
        }), 201);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (/duplicate key|unique constraint/i.test(message)) {
            return c.json(apiError('DUPLICATE_ENTRY', 'This phone or account has already entered this campaign'), 409);
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
