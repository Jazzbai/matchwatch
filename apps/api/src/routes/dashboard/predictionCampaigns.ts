/**
 * Venue-owner CRUD + settle/draw for prediction campaigns.
 *
 * Mounted under /api/v1/dashboard/prediction-campaigns by dashboard.ts.
 * Every endpoint requires venue-owner auth (handled by the parent router's
 * authMiddleware + venue-ownership check via getVenueOr404).
 */

import { Hono } from 'hono';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/client';
import {
    auditLogs,
    matches,
    predictionCampaigns,
    predictionCampaignPrizes,
    predictionEntries,
    predictionWinners,
    venues,
} from '../../db/schema';
import { apiError, apiResponse, paginationMeta, paginationOffset } from '../../lib/utils';
import {
    canTransition,
    type PredictionCampaignStatus,
} from '../../lib/predictionStatus';
import {
    drawPrizeWinners,
    redrawPrizeWinners,
    settleCampaign,
    PredictionLogicError,
} from '../../lib/predictionDraw';
import { notifyPrizeWinners } from '../../lib/predictionNotify';
import { deleteStorageObjects } from '../../lib/storage';
import {
    createPredictionCampaignSchema,
    updatePredictionCampaignSchema,
    predictionPrizeInputSchema,
    redrawPredictionPrizeSchema,
    unlockPredictionCampaignSchema,
    paginationSchema,
} from '@matchwatch/shared';

const router = new Hono();

// Helpers reach into the parent dashboard context (user + selected venue).
// dashboard.ts already runs authMiddleware before mounting this sub-router,
// so c.var.user is set. The venue is resolved from ?venueId=.
async function getOwnedVenue(userId: string, venueId?: string | null) {
    const trimmed = typeof venueId === 'string' && venueId.trim().length > 0 ? venueId.trim() : null;
    const [venue] = await db.select().from(venues)
        .where(and(
            eq(venues.ownerId, userId),
            eq(venues.isActive, true),
            ...(trimmed ? [eq(venues.id, trimmed)] : []),
        ))
        .orderBy(desc(venues.createdAt))
        .limit(1);
    return venue || null;
}

type VenueCtx = { ok: true; user: any; venue: NonNullable<Awaited<ReturnType<typeof getOwnedVenue>>> };
type VenueCampaignCtx = VenueCtx & { campaign: typeof predictionCampaigns.$inferSelect };
type ErrorCtx = { ok: false; error: Response };

async function requireVenue(c: any): Promise<VenueCtx | ErrorCtx> {
    const user = c.get('user');
    const venueId = c.req.query('venueId');
    const venue = await getOwnedVenue(user.id, venueId);
    if (!venue) {
        return { ok: false, error: c.json(apiError('NOT_FOUND', 'No venue found'), 404) };
    }
    return { ok: true, user, venue };
}

async function requireOwnedCampaign(c: any, campaignId: string): Promise<VenueCampaignCtx | ErrorCtx> {
    const ctx = await requireVenue(c);
    if (!ctx.ok) return ctx;
    const [campaign] = await db.select().from(predictionCampaigns)
        .where(and(eq(predictionCampaigns.id, campaignId), eq(predictionCampaigns.venueId, ctx.venue.id)))
        .limit(1);
    if (!campaign) {
        return { ok: false, error: c.json(apiError('NOT_FOUND', 'Campaign not found for this venue'), 404) };
    }
    return { ok: true, user: ctx.user, venue: ctx.venue, campaign };
}

// Lazy auto-lock: flip OPEN campaigns past their close time to LOCKED before
// rendering the admin list. Cheap UPDATE — only touches rows that match;
// indexed on (status, closes_at) so it's a fast scan.
async function lazyAutoLockExpired(venueId: string) {
    await db.update(predictionCampaigns)
        .set({ status: 'LOCKED', updatedAt: new Date() })
        .where(and(
            eq(predictionCampaigns.venueId, venueId),
            eq(predictionCampaigns.status, 'OPEN'),
            sql`${predictionCampaigns.closesAt} <= now()`,
        ));
}

