/**
 * Super-admin prediction-campaign control.
 *
 * Mounted at /api/v1/super-admin/prediction-campaigns by superAdmin.ts.
 * Every endpoint requires super-admin auth (handled by the parent router).
 * The super-admin can:
 *   - List campaigns across ALL venues
 *   - Create campaigns on behalf of ANY venue
 *   - Override the state machine via /force-status
 *   - Re-fire winner notifications via /:id/prizes/:prizeId/renotify
 *   - See per-campaign audit history
 *
 * Audit log: super-admin actions are written with userId=null and
 * metadata.actorType='super_admin' + actorUsername=<session username>
 * so we can distinguish them from venue-owner actions in the log.
 * Action strings are prefixed `SUPER_ADMIN_` to make them obvious in
 * grep / forensics.
 */

import { Hono } from 'hono';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
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

const ALL_STATUSES = ['DRAFT', 'OPEN', 'LOCKED', 'SETTLED', 'DRAWN'] as const;
type Status = typeof ALL_STATUSES[number];

// Schema additions used only by the super-admin surface.
const createOnBehalfSchema = createPredictionCampaignSchema.and(z.object({
    venueId: z.string().uuid(),
}));

const forceStatusSchema = z.object({
    status: z.enum(ALL_STATUSES),
    reason: z.string().min(1).max(500),
});

const listQuerySchema = z.object({
    venueId: z.string().uuid().optional(),
    matchId: z.string().uuid().optional(),
    status: z.enum(ALL_STATUSES).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
});

function actorMetadata(c: any, extra: Record<string, unknown> = {}) {
    const session = c.get('superAdmin') as { username: string } | undefined;
    return {
        actorType: 'super_admin' as const,
        actorUsername: session?.username || 'unknown',
        ...extra,
    };
}

async function logSuperAdminAction(
    c: any,
    action: string,
    entityType: string,
    entityId: string,
    extra: Record<string, unknown> = {},
) {
    try {
        await db.insert(auditLogs).values({
            userId: null,
            action,
            entityType,
            entityId,
            metadata: actorMetadata(c, extra),
        });
    } catch {
        // Forensic logging — never let it break the response.
    }
}

async function loadCampaign(campaignId: string) {
    const [campaign] = await db.select().from(predictionCampaigns)
        .where(eq(predictionCampaigns.id, campaignId))
        .limit(1);
    return campaign || null;
}

// ─── GET / — cross-venue list with filters
router.get('/', async (c) => {
    const parsed = listQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid query', parsed.error.issues), 400);
    }
    const { page, limit } = parsed.data;
    const offset = paginationOffset(page, limit);

    const filters = [
        parsed.data.venueId ? eq(predictionCampaigns.venueId, parsed.data.venueId) : null,
        parsed.data.matchId ? eq(predictionCampaigns.matchId, parsed.data.matchId) : null,
        parsed.data.status ? eq(predictionCampaigns.status, parsed.data.status) : null,
    ].filter(Boolean) as ReturnType<typeof eq>[];

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    const [rows, totalRow] = await Promise.all([
        db.select({
            campaign: predictionCampaigns,
            venue: { id: venues.id, name: venues.name, slug: venues.slug, city: venues.city },
            match: matches,
            prizeCount: sql<number>`(SELECT COUNT(*)::int FROM ${predictionCampaignPrizes} WHERE ${predictionCampaignPrizes.campaignId} = ${predictionCampaigns.id})`,
            drawnPrizeCount: sql<number>`(SELECT COUNT(*)::int FROM ${predictionCampaignPrizes} WHERE ${predictionCampaignPrizes.campaignId} = ${predictionCampaigns.id} AND ${predictionCampaignPrizes.drawnAt} IS NOT NULL)`,
        })
            .from(predictionCampaigns)
            .innerJoin(venues, eq(predictionCampaigns.venueId, venues.id))
            .innerJoin(matches, eq(predictionCampaigns.matchId, matches.id))
            .where(whereClause as any)
            .orderBy(desc(predictionCampaigns.createdAt))
            .limit(limit).offset(offset),
        db.select({ total: sql<number>`COUNT(*)::int` })
            .from(predictionCampaigns)
            .where(whereClause as any),
    ]);

    return c.json(apiResponse(rows, paginationMeta(page, limit, totalRow[0]?.total || 0)));
});

