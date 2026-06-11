/**
 * Settle + draw + redraw algorithms for venue prediction campaigns.
 *
 * All three functions take a Drizzle transaction handle and assume the caller
 * has already opened a transaction with `SELECT FOR UPDATE` on the campaign
 * row (and the prize row, for draw/redraw). They throw on validation errors;
 * the caller maps to HTTP responses.
 *
 * Random pick uses node:crypto's `randomInt` for cryptographic-quality
 * fairness. Math.random is biased and not appropriate for raffle outcomes.
 */

import { randomInt } from 'node:crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { db as DbType } from '../db/client';
import {
    matches,
    predictionCampaigns,
    predictionCampaignPrizes,
    predictionEntries,
    predictionWinners,
} from '../db/schema';
import {
    computeActualWinner,
    pointsForEntry,
    type PredictionPrizeEligibility,
} from './predictionStatus';

type Db = typeof DbType;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export class PredictionLogicError extends Error {
    code: string;
    httpStatus: number;
    constructor(code: string, message: string, httpStatus = 409) {
        super(message);
        this.code = code;
        this.httpStatus = httpStatus;
    }
}

// ─── Settle ─────────────────────────────────────────────────────────

export async function settleCampaign(tx: Tx, campaignId: string) {
    const [campaign] = await tx.select().from(predictionCampaigns)
        .where(eq(predictionCampaigns.id, campaignId))
        .for('update')
        .limit(1);
    if (!campaign) throw new PredictionLogicError('NOT_FOUND', 'Campaign not found', 404);
    if (campaign.status !== 'OPEN' && campaign.status !== 'LOCKED') {
        throw new PredictionLogicError('INVALID_STATE', `Cannot settle a campaign in status ${campaign.status}`);
    }

    const [match] = await tx.select().from(matches).where(eq(matches.id, campaign.matchId)).limit(1);
    if (!match) throw new PredictionLogicError('NOT_FOUND', 'Match not found', 404);
    if (match.status !== 'FINISHED' || match.homeScore == null || match.awayScore == null) {
        throw new PredictionLogicError('INVALID_STATE', 'Match must be FINISHED with scores recorded before settling');
    }

    const actualWinner = computeActualWinner(match.homeScore, match.awayScore);
    const entries = await tx.select().from(predictionEntries)
        .where(and(eq(predictionEntries.campaignId, campaignId), sql`${predictionEntries.settledAt} IS NULL`));

    let correctCount = 0;
    let exactCount = 0;

    for (const entry of entries) {
        const isCorrectWinner = entry.predictedWinner === actualWinner;
        const isExactScore = isCorrectWinner
            && entry.predictedHomeScore != null
            && entry.predictedAwayScore != null
            && entry.predictedHomeScore === match.homeScore
            && entry.predictedAwayScore === match.awayScore;
        const points = pointsForEntry(isCorrectWinner, isExactScore, campaign.pointsCorrectWinner, campaign.pointsExactScore);

        await tx.update(predictionEntries).set({
            isCorrectWinner,
            isExactScore,
            points,
            settledAt: new Date(),
        }).where(eq(predictionEntries.id, entry.id));

        if (isCorrectWinner) correctCount++;
        if (isExactScore) exactCount++;
    }

    // Recount across the whole campaign (idempotent — already-settled entries
    // weren't touched, but their counters need to roll into the new total).
    const [aggregates] = await tx.select({
        correct: sql<number>`COUNT(*) FILTER (WHERE ${predictionEntries.isCorrectWinner} = true)`.mapWith(Number),
        exact: sql<number>`COUNT(*) FILTER (WHERE ${predictionEntries.isExactScore} = true)`.mapWith(Number),
    }).from(predictionEntries).where(eq(predictionEntries.campaignId, campaignId));

    await tx.update(predictionCampaigns).set({
        status: 'SETTLED',
        settledAt: new Date(),
        correctWinnerCount: aggregates.correct,
        exactScoreCount: aggregates.exact,
        updatedAt: new Date(),
    }).where(eq(predictionCampaigns.id, campaignId));

    return {
        settledEntries: entries.length,
        correctWinnerCount: aggregates.correct,
        exactScoreCount: aggregates.exact,
        newlyCorrect: correctCount,
        newlyExact: exactCount,
    };
}

// ─── Draw a single prize ───────────────────────────────────────────

function buildEligibilityFilter(eligibility: PredictionPrizeEligibility) {
    if (eligibility === 'CORRECT_WINNER') return eq(predictionEntries.isCorrectWinner, true);
    if (eligibility === 'EXACT_SCORE') return eq(predictionEntries.isExactScore, true);
    return sql`true`;
}