// ─── GET / — list campaigns for this venue
router.get('/', async (c) => {
    const ctx = await requireVenue(c);
    if (!ctx.ok) return ctx.error;
    await lazyAutoLockExpired(ctx.venue.id);
    const rows = await db.select({
        campaign: predictionCampaigns,
        match: matches,
        prizeCount: sql<number>`(SELECT COUNT(*)::int FROM ${predictionCampaignPrizes} WHERE ${predictionCampaignPrizes.campaignId} = ${predictionCampaigns.id})`,
        drawnPrizeCount: sql<number>`(SELECT COUNT(*)::int FROM ${predictionCampaignPrizes} WHERE ${predictionCampaignPrizes.campaignId} = ${predictionCampaigns.id} AND ${predictionCampaignPrizes.drawnAt} IS NOT NULL)`,
    })
        .from(predictionCampaigns)
        .innerJoin(matches, eq(predictionCampaigns.matchId, matches.id))
        .where(eq(predictionCampaigns.venueId, ctx.venue.id))
        .orderBy(desc(predictionCampaigns.createdAt));
    return c.json(apiResponse(rows));
});

// ─── POST / — create a campaign + prizes in one transaction
router.post('/', async (c) => {
    const ctx = await requireVenue(c);
    if (!ctx.ok) return ctx.error;

    const body = await c.req.json().catch(() => null);
    if (!body) return c.json(apiError('VALIDATION_ERROR', 'Invalid JSON'), 400);
    const parsed = createPredictionCampaignSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    // Verify the match exists (and belongs to the world the venue hosts).
    const [match] = await db.select({ id: matches.id }).from(matches)
        .where(eq(matches.id, parsed.data.matchId)).limit(1);
    if (!match) return c.json(apiError('NOT_FOUND', 'Match not found'), 404);

    try {
        const created = await db.transaction(async (tx) => {
            const [campaign] = await tx.insert(predictionCampaigns).values({
                venueId: ctx.venue.id,
                matchId: parsed.data.matchId,
                venueEventId: parsed.data.venueEventId ?? null,
                title: parsed.data.title,
                description: parsed.data.description ?? null,
                opensAt: new Date(parsed.data.opensAt),
                closesAt: new Date(parsed.data.closesAt),
                pointsExactScore: parsed.data.pointsExactScore ?? 2,
                pointsCorrectWinner: parsed.data.pointsCorrectWinner ?? 1,
                strictIpDedup: parsed.data.strictIpDedup ?? false,
                createdBy: ctx.user.id,
            }).returning();

            const prizesToInsert = parsed.data.prizes.map((p, idx) => ({
                campaignId: campaign.id,
                sortOrder: p.sortOrder ?? idx * 10,
                title: p.title,
                description: p.description ?? null,
                imageUrl: p.imageUrl ?? null,
                imageS3Key: p.imageS3Key ?? null,
                eligibility: p.eligibility,
                drawCount: p.drawCount,
            }));
            const prizes = await tx.insert(predictionCampaignPrizes).values(prizesToInsert).returning();

            await tx.insert(auditLogs).values({
                userId: ctx.user.id,
                action: 'PREDICTION_CAMPAIGN_CREATED',
                entityType: 'PredictionCampaign',
                entityId: campaign.id,
                metadata: { matchId: parsed.data.matchId, prizeCount: prizes.length },
            });

            return { campaign, prizes };
        });

        return c.json(apiResponse(created), 201);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (/duplicate key|unique constraint/i.test(message)) {
            return c.json(apiError('CONFLICT', 'A campaign already exists for this venue + match'), 409);
        }
        throw err;
    }
});

// ─── PATCH /:id — edit basic fields
router.patch('/:id', async (c) => {
    const ctx = await requireOwnedCampaign(c, c.req.param('id'));
    if (!ctx.ok) return ctx.error;

    const body = await c.req.json().catch(() => null);
    if (!body) return c.json(apiError('VALIDATION_ERROR', 'Invalid JSON'), 400);
    const parsed = updatePredictionCampaignSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const lockedStatuses: PredictionCampaignStatus[] = ['LOCKED', 'SETTLED', 'DRAWN'];
    if (parsed.data.closesAt !== undefined && lockedStatuses.includes(ctx.campaign.status as PredictionCampaignStatus)) {
        return c.json(apiError('CONFLICT', 'Cannot change closesAt while campaign is locked or beyond'), 409);
    }

    const updates: Partial<typeof predictionCampaigns.$inferInsert> & { updatedAt: Date } = { updatedAt: new Date() };
    if (parsed.data.title !== undefined) updates.title = parsed.data.title;
    if (parsed.data.description !== undefined) updates.description = parsed.data.description ?? null;
    if (parsed.data.opensAt !== undefined) updates.opensAt = new Date(parsed.data.opensAt);
    if (parsed.data.closesAt !== undefined) updates.closesAt = new Date(parsed.data.closesAt);
    if (parsed.data.pointsExactScore !== undefined) updates.pointsExactScore = parsed.data.pointsExactScore;
    if (parsed.data.pointsCorrectWinner !== undefined) updates.pointsCorrectWinner = parsed.data.pointsCorrectWinner;
    if (parsed.data.strictIpDedup !== undefined) updates.strictIpDedup = parsed.data.strictIpDedup;

    await db.update(predictionCampaigns).set(updates).where(eq(predictionCampaigns.id, ctx.campaign.id));
    await db.insert(auditLogs).values({
        userId: ctx.user.id,
        action: 'PREDICTION_CAMPAIGN_UPDATED',
        entityType: 'PredictionCampaign',
        entityId: ctx.campaign.id,
    });
    return c.json(apiResponse({ message: 'Campaign updated' }));
});