// ─── GET /:id — full detail (campaign + venue + match + prizes)
router.get('/:id', async (c) => {
    const campaignId = c.req.param('id');
    const [row] = await db.select({
        campaign: predictionCampaigns,
        venue: { id: venues.id, name: venues.name, slug: venues.slug, city: venues.city, ownerId: venues.ownerId },
        match: matches,
    })
        .from(predictionCampaigns)
        .innerJoin(venues, eq(predictionCampaigns.venueId, venues.id))
        .innerJoin(matches, eq(predictionCampaigns.matchId, matches.id))
        .where(eq(predictionCampaigns.id, campaignId))
        .limit(1);
    if (!row) return c.json(apiError('NOT_FOUND', 'Campaign not found'), 404);

    const prizes = await db.select().from(predictionCampaignPrizes)
        .where(eq(predictionCampaignPrizes.campaignId, campaignId))
        .orderBy(asc(predictionCampaignPrizes.sortOrder), asc(predictionCampaignPrizes.createdAt));

    return c.json(apiResponse({ ...row, prizes }));
});

// ─── POST / — create on behalf of any venue
router.post('/', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body) return c.json(apiError('VALIDATION_ERROR', 'Invalid JSON'), 400);
    const parsed = createOnBehalfSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const [venue] = await db.select({ id: venues.id, ownerId: venues.ownerId }).from(venues)
        .where(eq(venues.id, parsed.data.venueId)).limit(1);
    if (!venue) return c.json(apiError('NOT_FOUND', 'Venue not found'), 404);

    const [match] = await db.select({ id: matches.id }).from(matches)
        .where(eq(matches.id, parsed.data.matchId)).limit(1);
    if (!match) return c.json(apiError('NOT_FOUND', 'Match not found'), 404);

    try {
        const created = await db.transaction(async (tx) => {
            const [campaign] = await tx.insert(predictionCampaigns).values({
                venueId: venue.id,
                matchId: parsed.data.matchId,
                venueEventId: parsed.data.venueEventId ?? null,
                title: parsed.data.title,
                description: parsed.data.description ?? null,
                opensAt: new Date(parsed.data.opensAt),
                closesAt: new Date(parsed.data.closesAt),
                pointsExactScore: parsed.data.pointsExactScore ?? 2,
                pointsCorrectWinner: parsed.data.pointsCorrectWinner ?? 1,
                strictIpDedup: parsed.data.strictIpDedup ?? false,
                // createdBy = the venue's owner so existing FK checks pass and
                // the owner still sees the campaign as theirs in /admin.
                createdBy: venue.ownerId,
            }).returning();

            const prizes = await tx.insert(predictionCampaignPrizes).values(
                parsed.data.prizes.map((p, idx) => ({
                    campaignId: campaign.id,
                    sortOrder: p.sortOrder ?? idx * 10,
                    title: p.title,
                    description: p.description ?? null,
                    imageUrl: p.imageUrl ?? null,
                    imageS3Key: p.imageS3Key ?? null,
                    eligibility: p.eligibility,
                    drawCount: p.drawCount,
                })),
            ).returning();

            return { campaign, prizes };
        });

        await logSuperAdminAction(c, 'SUPER_ADMIN_PREDICTION_CAMPAIGN_CREATED', 'PredictionCampaign', created.campaign.id, {
            venueId: venue.id,
            matchId: parsed.data.matchId,
            prizeCount: created.prizes.length,
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

// ─── PATCH /:id — edit any field (no closesAt-after-LOCK restriction for super-admin)
router.patch('/:id', async (c) => {
    const campaign = await loadCampaign(c.req.param('id'));
    if (!campaign) return c.json(apiError('NOT_FOUND', 'Campaign not found'), 404);

    const body = await c.req.json().catch(() => null);
    const parsed = updatePredictionCampaignSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const updates: Partial<typeof predictionCampaigns.$inferInsert> & { updatedAt: Date } = { updatedAt: new Date() };
    if (parsed.data.title !== undefined) updates.title = parsed.data.title;
    if (parsed.data.description !== undefined) updates.description = parsed.data.description ?? null;
    if (parsed.data.opensAt !== undefined) updates.opensAt = new Date(parsed.data.opensAt);
    if (parsed.data.closesAt !== undefined) updates.closesAt = new Date(parsed.data.closesAt);
    if (parsed.data.pointsExactScore !== undefined) updates.pointsExactScore = parsed.data.pointsExactScore;
    if (parsed.data.pointsCorrectWinner !== undefined) updates.pointsCorrectWinner = parsed.data.pointsCorrectWinner;
    if (parsed.data.strictIpDedup !== undefined) updates.strictIpDedup = parsed.data.strictIpDedup;

    await db.update(predictionCampaigns).set(updates).where(eq(predictionCampaigns.id, campaign.id));
    await logSuperAdminAction(c, 'SUPER_ADMIN_PREDICTION_CAMPAIGN_UPDATED', 'PredictionCampaign', campaign.id);
    return c.json(apiResponse({ message: 'Campaign updated' }));
});

// ─── DELETE /:id — super-admin can delete in any state
router.delete('/:id', async (c) => {
    const campaign = await loadCampaign(c.req.param('id'));
    if (!campaign) return c.json(apiError('NOT_FOUND', 'Campaign not found'), 404);

    const prizes = await db.select({ imageS3Key: predictionCampaignPrizes.imageS3Key })
        .from(predictionCampaignPrizes)
        .where(eq(predictionCampaignPrizes.campaignId, campaign.id));
    const keys = prizes.map((p) => p.imageS3Key).filter((k): k is string => Boolean(k));

    await db.delete(predictionCampaigns).where(eq(predictionCampaigns.id, campaign.id));
    if (keys.length > 0) await deleteStorageObjects(keys).catch(() => undefined);

    await logSuperAdminAction(c, 'SUPER_ADMIN_PREDICTION_CAMPAIGN_DELETED', 'PredictionCampaign', campaign.id, {
        priorStatus: campaign.status,
        priorEntryCount: campaign.totalEntries,
    });
    return c.json(apiResponse({ message: 'Campaign deleted' }));
});

// ─── POST /:id/force-status — escape hatch
router.post('/:id/force-status', async (c) => {
    const campaign = await loadCampaign(c.req.param('id'));
    if (!campaign) return c.json(apiError('NOT_FOUND', 'Campaign not found'), 404);

    const body = await c.req.json().catch(() => null);
    const parsed = forceStatusSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const updates: Partial<typeof predictionCampaigns.$inferInsert> & { updatedAt: Date } = {
        status: parsed.data.status,
        updatedAt: new Date(),
    };
    // Keep the timestamps coherent so the UI doesn't show "DRAWN but raffleDrawnAt=null".
    if (parsed.data.status === 'DRAWN' && !campaign.raffleDrawnAt) updates.raffleDrawnAt = new Date();
    if (parsed.data.status === 'SETTLED' && !campaign.settledAt) updates.settledAt = new Date();
    if (parsed.data.status === 'DRAFT' || parsed.data.status === 'OPEN' || parsed.data.status === 'LOCKED') {
        updates.raffleDrawnAt = null;
    }
    if (parsed.data.status === 'DRAFT' || parsed.data.status === 'OPEN') {
        updates.settledAt = null;
    }

    await db.update(predictionCampaigns).set(updates).where(eq(predictionCampaigns.id, campaign.id));
    await logSuperAdminAction(c, 'SUPER_ADMIN_PREDICTION_FORCE_STATUS', 'PredictionCampaign', campaign.id, {
        from: campaign.status,
        to: parsed.data.status,
        reason: parsed.data.reason,
    });
    return c.json(apiResponse({ message: `Forced status to ${parsed.data.status}` }));
});

// ─── State-machine action shortcuts (no ownership check, audited as super-admin)
async function transitionEndpoint(c: any, targetStatus: Status, validFrom: Status[], setSettled = false) {
    const campaign = await loadCampaign(c.req.param('id'));
    if (!campaign) return c.json(apiError('NOT_FOUND', 'Campaign not found'), 404);
    if (!validFrom.includes(campaign.status as Status)) {
        return c.json(apiError('CONFLICT', `Cannot transition from ${campaign.status} to ${targetStatus} via this endpoint; use /force-status`), 409);
    }
    const updates: Partial<typeof predictionCampaigns.$inferInsert> & { updatedAt: Date } = {
        status: targetStatus,
        updatedAt: new Date(),
    };
    if (setSettled && !campaign.settledAt) updates.settledAt = new Date();
    await db.update(predictionCampaigns).set(updates).where(eq(predictionCampaigns.id, campaign.id));
    await logSuperAdminAction(c, `SUPER_ADMIN_PREDICTION_${targetStatus}`, 'PredictionCampaign', campaign.id, {
        from: campaign.status, to: targetStatus,
    });
    return c.json(apiResponse({ message: `Campaign moved to ${targetStatus}` }));
}

router.post('/:id/publish', (c) => transitionEndpoint(c, 'OPEN', ['DRAFT']));
router.post('/:id/lock', (c) => transitionEndpoint(c, 'LOCKED', ['OPEN']));
router.post('/:id/unlock', async (c) => {
    const campaign = await loadCampaign(c.req.param('id'));
    if (!campaign) return c.json(apiError('NOT_FOUND', 'Campaign not found'), 404);
    if (campaign.status !== 'LOCKED') {
        return c.json(apiError('CONFLICT', `Can only unlock LOCKED campaigns (current: ${campaign.status})`), 409);
    }
    const body = await c.req.json().catch(() => null);
    const parsed = unlockPredictionCampaignSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Provide closesAt', parsed.error.issues), 400);
    }
    await db.update(predictionCampaigns).set({
        status: 'OPEN',
        closesAt: new Date(parsed.data.closesAt),
        updatedAt: new Date(),
    }).where(eq(predictionCampaigns.id, campaign.id));
    await logSuperAdminAction(c, 'SUPER_ADMIN_PREDICTION_UNLOCKED', 'PredictionCampaign', campaign.id, {
        newClosesAt: parsed.data.closesAt,
    });
    return c.json(apiResponse({ message: 'Campaign reopened' }));
});

// ─── POST /:id/settle
router.post('/:id/settle', async (c) => {
    const campaign = await loadCampaign(c.req.param('id'));
    if (!campaign) return c.json(apiError('NOT_FOUND', 'Campaign not found'), 404);
    try {
        const result = await db.transaction((tx) => settleCampaign(tx, campaign.id));
        await logSuperAdminAction(c, 'SUPER_ADMIN_PREDICTION_SETTLED', 'PredictionCampaign', campaign.id, result);
        return c.json(apiResponse(result));
    } catch (err) {
        if (err instanceof PredictionLogicError) {
            return c.json(apiError(err.code, err.message), err.httpStatus as any);
        }
        throw err;
    }
});

// ─── POST /:id/unsettle — super-admin can override the "no drawn prize" check
router.post('/:id/unsettle', async (c) => {
    const campaign = await loadCampaign(c.req.param('id'));
    if (!campaign) return c.json(apiError('NOT_FOUND', 'Campaign not found'), 404);

    await db.transaction(async (tx) => {
        // First, soft-invalidate all active winners (super-admin override of
        // the venue-owner constraint that says "redraw drawn prizes first").
        await tx.update(predictionWinners).set({
            isInvalidated: true,
            invalidatedAt: new Date(),
            invalidatedReason: 'super-admin unsettle',
        }).where(and(
            eq(predictionWinners.isInvalidated, false),
            sql`${predictionWinners.prizeId} IN (
                SELECT ${predictionCampaignPrizes.id} FROM ${predictionCampaignPrizes}
                WHERE ${predictionCampaignPrizes.campaignId} = ${campaign.id}
            )`,
        ));
        // Reset prize drawn flags.
        await tx.update(predictionCampaignPrizes).set({
            drawnAt: null,
            drawnBy: null,
            updatedAt: new Date(),
        }).where(eq(predictionCampaignPrizes.campaignId, campaign.id));
        // Reset entries.
        await tx.update(predictionEntries).set({
            isCorrectWinner: false,
            isExactScore: false,
            points: 0,
            settledAt: null,
        }).where(eq(predictionEntries.campaignId, campaign.id));
        // Roll the campaign back to LOCKED.
        await tx.update(predictionCampaigns).set({
            status: 'LOCKED',
            settledAt: null,
            raffleDrawnAt: null,
            correctWinnerCount: 0,
            exactScoreCount: 0,
            updatedAt: new Date(),
        }).where(eq(predictionCampaigns.id, campaign.id));
    });

    await logSuperAdminAction(c, 'SUPER_ADMIN_PREDICTION_UNSETTLED', 'PredictionCampaign', campaign.id, {
        priorStatus: campaign.status,
    });
    return c.json(apiResponse({ message: 'Campaign unsettled — entries and winners reset' }));
});

// ─── Prizes ────────────────────────────────────────────────────────

router.post('/:id/prizes', async (c) => {
    const campaign = await loadCampaign(c.req.param('id'));
    if (!campaign) return c.json(apiError('NOT_FOUND', 'Campaign not found'), 404);
    const body = await c.req.json().catch(() => null);
    const parsed = predictionPrizeInputSchema.safeParse(body);
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);

    const [prize] = await db.insert(predictionCampaignPrizes).values({
        campaignId: campaign.id,
        sortOrder: parsed.data.sortOrder ?? 0,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        imageUrl: parsed.data.imageUrl ?? null,
        imageS3Key: parsed.data.imageS3Key ?? null,
        eligibility: parsed.data.eligibility,
        drawCount: parsed.data.drawCount,
    }).returning();

    await logSuperAdminAction(c, 'SUPER_ADMIN_PREDICTION_PRIZE_ADDED', 'PredictionPrize', prize.id, {
        campaignId: campaign.id,
    });
    return c.json(apiResponse(prize), 201);
});

router.patch('/:id/prizes/:prizeId', async (c) => {
    const prizeId = c.req.param('prizeId');
    const [existing] = await db.select().from(predictionCampaignPrizes)
        .where(eq(predictionCampaignPrizes.id, prizeId)).limit(1);
    if (!existing) return c.json(apiError('NOT_FOUND', 'Prize not found'), 404);

    const body = await c.req.json().catch(() => null);
    const parsed = predictionPrizeInputSchema.partial().safeParse(body);
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);

    const updates: Partial<typeof predictionCampaignPrizes.$inferInsert> & { updatedAt: Date } = { updatedAt: new Date() };
    if (parsed.data.title !== undefined) updates.title = parsed.data.title;
    if (parsed.data.description !== undefined) updates.description = parsed.data.description ?? null;
    if (parsed.data.imageUrl !== undefined) updates.imageUrl = parsed.data.imageUrl ?? null;
    if (parsed.data.imageS3Key !== undefined) updates.imageS3Key = parsed.data.imageS3Key ?? null;
    if (parsed.data.eligibility !== undefined) updates.eligibility = parsed.data.eligibility;
    if (parsed.data.drawCount !== undefined) updates.drawCount = parsed.data.drawCount;
    if (parsed.data.sortOrder !== undefined) updates.sortOrder = parsed.data.sortOrder;

    await db.update(predictionCampaignPrizes).set(updates).where(eq(predictionCampaignPrizes.id, prizeId));
    await logSuperAdminAction(c, 'SUPER_ADMIN_PREDICTION_PRIZE_UPDATED', 'PredictionPrize', prizeId);
    return c.json(apiResponse({ message: 'Prize updated' }));
});

