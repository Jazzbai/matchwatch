import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/client';
import { venueCheckins, venues, matches, venueQrBanners } from '../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { apiResponse, apiError } from '../lib/utils';
import { authMiddleware, requireRole } from '../middleware';

const checkinsRoutes = new Hono();

// ─── POST /checkins — check in at a venue (QR or manual) ────

checkinsRoutes.post('/', authMiddleware, async (c) => {
    const schema = z.object({
        venueId: z.string().uuid(),
        matchId: z.string().uuid().optional(),
        source: z.enum(['qr', 'manual']).default('manual'),
    });

    const body = await c.req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.flatten().fieldErrors), 400);
    }

    const user = c.get('user');
    const { venueId, matchId, source } = parsed.data;

    // Verify venue exists
    const [venue] = await db.select({ id: venues.id, name: venues.name }).from(venues).where(eq(venues.id, venueId)).limit(1);
    if (!venue) return c.json(apiError('NOT_FOUND', 'Venue not found'), 404);

    // Insert check-in (ignore duplicate — one per user/venue/match)
    try {
        const [checkin] = await db
            .insert(venueCheckins)
            .values({ userId: user.id, venueId, matchId: matchId ?? null, source })
            .onConflictDoNothing()
            .returning();

        const alreadyCheckedIn = !checkin;
        return c.json(apiResponse({
            checkedIn: true,
            alreadyCheckedIn,
            venueName: venue.name,
        }), alreadyCheckedIn ? 200 : 201);
    } catch {
        return c.json(apiError('INTERNAL_ERROR', 'Check-in failed'), 500);
    }
});

// ─── GET /checkins/venue/:venueId — attendance list for venue ─

checkinsRoutes.get('/venue/:venueId', async (c) => {
    const { venueId } = c.req.param();
    const matchId = c.req.query('matchId');
    const limit = Math.min(100, Number(c.req.query('limit') || 50));

    const rows = await db
        .select({
            count: sql<number>`count(*)::int`,
        })
        .from(venueCheckins)
        .where(
            and(
                eq(venueCheckins.venueId, venueId),
                matchId ? eq(venueCheckins.matchId, matchId) : sql`true`,
            ),
        );

    return c.json(apiResponse({ venueId, matchId: matchId ?? null, checkins: rows[0]?.count ?? 0 }));
});

// ─── GET /checkins/qr/:venueId — QR banner info for venue ───

checkinsRoutes.get('/qr/:venueId', async (c) => {
    const { venueId } = c.req.param();
    const matchId = c.req.query('matchId');

    const [venue] = await db
        .select({ id: venues.id, name: venues.name, slug: venues.slug, coverImageUrl: venues.coverImageUrl })
        .from(venues)
        .where(eq(venues.id, venueId))
        .limit(1);

    if (!venue) return c.json(apiError('NOT_FOUND', 'Venue not found'), 404);

    let banner = null;
    const [existing] = await db.select().from(venueQrBanners).where(eq(venueQrBanners.venueId, venueId)).limit(1);

    if (!existing) {
        // Auto-create banner record
        const baseUrl = process.env.FRONTEND_URL || 'https://matchwatch.us';
        const landingUrl = matchId
            ? `${baseUrl}/checkin/${venueId}?matchId=${matchId}`
            : `${baseUrl}/checkin/${venueId}`;
        const [created] = await db
            .insert(venueQrBanners)
            .values({ venueId, landingUrl })
            .onConflictDoNothing()
            .returning();
        banner = created;
    } else {
        banner = existing;
    }

    // Upcoming match context
    let matchInfo = null;
    if (matchId) {
        const [m] = await db
            .select({
                id: matches.id,
                homeTeamName: matches.homeTeamName,
                awayTeamName: matches.awayTeamName,
                homeTeamCrestUrl: matches.homeTeamCrestUrl,
                awayTeamCrestUrl: matches.awayTeamCrestUrl,
                matchDateUtc: matches.matchDateUtc,
                status: matches.status,
            })
            .from(matches)
            .where(eq(matches.id, matchId))
            .limit(1);
        matchInfo = m ?? null;
    }

    return c.json(apiResponse({
        venue,
        banner,
        match: matchInfo,
        qrTargetUrl: banner?.landingUrl,
    }));
});

// ─── PUT /checkins/qr/:venueId — update banner (venue owner / admin) ─

checkinsRoutes.put('/qr/:venueId', authMiddleware, requireRole('VENUE_OWNER', 'BUSINESS', 'ADMIN', 'SUPER_ADMIN'), async (c) => {
    const { venueId } = c.req.param();
    const schema = z.object({
        title: z.string().max(200).optional(),
        isActive: z.boolean().optional(),
    });

    const body = await c.req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid input'), 400);

    const baseUrl = process.env.FRONTEND_URL || 'https://matchwatch.us';
    const landingUrl = `${baseUrl}/checkin/${venueId}`;

    const [banner] = await db
        .insert(venueQrBanners)
        .values({
            venueId,
            landingUrl,
            title: parsed.data.title ?? 'Scan to Predict & Win',
            isActive: parsed.data.isActive ?? true,
        })
        .onConflictDoUpdate({
            target: [venueQrBanners.venueId],
            set: {
                title: parsed.data.title ?? 'Scan to Predict & Win',
                isActive: parsed.data.isActive ?? true,
            },
        })
        .returning();

    return c.json(apiResponse(banner));
});

export default checkinsRoutes;