// ─── POST /:id/publish — DRAFT → OPEN
router.post('/:id/publish', async (c) => {
    const ctx = await requireOwnedCampaign(c, c.req.param('id'));
    if (!ctx.ok) return ctx.error;
    if (!canTransition(ctx.campaign.status as PredictionCampaignStatus, 'OPEN')) {
        return c.json(apiError('CONFLICT', `Cannot publish from status ${ctx.campaign.status}`), 409);
    }
    await db.update(predictionCampaigns).set({ status: 'OPEN', updatedAt: new Date() })
        .where(eq(predictionCampaigns.id, ctx.campaign.id));
    await db.insert(auditLogs).values({
        userId: ctx.user.id,
        action: 'PREDICTION_CAMPAIGN_PUBLISHED',
        entityType: 'PredictionCampaign',
        entityId: ctx.campaign.id,
    });
    return c.json(apiResponse({ message: 'Campaign is now OPEN' }));
});

// ─── POST /:id/lock — OPEN → LOCKED
router.post('/:id/lock', async (c) => {
    const ctx = await requireOwnedCampaign(c, c.req.param('id'));
    if (!ctx.ok) return ctx.error;
    if (!canTransition(ctx.campaign.status as PredictionCampaignStatus, 'LOCKED')) {
        return c.json(apiError('CONFLICT', `Cannot lock from status ${ctx.campaign.status}`), 409);
    }
    await db.update(predictionCampaigns).set({ status: 'LOCKED', updatedAt: new Date() })
        .where(eq(predictionCampaigns.id, ctx.campaign.id));
    await db.insert(auditLogs).values({
        userId: ctx.user.id,
        action: 'PREDICTION_CAMPAIGN_LOCKED',
        entityType: 'PredictionCampaign',
        entityId: ctx.campaign.id,
    });
    return c.json(apiResponse({ message: 'Campaign is now LOCKED' }));
});

// ─── POST /:id/unlock — LOCKED → OPEN, require new closesAt
router.post('/:id/unlock', async (c) => {
    const ctx = await requireOwnedCampaign(c, c.req.param('id'));
    if (!ctx.ok) return ctx.error;
    const body = await c.req.json().catch(() => null);
    const parsed = unlockPredictionCampaignSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Provide a new closesAt to unlock', parsed.error.issues), 400);
    }
    if (!canTransition(ctx.campaign.status as PredictionCampaignStatus, 'OPEN')) {
        return c.json(apiError('CONFLICT', `Cannot unlock from status ${ctx.campaign.status}`), 409);
    }
    await db.update(predictionCampaigns).set({
        status: 'OPEN',
        closesAt: new Date(parsed.data.closesAt),
        updatedAt: new Date(),
    }).where(eq(predictionCampaigns.id, ctx.campaign.id));
    await db.insert(auditLogs).values({
        userId: ctx.user.id,
        action: 'PREDICTION_CAMPAIGN_UNLOCKED',
        entityType: 'PredictionCampaign',
        entityId: ctx.campaign.id,
    });
    return c.json(apiResponse({ message: 'Campaign reopened' }));
});