router.delete('/:id/prizes/:prizeId', async (c) => {
    const prizeId = c.req.param('prizeId');
    const [existing] = await db.select().from(predictionCampaignPrizes)
        .where(eq(predictionCampaignPrizes.id, prizeId)).limit(1);
    if (!existing) return c.json(apiError('NOT_FOUND', 'Prize not found'), 404);

    await db.delete(predictionCampaignPrizes).where(eq(predictionCampaignPrizes.id, prizeId));
    if (existing.imageS3Key) await deleteStorageObjects([existing.imageS3Key]).catch(() => undefined);
    await logSuperAdminAction(c, 'SUPER_ADMIN_PREDICTION_PRIZE_DELETED', 'PredictionPrize', prizeId);
    return c.json(apiResponse({ message: 'Prize deleted' }));
});

router.post('/:id/prizes/:prizeId/draw', async (c) => {
    const prizeId = c.req.param('prizeId');
    try {
        const result = await db.transaction((tx) => drawPrizeWinners(tx, prizeId, null));
        await logSuperAdminAction(c, 'SUPER_ADMIN_PREDICTION_PRIZE_DRAWN', 'PredictionPrize', prizeId, result);
        void notifyPrizeWinners(prizeId).catch(() => undefined);
        return c.json(apiResponse(result));
    } catch (err) {
        if (err instanceof PredictionLogicError) {
            return c.json(apiError(err.code, err.message), err.httpStatus as any);
        }
        throw err;
    }
});