export async function drawPrizeWinners(tx: Tx, prizeId: string, actorUserId: string | null, excludeEntryIds: string[] = []) {
    const [prize] = await tx.select().from(predictionCampaignPrizes)
        .where(eq(predictionCampaignPrizes.id, prizeId))
        .for('update')
        .limit(1);
    if (!prize) throw new PredictionLogicError('NOT_FOUND', 'Prize not found', 404);
    if (prize.drawnAt) throw new PredictionLogicError('ALREADY_DRAWN', 'Prize has already been drawn — use redraw');

    const [campaign] = await tx.select().from(predictionCampaigns)
        .where(eq(predictionCampaigns.id, prize.campaignId))
        .for('update')
        .limit(1);
    if (!campaign) throw new PredictionLogicError('NOT_FOUND', 'Campaign not found', 404);
    if (campaign.status !== 'SETTLED' && campaign.status !== 'DRAWN') {
        throw new PredictionLogicError('INVALID_STATE', 'Campaign must be SETTLED before drawing prizes');
    }

    // Build the eligible pool. Exclude entries that have already won this
    // prize (active winners only) and any caller-supplied exclusions.
    const eligibilityCondition = buildEligibilityFilter(prize.eligibility);
    const excludeFilter = excludeEntryIds.length > 0
        ? sql`AND ${predictionEntries.id} NOT IN ${excludeEntryIds}`
        : sql``;

    const pool = await tx.select({ id: predictionEntries.id })
        .from(predictionEntries)
        .where(and(
            eq(predictionEntries.campaignId, campaign.id),
            eligibilityCondition,
            sql`NOT EXISTS (
                SELECT 1 FROM ${predictionWinners}
                WHERE ${predictionWinners.prizeId} = ${prize.id}
                  AND ${predictionWinners.entryId} = ${predictionEntries.id}
                  AND ${predictionWinners.isInvalidated} = false
            )`,
            excludeEntryIds.length > 0
                ? sql`${predictionEntries.id} NOT IN ${excludeEntryIds}`
                : sql`true`,
        ));

    void excludeFilter; // keep helper readable; the actual exclude is inline above

    const poolIds = pool.map((p) => p.id);
    const pickCount = Math.min(prize.drawCount, poolIds.length);
    const winners: string[] = [];

    // Fisher–Yates-style picking with crypto.randomInt to avoid Math.random bias.
    const remaining = poolIds.slice();
    for (let i = 0; i < pickCount; i++) {
        const idx = randomInt(0, remaining.length);
        winners.push(remaining[idx]);
        remaining.splice(idx, 1);
    }

    if (winners.length > 0) {
        await tx.insert(predictionWinners).values(
            winners.map((entryId) => ({ prizeId: prize.id, entryId, drawnBy: actorUserId })),
        );
    }

    await tx.update(predictionCampaignPrizes).set({
        drawnAt: new Date(),
        drawnBy: actorUserId,
        updatedAt: new Date(),
    }).where(eq(predictionCampaignPrizes.id, prize.id));

    // If every prize for this campaign is now drawn, flip the campaign to DRAWN.
    const [{ undrawn }] = await tx.select({
        undrawn: sql<number>`COUNT(*)::int`,
    }).from(predictionCampaignPrizes)
        .where(and(
            eq(predictionCampaignPrizes.campaignId, campaign.id),
            sql`${predictionCampaignPrizes.drawnAt} IS NULL`,
        ));

    if (undrawn === 0 && campaign.status !== 'DRAWN') {
        await tx.update(predictionCampaigns).set({
            status: 'DRAWN',
            raffleDrawnAt: new Date(),
            updatedAt: new Date(),
        }).where(eq(predictionCampaigns.id, campaign.id));
    }

    return {
        prizeId: prize.id,
        winnerEntryIds: winners,
        poolSize: poolIds.length,
        pickedCount: winners.length,
        campaignFullyDrawn: undrawn === 0,
    };
}

// ─── Redraw a prize ────────────────────────────────────────────────

export async function redrawPrizeWinners(
    tx: Tx,
    prizeId: string,
    actorUserId: string | null,
    reason: string,
    excludeEntryIds: string[] = [],
) {
    const [prize] = await tx.select().from(predictionCampaignPrizes)
        .where(eq(predictionCampaignPrizes.id, prizeId))
        .for('update')
        .limit(1);
    if (!prize) throw new PredictionLogicError('NOT_FOUND', 'Prize not found', 404);

    // Soft-invalidate any active winners for this prize. The previous winners
    // are added to the exclusion list by default so they don't immediately
    // get redrawn unless the caller explicitly omits them.
    const activeWinners = await tx.select({
        id: predictionWinners.id,
        entryId: predictionWinners.entryId,
    }).from(predictionWinners)
        .where(and(eq(predictionWinners.prizeId, prize.id), eq(predictionWinners.isInvalidated, false)));

    if (activeWinners.length > 0) {
        await tx.update(predictionWinners).set({
            isInvalidated: true,
            invalidatedAt: new Date(),
            invalidatedReason: reason,
        }).where(inArray(predictionWinners.id, activeWinners.map((w) => w.id)));
    }

    // Reset the drawn timestamps so drawPrizeWinners accepts it again.
    await tx.update(predictionCampaignPrizes).set({
        drawnAt: null,
        drawnBy: null,
        updatedAt: new Date(),
    }).where(eq(predictionCampaignPrizes.id, prize.id));

    // Roll the campaign back to SETTLED if it was DRAWN, so the redraw is
    // visible in status.
    await tx.update(predictionCampaigns).set({
        status: 'SETTLED',
        raffleDrawnAt: null,
        updatedAt: new Date(),
    }).where(and(
        eq(predictionCampaigns.id, prize.campaignId),
        eq(predictionCampaigns.status, 'DRAWN'),
    ));

    const mergedExclude = Array.from(new Set([
        ...excludeEntryIds,
        ...activeWinners.map((w) => w.entryId),
    ]));

    const result = await drawPrizeWinners(tx, prize.id, actorUserId, mergedExclude);
    return {
        ...result,
        invalidatedEntryIds: activeWinners.map((w) => w.entryId),
        reason,
    };
}