// ─── DELETE /:id — only if DRAFT or zero entries
router.delete('/:id', async (c) => {
    const ctx = await requireOwnedCampaign(c, c.req.param('id'));
    if (!ctx.ok) return ctx.error;
    const canDelete = ctx.campaign.status === 'DRAFT' || ctx.campaign.totalEntries === 0;
    if (!canDelete) {
        return c.json(apiError('CONFLICT', 'Cannot delete a campaign with entries; lock it instead'), 409);
    }

    const prizes = await db.select({ imageS3Key: predictionCampaignPrizes.imageS3Key })
        .from(predictionCampaignPrizes)
        .where(eq(predictionCampaignPrizes.campaignId, ctx.campaign.id));
    const keys = prizes.map((p) => p.imageS3Key).filter((k): k is string => Boolean(k));

    await db.delete(predictionCampaigns).where(eq(predictionCampaigns.id, ctx.campaign.id));
    if (keys.length > 0) {
        await deleteStorageObjects(keys).catch(() => undefined);
    }

    await db.insert(auditLogs).values({
        userId: ctx.user.id,
        action: 'PREDICTION_CAMPAIGN_DELETED',
        entityType: 'PredictionCampaign',
        entityId: ctx.campaign.id,
    });
    return c.json(apiResponse({ message: 'Campaign deleted' }));
});

// ─── POST /:id/prizes — add a prize after creation
router.post('/:id/prizes', async (c) => {
    const ctx = await requireOwnedCampaign(c, c.req.param('id'));
    if (!ctx.ok) return ctx.error;
    if (ctx.campaign.status === 'DRAWN') {
        return c.json(apiError('CONFLICT', 'Cannot add prizes to a fully-drawn campaign'), 409);
    }
    const body = await c.req.json().catch(() => null);
    const parsed = predictionPrizeInputSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const [prize] = await db.insert(predictionCampaignPrizes).values({
        campaignId: ctx.campaign.id,
        sortOrder: parsed.data.sortOrder ?? 0,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        imageUrl: parsed.data.imageUrl ?? null,
        imageS3Key: parsed.data.imageS3Key ?? null,
        eligibility: parsed.data.eligibility,
        drawCount: parsed.data.drawCount,
    }).returning();

    await db.insert(auditLogs).values({
        userId: ctx.user.id,
        action: 'PREDICTION_PRIZE_ADDED',
        entityType: 'PredictionPrize',
        entityId: prize.id,
        metadata: { campaignId: ctx.campaign.id },
    });
    return c.json(apiResponse(prize), 201);
});

// ─── PATCH /:id/prizes/:prizeId
router.patch('/:id/prizes/:prizeId', async (c) => {
    const ctx = await requireOwnedCampaign(c, c.req.param('id'));
    if (!ctx.ok) return ctx.error;
    const prizeId = c.req.param('prizeId');
    const [existing] = await db.select().from(predictionCampaignPrizes)
        .where(and(eq(predictionCampaignPrizes.id, prizeId), eq(predictionCampaignPrizes.campaignId, ctx.campaign.id)))
        .limit(1);
    if (!existing) return c.json(apiError('NOT_FOUND', 'Prize not found'), 404);
    if (existing.drawnAt) return c.json(apiError('CONFLICT', 'Cannot edit a prize that has been drawn'), 409);

    const body = await c.req.json().catch(() => null);
    const parsed = predictionPrizeInputSchema.partial().safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const updates: Partial<typeof predictionCampaignPrizes.$inferInsert> & { updatedAt: Date } = { updatedAt: new Date() };
    if (parsed.data.title !== undefined) updates.title = parsed.data.title;
    if (parsed.data.description !== undefined) updates.description = parsed.data.description ?? null;
    if (parsed.data.imageUrl !== undefined) updates.imageUrl = parsed.data.imageUrl ?? null;
    if (parsed.data.imageS3Key !== undefined) updates.imageS3Key = parsed.data.imageS3Key ?? null;
    if (parsed.data.eligibility !== undefined) updates.eligibility = parsed.data.eligibility;
    if (parsed.data.drawCount !== undefined) updates.drawCount = parsed.data.drawCount;
    if (parsed.data.sortOrder !== undefined) updates.sortOrder = parsed.data.sortOrder;

    await db.update(predictionCampaignPrizes).set(updates).where(eq(predictionCampaignPrizes.id, prizeId));
    await db.insert(auditLogs).values({
        userId: ctx.user.id,
        action: 'PREDICTION_PRIZE_UPDATED',
        entityType: 'PredictionPrize',
        entityId: prizeId,
    });
    return c.json(apiResponse({ message: 'Prize updated' }));
});