router.post('/:id/prizes/:prizeId/redraw', async (c) => {
    const prizeId = c.req.param('prizeId');
    const body = await c.req.json().catch(() => null);
    const parsed = redrawPredictionPrizeSchema.safeParse(body);
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);

    try {
        const result = await db.transaction((tx) =>
            redrawPrizeWinners(tx, prizeId, null, parsed.data.reason, parsed.data.excludeEntryIds),
        );
        await logSuperAdminAction(c, 'SUPER_ADMIN_PREDICTION_PRIZE_REDRAWN', 'PredictionPrize', prizeId, result);
        void notifyPrizeWinners(prizeId).catch(() => undefined);
        return c.json(apiResponse(result));
    } catch (err) {
        if (err instanceof PredictionLogicError) {
            return c.json(apiError(err.code, err.message), err.httpStatus as any);
        }
        throw err;
    }
});

// ─── POST /:id/prizes/:prizeId/renotify
// Resets notifiedAt on active winners then fires notifyPrizeWinners again.
router.post('/:id/prizes/:prizeId/renotify', async (c) => {
    const prizeId = c.req.param('prizeId');
    const [prize] = await db.select({ id: predictionCampaignPrizes.id }).from(predictionCampaignPrizes)
        .where(eq(predictionCampaignPrizes.id, prizeId)).limit(1);
    if (!prize) return c.json(apiError('NOT_FOUND', 'Prize not found'), 404);

    await db.update(predictionWinners).set({
        notifiedAt: null,
        notificationChannel: null,
    }).where(and(
        eq(predictionWinners.prizeId, prizeId),
        eq(predictionWinners.isInvalidated, false),
    ));

    const result = await notifyPrizeWinners(prizeId);
    await logSuperAdminAction(c, 'SUPER_ADMIN_PREDICTION_RENOTIFY', 'PredictionPrize', prizeId, result);
    return c.json(apiResponse(result));
});

