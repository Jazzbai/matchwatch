import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/client';
import { predictions, matches, users, venues, venueCheckins } from '../db/schema';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { apiResponse, apiError, paginationMeta, paginationOffset } from '../lib/utils';
import { authMiddleware, optionalAuthMiddleware, requireRole } from '../middleware';

const predictionsRoutes = new Hono();

// ─── Helpers ────────────────────────────────────────────────

function computePoints(match: {
    homeScore: number | null;
    awayScore: number | null;
    status: string;
}, pred: {
    predictedWinner: string;
    predictedHomeScore: number | null;
    predictedAwayScore: number | null;
}): number {
    if (match.homeScore === null || match.awayScore === null) return 0;

    const actualWinner =
        match.homeScore > match.awayScore ? 'home' :
        match.awayScore > match.homeScore ? 'away' : 'draw';

    const correctWinner = pred.predictedWinner === actualWinner;
    const correctScore =
        correctWinner &&
        pred.predictedHomeScore === match.homeScore &&
        pred.predictedAwayScore === match.awayScore;

    if (correctScore) return 2;   // Exact score
    if (correctWinner) return 1;  // Correct winner only
    return 0;
}

// ─── POST /predictions — submit a prediction ────────────────

predictionsRoutes.post('/', authMiddleware, async (c) => {
    const schema = z.object({
        matchId: z.string().uuid(),
        predictedWinner: z.enum(['home', 'away', 'draw']),
        predictedHomeScore: z.number().int().min(0).max(30).optional(),
        predictedAwayScore: z.number().int().min(0).max(30).optional(),
        venueId: z.string().uuid().optional(),
    });

    const body = await c.req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.flatten().fieldErrors), 400);
    }

    const user = c.get('user');
    const { matchId, predictedWinner, predictedHomeScore, predictedAwayScore, venueId } = parsed.data;

    // Verify match exists and is still upcoming/scheduled
    const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
    if (!match) {
        return c.json(apiError('NOT_FOUND', 'Match not found'), 404);
    }
    if (!['SCHEDULED', 'TIMED'].includes(match.status)) {
        return c.json(apiError('CONFLICT', 'Predictions are closed for this match'), 409);
    }
    if (match.matchDateUtc <= new Date()) {
        return c.json(apiError('CONFLICT', 'Match has already started — predictions are closed'), 409);
    }

    // Upsert prediction (one per user per match)
    const [prediction] = await db
        .insert(predictions)
        .values({
            userId: user.id,
            matchId,
            venueId: venueId ?? null,
            predictedWinner,
            predictedHomeScore: predictedHomeScore ?? null,
            predictedAwayScore: predictedAwayScore ?? null,
        })
        .onConflictDoUpdate({
            target: [predictions.userId, predictions.matchId],
            set: {
                predictedWinner,
                predictedHomeScore: predictedHomeScore ?? null,
                predictedAwayScore: predictedAwayScore ?? null,
                venueId: venueId ?? null,
            },
        })
        .returning();

    return c.json(apiResponse(prediction), 201);
});

// ─── GET /predictions — user's own predictions ──────────────

predictionsRoutes.get('/', authMiddleware, async (c) => {
    const user = c.get('user');
    const page = Math.max(1, Number(c.req.query('page') || 1));
    const limit = Math.min(50, Number(c.req.query('limit') || 20));
    const offset = paginationOffset(page, limit);

    const [rows, [{ count }]] = await Promise.all([
        db
            .select({
                prediction: predictions,
                match: {
                    id: matches.id,
                    homeTeamName: matches.homeTeamName,
                    awayTeamName: matches.awayTeamName,
                    homeTeamCrestUrl: matches.homeTeamCrestUrl,
                    awayTeamCrestUrl: matches.awayTeamCrestUrl,
                    matchDateUtc: matches.matchDateUtc,
                    status: matches.status,
                    homeScore: matches.homeScore,
                    awayScore: matches.awayScore,
                },
                venueName: venues.name,
                venueSlug: venues.slug,
            })
            .from(predictions)
            .leftJoin(matches, eq(predictions.matchId, matches.id))
            .leftJoin(venues, eq(predictions.venueId, venues.id))
            .where(eq(predictions.userId, user.id))
            .orderBy(desc(predictions.createdAt))
            .limit(limit)
            .offset(offset),
        db.select({ count: sql<number>`count(*)::int` }).from(predictions).where(eq(predictions.userId, user.id)),
    ]);

    return c.json(apiResponse(rows, paginationMeta(page, limit, count)));
});

// ─── GET /predictions/leaderboard — global top 100 ──────────