// ─── DELETE /:id/prizes/:prizeId
router.delete('/:id/prizes/:prizeId', async (c) => {
    const ctx = await requireOwnedCampaign(c, c.req.param('id'));
    if (!ctx.ok) return ctx.error;
    const prizeId = c.req.param('prizeId');
    const [existing] = await db.select().from(predictionCampaignPrizes)
        .where(and(eq(predictionCampaignPrizes.id, prizeId), eq(predictionCampaignPrizes.campaignId, ctx.campaign.id)))
        .limit(1);
    if (!existing) return c.json(apiError('NOT_FOUND', 'Prize not found'), 404);
    if (existing.drawnAt) return c.json(apiError('CONFLICT', 'Cannot delete a prize that has been drawn'), 409);

    await db.delete(predictionCampaignPrizes).where(eq(predictionCampaignPrizes.id, prizeId));
    if (existing.imageS3Key) {
        await deleteStorageObjects([existing.imageS3Key]).catch(() => undefined);
    }
    await db.insert(auditLogs).values({
        userId: ctx.user.id,
        action: 'PREDICTION_PRIZE_DELETED',
        entityType: 'PredictionPrize',
        entityId: prizeId,
    });
    return c.json(apiResponse({ message: 'Prize deleted' }));
});

// ─── GET /:id/entries — paginated, owner sees full phone
router.get('/:id/entries', async (c) => {
    const ctx = await requireOwnedCampaign(c, c.req.param('id'));
    if (!ctx.ok) return ctx.error;
    const query = paginationSchema.safeParse(c.req.query());
    if (!query.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid query', query.error.issues), 400);
    const { page, limit } = query.data;
    const offset = paginationOffset(page, limit);

    const [rows, [totals]] = await Promise.all([
        db.select().from(predictionEntries)
            .where(eq(predictionEntries.campaignId, ctx.campaign.id))
            .orderBy(desc(predictionEntries.createdAt))
            .limit(limit).offset(offset),
        db.select({
            total: sql<number>`COUNT(*)::int`,
            ipCollisions: sql<number>`(SELECT COUNT(*)::int FROM (
                SELECT ip_hash FROM ${predictionEntries}
                WHERE ${predictionEntries.campaignId} = ${ctx.campaign.id}
                GROUP BY ip_hash HAVING COUNT(*) > 1
            ) c)`,
        }).from(predictionEntries).where(eq(predictionEntries.campaignId, ctx.campaign.id)),
    ]);

    return c.json(apiResponse({
        entries: rows,
        ipCollisionCount: totals.ipCollisions,
    }, paginationMeta(page, limit, totals.total)));
});

// ─── POST /:id/settle
router.post('/:id/settle', async (c) => {
    const ctx = await requireOwnedCampaign(c, c.req.param('id'));
    if (!ctx.ok) return ctx.error;
    try {
        const result = await db.transaction(async (tx) => settleCampaign(tx, ctx.campaign.id));
        await db.insert(auditLogs).values({
            userId: ctx.user.id,
            action: 'PREDICTION_SETTLED',
            entityType: 'PredictionCampaign',
            entityId: ctx.campaign.id,
            metadata: result,
        });
        return c.json(apiResponse(result));
    } catch (err) {
        if (err instanceof PredictionLogicError) {
            return c.json(apiError(err.code, err.message), err.httpStatus as any);
        }
        throw err;
    }
});

// ─── POST /:id/unsettle — admin escape hatch
router.post('/:id/unsettle', async (c) => {
    const ctx = await requireOwnedCampaign(c, c.req.param('id'));
    if (!ctx.ok) return ctx.error;

    const [drawnPrize] = await db.select({ id: predictionCampaignPrizes.id })
        .from(predictionCampaignPrizes)
        .where(and(
            eq(predictionCampaignPrizes.campaignId, ctx.campaign.id),
            sql`${predictionCampaignPrizes.drawnAt} IS NOT NULL`,
        ))
        .limit(1);
    if (drawnPrize) {
        return c.json(apiError('CONFLICT', 'Redraw all drawn prizes before unsettling'), 409);
    }

    await db.transaction(async (tx) => {
        await tx.update(predictionEntries).set({
            isCorrectWinner: false,
            isExactScore: false,
            points: 0,
            settledAt: null,
        }).where(eq(predictionEntries.campaignId, ctx.campaign.id));
        await tx.update(predictionCampaigns).set({
            status: 'LOCKED',
            settledAt: null,
            correctWinnerCount: 0,
            exactScoreCount: 0,
            updatedAt: new Date(),
        }).where(eq(predictionCampaigns.id, ctx.campaign.id));
    });

    await db.insert(auditLogs).values({
        userId: ctx.user.id,
        action: 'PREDICTION_CAMPAIGN_UNSETTLED',
        entityType: 'PredictionCampaign',
        entityId: ctx.campaign.id,
    });
    return c.json(apiResponse({ message: 'Campaign unsettled — entries reset' }));
});

// ─── POST /:id/prizes/:prizeId/draw
router.post('/:id/prizes/:prizeId/draw', async (c) => {
    const ctx = await requireOwnedCampaign(c, c.req.param('id'));
    if (!ctx.ok) return ctx.error;
    const prizeId = c.req.param('prizeId');
    try {
        const result = await db.transaction(async (tx) => drawPrizeWinners(tx, prizeId, ctx.user.id));
        await db.insert(auditLogs).values({
            userId: ctx.user.id,
            action: 'PREDICTION_PRIZE_DRAWN',
            entityType: 'PredictionPrize',
            entityId: prizeId,
            metadata: result,
        });
        // Notify winners outside the tx — Resend failures don't roll back the draw.
        void notifyPrizeWinners(prizeId).catch(() => undefined);
        return c.json(apiResponse(result));
    } catch (err) {
        if (err instanceof PredictionLogicError) {
            return c.json(apiError(err.code, err.message), err.httpStatus as any);
        }
        throw err;
    }
});

// ─── POST /:id/prizes/:prizeId/redraw
router.post('/:id/prizes/:prizeId/redraw', async (c) => {
    const ctx = await requireOwnedCampaign(c, c.req.param('id'));
    if (!ctx.ok) return ctx.error;
    const prizeId = c.req.param('prizeId');
    const body = await c.req.json().catch(() => null);
    const parsed = redrawPredictionPrizeSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }
    try {
        const result = await db.transaction(async (tx) =>
            redrawPrizeWinners(tx, prizeId, ctx.user.id, parsed.data.reason, parsed.data.excludeEntryIds),
        );
        await db.insert(auditLogs).values({
            userId: ctx.user.id,
            action: 'PREDICTION_PRIZE_REDRAWN',
            entityType: 'PredictionPrize',
            entityId: prizeId,
            metadata: result,
        });
        // Notify the newly-drawn winners (old ones already had notifiedAt set,
        // and the helper's WHERE clause skips them).
        void notifyPrizeWinners(prizeId).catch(() => undefined);
        return c.json(apiResponse(result));
    } catch (err) {
        if (err instanceof PredictionLogicError) {
            return c.json(apiError(err.code, err.message), err.httpStatus as any);
        }
        throw err;
    }
});