// ─── Entries / CSV / audit-log ─────────────────────────────────────

router.get('/:id/entries', async (c) => {
    const campaign = await loadCampaign(c.req.param('id'));
    if (!campaign) return c.json(apiError('NOT_FOUND', 'Campaign not found'), 404);
    const query = paginationSchema.safeParse(c.req.query());
    if (!query.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid query', query.error.issues), 400);
    const { page, limit } = query.data;
    const offset = paginationOffset(page, limit);

    const [rows, [totals]] = await Promise.all([
        db.select().from(predictionEntries)
            .where(eq(predictionEntries.campaignId, campaign.id))
            .orderBy(desc(predictionEntries.createdAt))
            .limit(limit).offset(offset),
        db.select({
            total: sql<number>`COUNT(*)::int`,
            ipCollisions: sql<number>`(SELECT COUNT(*)::int FROM (
                SELECT ip_hash FROM ${predictionEntries}
                WHERE ${predictionEntries.campaignId} = ${campaign.id}
                GROUP BY ip_hash HAVING COUNT(*) > 1
            ) c)`,
        }).from(predictionEntries).where(eq(predictionEntries.campaignId, campaign.id)),
    ]);

    return c.json(apiResponse({
        entries: rows,
        ipCollisionCount: totals.ipCollisions,
    }, paginationMeta(page, limit, totals.total)));
});

router.get('/:id/export.csv', async (c) => {
    const campaign = await loadCampaign(c.req.param('id'));
    if (!campaign) return c.json(apiError('NOT_FOUND', 'Campaign not found'), 404);
    const rows = await db.select().from(predictionEntries)
        .where(eq(predictionEntries.campaignId, campaign.id))
        .orderBy(asc(predictionEntries.createdAt));

    const winners = await db.select({ entryId: predictionWinners.entryId })
        .from(predictionWinners)
        .innerJoin(predictionCampaignPrizes, eq(predictionWinners.prizeId, predictionCampaignPrizes.id))
        .where(and(
            eq(predictionCampaignPrizes.campaignId, campaign.id),
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
            'Content-Disposition': `attachment; filename="prediction-entries-${campaign.id}.csv"`,
        },
    });
});

router.get('/:id/audit-log', async (c) => {
    const campaign = await loadCampaign(c.req.param('id'));
    if (!campaign) return c.json(apiError('NOT_FOUND', 'Campaign not found'), 404);

    const campaignLogs = await db.select().from(auditLogs)
        .where(and(
            eq(auditLogs.entityType, 'PredictionCampaign'),
            eq(auditLogs.entityId, campaign.id),
        ))
        .orderBy(desc(auditLogs.createdAt))
        .limit(200);

    // Also pull prize-level logs that belong to this campaign.
    const prizeIds = (await db.select({ id: predictionCampaignPrizes.id }).from(predictionCampaignPrizes)
        .where(eq(predictionCampaignPrizes.campaignId, campaign.id))).map((r) => r.id);

    const prizeLogs = prizeIds.length > 0
        ? await db.select().from(auditLogs)
            .where(and(
                eq(auditLogs.entityType, 'PredictionPrize'),
                sql`${auditLogs.entityId} IN ${prizeIds}`,
            ))
            .orderBy(desc(auditLogs.createdAt))
            .limit(200)
        : [];

    const merged = [...campaignLogs, ...prizeLogs].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return c.json(apiResponse(merged));
});

export default router;