predictionsRoutes.get('/leaderboard', optionalAuthMiddleware, async (c) => {
    const venueId = c.req.query('venueId');
    const limit = Math.min(100, Number(c.req.query('limit') || 50));

    const rows = await db
        .select({
            userId: predictions.userId,
            name: users.name,
            avatarUrl: users.avatarUrl,
            phone: users.phone,
            totalPoints: sql<number>`sum(${predictions.points})::int`,
            predictions: sql<number>`count(*)::int`,
            correctPredictions: sql<number>`sum(case when ${predictions.points} > 0 then 1 else 0 end)::int`,
        })
        .from(predictions)
        .innerJoin(users, eq(predictions.userId, users.id))
        .where(
            and(
                eq(predictions.settled, true),
                venueId ? eq(predictions.venueId, venueId) : sql`true`,
            ),
        )
        .groupBy(predictions.userId, users.name, users.avatarUrl, users.phone)
        .orderBy(desc(sql`sum(${predictions.points})`))
        .limit(limit);

    const me = c.get('user');
    const meRow = me
        ? rows.find((r) => r.userId === me.id) ?? null
        : null;

    return c.json(apiResponse({
        leaderboard: rows.map((r, i) => ({
            rank: i + 1,
            userId: r.userId,
            name: r.name,
            avatarUrl: r.avatarUrl || null,
            displayPhone: r.phone ? `***${r.phone.slice(-4)}` : null,
            totalPoints: r.totalPoints || 0,
            predictions: r.predictions || 0,
            correctPredictions: r.correctPredictions || 0,
        })),
        myRank: meRow ? rows.indexOf(meRow) + 1 : null,
    }));
});

// ─── GET /predictions/match/:matchId — predictions for a match ─

predictionsRoutes.get('/match/:matchId', optionalAuthMiddleware, async (c) => {
    const { matchId } = c.req.param();

    const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
    if (!match) return c.json(apiError('NOT_FOUND', 'Match not found'), 404);

    // Only show aggregate stats (not individual picks) before match ends
    const showDetails = ['FINISHED'].includes(match.status);

    const [homeCount, awayCount, drawCount, totalCount] = await Promise.all([
        db.select({ c: sql<number>`count(*)::int` }).from(predictions).where(and(eq(predictions.matchId, matchId), eq(predictions.predictedWinner, 'home'))),
        db.select({ c: sql<number>`count(*)::int` }).from(predictions).where(and(eq(predictions.matchId, matchId), eq(predictions.predictedWinner, 'away'))),
        db.select({ c: sql<number>`count(*)::int` }).from(predictions).where(and(eq(predictions.matchId, matchId), eq(predictions.predictedWinner, 'draw'))),
        db.select({ c: sql<number>`count(*)::int` }).from(predictions).where(eq(predictions.matchId, matchId)),
    ]);

    const total = totalCount[0]?.c || 0;

    const me = c.get('user');
    let myPrediction = null;
    if (me) {
        const [p] = await db.select().from(predictions).where(and(eq(predictions.matchId, matchId), eq(predictions.userId, me.id))).limit(1);
        myPrediction = p ?? null;
    }

    return c.json(apiResponse({
        matchId,
        total,
        homePct: total ? Math.round((homeCount[0]?.c || 0) / total * 100) : 0,
        awayPct: total ? Math.round((awayCount[0]?.c || 0) / total * 100) : 0,
        drawPct: total ? Math.round((drawCount[0]?.c || 0) / total * 100) : 0,
        myPrediction,
    }));
});

// ─── POST /predictions/admin/settle/:matchId — settle after result ─

predictionsRoutes.post('/admin/settle/:matchId', authMiddleware, requireRole('ADMIN', 'SUPER_ADMIN'), async (c) => {
    const { matchId } = c.req.param();

    const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
    if (!match) return c.json(apiError('NOT_FOUND', 'Match not found'), 404);
    if (match.homeScore === null || match.awayScore === null) {
        return c.json(apiError('CONFLICT', 'Match has no score yet'), 409);
    }

    // Get all unsettled predictions for this match
    const unsettled = await db
        .select()
        .from(predictions)
        .where(and(eq(predictions.matchId, matchId), eq(predictions.settled, false)));

    let settled = 0;
    for (const pred of unsettled) {
        const pts = computePoints(
            { homeScore: match.homeScore, awayScore: match.awayScore, status: match.status },
            pred,
        );
        // Bonus +1 if user was checked in at their chosen venue
        let bonus = 0;
        if (pred.venueId) {
            const [checkin] = await db
                .select()
                .from(venueCheckins)
                .where(and(eq(venueCheckins.userId, pred.userId), eq(venueCheckins.venueId, pred.venueId), eq(venueCheckins.matchId, matchId)))
                .limit(1);
            if (checkin) bonus = 1;
        }

        await db
            .update(predictions)
            .set({ points: pts + bonus, settled: true })
            .where(eq(predictions.id, pred.id));
        settled++;
    }

    return c.json(apiResponse({ settled, matchId }));
});

export default predictionsRoutes;