// ─── GET /:id/export.csv
router.get('/:id/export.csv', async (c) => {
    const ctx = await requireOwnedCampaign(c, c.req.param('id'));
    if (!ctx.ok) return ctx.error;
    const rows = await db.select().from(predictionEntries)
        .where(eq(predictionEntries.campaignId, ctx.campaign.id))
        .orderBy(asc(predictionEntries.createdAt));

    const winners = await db.select({ entryId: predictionWinners.entryId, prizeId: predictionWinners.prizeId })
        .from(predictionWinners)
        .innerJoin(predictionCampaignPrizes, eq(predictionWinners.prizeId, predictionCampaignPrizes.id))
        .where(and(
            eq(predictionCampaignPrizes.campaignId, ctx.campaign.id),
            eq(predictionWinners.isInvalidated, false),
        ));
    const winnerEntries = new Set(winners.map((w) => w.entryId));

    const headers = ['id','displayName','phone','email','predictedWinner','predictedHomeScore','predictedAwayScore','points','isCorrectWinner','isExactScore','hasWon','createdAt'];
    const escape = (v: unknown) => {
        if (v == null) return '';
        const s = String(v).replace(/"/g, '""');
        return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const lines = [headers.join(',')];
    for (const r of rows) {
        lines.push([
            r.id, r.displayName, r.phone, r.email ?? '', r.predictedWinner,
            r.predictedHomeScore ?? '', r.predictedAwayScore ?? '', r.points,
            r.isCorrectWinner, r.isExactScore, winnerEntries.has(r.id),
            r.createdAt.toISOString(),
        ].map(escape).join(','));
    }

    return new Response(lines.join('\n'), {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="prediction-entries-${ctx.campaign.id}.csv"`,
        },
    });
});

export default router;
