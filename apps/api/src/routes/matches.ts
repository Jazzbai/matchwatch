import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/client';
import { drivers, entrants, eventEntries, leagues, manufacturers, matches, sports, teams, venueEvents, venues } from '../db/schema';
import { eq, and, gte, lte, desc, asc, count, inArray, or, sql } from 'drizzle-orm';
import { apiResponse, apiError, paginationMeta, paginationOffset, haversineDistance } from '../lib/utils';
import { matchQuerySchema, matchVenueQuerySchema } from '@matchwatch/shared';
import { authMiddleware, optionalAuthMiddleware, requireRole } from '../middleware';
import { getMatchPrediction } from '../lib/predictions';
import { getYoutubeRecapTarget, processMatchYoutubeRecap, processRecentFinishedMatchRecaps } from '../lib/youtubeRecaps';

const matchRoutes = new Hono();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LEAGUE_CODE_ALIASES: Record<string, string> = {
    EPL: 'PL',
    PREMIERLEAGUE: 'PL',
    ENGLISHPREMIERLEAGUE: 'PL',
    LALIGA: 'PD',
    LA_LIGA: 'PD',
    LIGA: 'PD',
};

const youtubeRecapBatchSchema = z.object({
    limit: z.coerce.number().int().min(1).max(50).default(10),
    forceRefresh: z.coerce.boolean().default(false),
    leagueSlugs: z.array(z.string().min(1)).default(['mls']),
});
const youtubeRecapRefreshSchema = z.object({
    forceRefresh: z.coerce.boolean().default(true),
});

// ─── GET / ──────────────────────────────────────
matchRoutes.get('/', optionalAuthMiddleware, async (c) => {
    const query = matchQuerySchema.safeParse(c.req.query());
    if (!query.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid query parameters', query.error.issues), 400);
    }

    const { page, limit, sort, sport_id, league_id, league, league_ids, date_from, date_to, status, has_venues } = query.data;
    const offset = paginationOffset(page, limit);

    let conditions: any[] = [];
    const now = new Date();

    if (league_id) conditions.push(eq(matches.leagueId, league_id));
    const requestedLeagueIds = (league_ids || '')
        .split(',')
        .map((value) => value.trim())
        .filter((value) => UUID_PATTERN.test(value));
    if (requestedLeagueIds.length > 0) conditions.push(inArray(matches.leagueId, requestedLeagueIds));
    const requestedLeagueTokens = (league || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
    if (requestedLeagueTokens.length > 0) {
        const leagueMatchers = requestedLeagueTokens.map((token) => {
            const normalized = token.toLowerCase();
            const compactCode = token.toUpperCase().replace(/[^A-Z0-9]/g, '');
            const aliasedCode = LEAGUE_CODE_ALIASES[compactCode] || compactCode;
            return or(
                eq(sql`lower(${leagues.id}::text)`, normalized),
                eq(sql`lower(${leagues.slug})`, normalized),
                eq(sql`lower(${leagues.externalId})`, aliasedCode.toLowerCase()),
                eq(sql`lower(${leagues.shortName})`, normalized),
                eq(sql`lower(${leagues.name})`, normalized),
            );
        });
        conditions.push(or(...leagueMatchers));
    }
    if (sport_id) conditions.push(eq(leagues.sportId, sport_id));
    if (query.data.team_id) {
        conditions.push(or(
            eq(matches.homeTeamId, query.data.team_id),
            eq(matches.awayTeamId, query.data.team_id),
        ));
    }
    if (status) conditions.push(eq(matches.status, status));
    if (date_from) conditions.push(gte(matches.matchDateUtc, new Date(date_from)));
    if (date_to) conditions.push(lte(matches.matchDateUtc, new Date(date_to)));
    if (query.data.upcoming_only) {
        conditions.push(gte(matches.matchDateUtc, now));
        conditions.push(inArray(matches.status, ['SCHEDULED', 'TIMED', 'IN_PLAY', 'PAUSED']));
    }
    if (!query.data.include_past && !query.data.status && !query.data.date_from && !query.data.date_to) {
        conditions.push(gte(matches.matchDateUtc, new Date(now.getTime() - 2 * 60 * 60 * 1000)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const orderBy = sort === 'date_desc' ? desc(matches.matchDateUtc) : asc(matches.matchDateUtc);

    const [matchRows, [totalResult]] = await Promise.all([
        db.select({
            match: matches,
            league: leagues,
            sport: sports,
            homeTeam: teams,
        })
            .from(matches)
            .leftJoin(leagues, eq(matches.leagueId, leagues.id))
            .leftJoin(sports, eq(leagues.sportId, sports.id))
            .leftJoin(teams, eq(matches.homeTeamId, teams.id))
            .where(whereClause)
            .orderBy(desc(matches.isFeatured), orderBy)
            .limit(limit)
            .offset(offset),

        db.select({ count: count() })
            .from(matches)
            .leftJoin(leagues, eq(matches.leagueId, leagues.id))
            .where(whereClause),
    ]);

    // Get venue counts for each match
    const matchIds = matchRows.map(r => r.match.id);
    const venueCountsRaw = matchIds.length > 0
        ? await db.select({
            matchId: venueEvents.matchId,
            venueCount: count(),
        })
            .from(venueEvents)
            .innerJoin(venues, eq(venueEvents.venueId, venues.id))
            .where(and(
                inArray(venueEvents.matchId, matchIds),
                eq(venueEvents.isActive, true),
                eq(venues.isActive, true),
                eq(venues.approvalStatus, 'APPROVED'),
            ))
            .groupBy(venueEvents.matchId)
        : [];

    const venueCounts = new Map(venueCountsRaw.map(v => [v.matchId, Number(v.venueCount)]));

    const teamIds = new Set<string>();
    for (const row of matchRows) {
        if (row.match.homeTeamId) teamIds.add(row.match.homeTeamId);
        if (row.match.awayTeamId) teamIds.add(row.match.awayTeamId);
    }
    const teamRows = teamIds.size > 0
        ? await db.select({ id: teams.id, crestUrl: teams.crestUrl, name: teams.name }).from(teams).where(inArray(teams.id, Array.from(teamIds)))
        : [];
    const teamMap = new Map(teamRows.map((team) => [team.id, team]));

    const results = matchRows
        .filter((r) => {
            if (has_venues && !venueCounts.get(r.match.id)) return false;
            return true;
        })
        .map((r) => ({
            id: r.match.id,
            leagueId: r.match.leagueId,
            isFeatured: r.match.isFeatured,
            eventFormat: r.match.eventFormat,
            eventTitle: r.match.eventTitle,
            eventSubtitle: r.match.eventSubtitle,
            homeTeamId: r.match.homeTeamId,
            awayTeamId: r.match.awayTeamId,
            homeTeamName: r.match.homeTeamName || (r.match.homeTeamId ? teamMap.get(r.match.homeTeamId)?.name : null),
            awayTeamName: r.match.awayTeamName || (r.match.awayTeamId ? teamMap.get(r.match.awayTeamId)?.name : null),
            homeTeamCrestUrl: r.match.homeTeamCrestUrl || (r.match.homeTeamId ? teamMap.get(r.match.homeTeamId)?.crestUrl : null),
            awayTeamCrestUrl: r.match.awayTeamCrestUrl || (r.match.awayTeamId ? teamMap.get(r.match.awayTeamId)?.crestUrl : null),
            homeScore: r.match.homeScore,
            awayScore: r.match.awayScore,
            matchDateUtc: r.match.matchDateUtc,
            status: r.match.status,
            matchDay: r.match.matchDay,
            stage: r.match.stage,
            venueName: r.match.venueName,
            youtubeVideoId: r.match.youtubeVideoId,
            youtubeVideoTitle: r.match.youtubeVideoTitle,
            youtubeChannelTitle: r.match.youtubeChannelTitle,
            youtubePublishedAt: r.match.youtubePublishedAt,
            youtubeThumbnailUrl: r.match.youtubeThumbnailUrl,
            youtubeEmbedUrl: r.match.youtubeEmbedUrl,
            youtubeSearchStatus: r.match.youtubeSearchStatus,
            youtubeCheckedAt: r.match.youtubeCheckedAt,
            venueCount: venueCounts.get(r.match.id) || 0,
            league: r.league ? {
                id: r.league.id,
                sportId: r.league.sportId,
                name: r.league.name,
                shortName: r.league.shortName,
                logoUrl: r.league.logoUrl,
                sport: r.sport ? {
                    id: r.sport.id,
                    name: r.sport.name,
                    slug: r.sport.slug,
                    shortName: r.sport.shortName,
                } : null,
            } : null,
        }));

    c.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return c.json(apiResponse(results, paginationMeta(page, limit, totalResult?.count ?? 0)));
});

matchRoutes.get('/facets', async (c) => {
    const now = new Date();
    const includePast = c.req.query('include_past') === 'true';
    const sportId = c.req.query('sport_id');
    const baseWhere = includePast
        ? undefined
        : and(
            gte(matches.matchDateUtc, new Date(now.getTime() - 2 * 60 * 60 * 1000)),
            inArray(matches.status, ['SCHEDULED', 'TIMED', 'IN_PLAY', 'PAUSED']),
        );

    const rows = await db.select({
        leagueId: matches.leagueId,
        leagueName: leagues.name,
        leagueShortName: leagues.shortName,
        leagueLogoUrl: leagues.logoUrl,
        leagueSportId: leagues.sportId,
        sportId: sports.id,
        sportName: sports.name,
        sportSlug: sports.slug,
        sportShortName: sports.shortName,
        homeTeamId: matches.homeTeamId,
        awayTeamId: matches.awayTeamId,
    })
        .from(matches)
        .leftJoin(leagues, eq(matches.leagueId, leagues.id))
        .leftJoin(sports, eq(leagues.sportId, sports.id))
        .where(and(
            ...(baseWhere ? [baseWhere] : []),
            ...(sportId ? [eq(leagues.sportId, sportId)] : []),
        ))
        .orderBy(asc(matches.matchDateUtc))
        .limit(800);

    const teamIds = new Set<string>();
    const leagueMap = new Map<string, { id: string; sportId: string | null; name: string; shortName: string | null; logoUrl: string | null }>();
    const sportMap = new Map<string, { id: string; name: string; slug: string; shortName: string | null }>();
    for (const row of rows) {
        if (row.sportId && row.sportName && row.sportSlug) {
            sportMap.set(row.sportId, {
                id: row.sportId,
                name: row.sportName,
                slug: row.sportSlug,
                shortName: row.sportShortName,
            });
        }
        if (row.leagueId && row.leagueName) {
            leagueMap.set(row.leagueId, {
                id: row.leagueId,
                sportId: row.leagueSportId,
                name: row.leagueName,
                shortName: row.leagueShortName,
                logoUrl: row.leagueLogoUrl,
            });
        }
        if (row.homeTeamId) teamIds.add(row.homeTeamId);
        if (row.awayTeamId) teamIds.add(row.awayTeamId);
    }

    const teamRows = teamIds.size > 0
        ? await db.select({
            id: teams.id,
            name: teams.name,
            shortName: teams.shortName,
            crestUrl: teams.crestUrl,
            leagueId: teams.leagueId,
        }).from(teams).where(inArray(teams.id, Array.from(teamIds)))
        : [];

    return c.json(apiResponse({
        sports: Array.from(sportMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
        leagues: Array.from(leagueMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
        teams: teamRows.sort((a, b) => a.name.localeCompare(b.name)),
    }));
});

// ─── GET /upcoming ──────────────────────────────
matchRoutes.get('/upcoming', async (c) => {
    const now = new Date();
    const fourteenDaysLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const leagueId = c.req.query('league_id');

    const rows = await db.select({
        match: matches,
        league: leagues,
    })
        .from(matches)
        .leftJoin(leagues, eq(matches.leagueId, leagues.id))
        .where(and(
            gte(matches.matchDateUtc, now),
            lte(matches.matchDateUtc, fourteenDaysLater),
            inArray(matches.status, ['SCHEDULED', 'TIMED']),
            ...(leagueId ? [eq(matches.leagueId, leagueId)] : []),
        ))
        .orderBy(desc(matches.isFeatured), asc(matches.matchDateUtc))
        .limit(100);

    const teamIds = new Set<string>();
    for (const row of rows) {
        if (row.match.homeTeamId) teamIds.add(row.match.homeTeamId);
        if (row.match.awayTeamId) teamIds.add(row.match.awayTeamId);
    }
    const teamRows = teamIds.size > 0
        ? await db.select({ id: teams.id, crestUrl: teams.crestUrl, name: teams.name }).from(teams).where(inArray(teams.id, Array.from(teamIds)))
        : [];
    const teamMap = new Map(teamRows.map((team) => [team.id, team]));

    // Group by date
    const grouped: Record<string, any[]> = {};
    for (const row of rows) {
        const dateKey = row.match.matchDateUtc.toISOString().split('T')[0];
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push({
            id: row.match.id,
            leagueId: row.match.leagueId,
            isFeatured: row.match.isFeatured,
            eventFormat: row.match.eventFormat,
            eventTitle: row.match.eventTitle,
            eventSubtitle: row.match.eventSubtitle,
            homeTeamId: row.match.homeTeamId,
            awayTeamId: row.match.awayTeamId,
            homeTeamName: row.match.homeTeamName || (row.match.homeTeamId ? teamMap.get(row.match.homeTeamId)?.name : null),
            awayTeamName: row.match.awayTeamName || (row.match.awayTeamId ? teamMap.get(row.match.awayTeamId)?.name : null),
            homeTeamCrestUrl: row.match.homeTeamCrestUrl || (row.match.homeTeamId ? teamMap.get(row.match.homeTeamId)?.crestUrl : null),
            awayTeamCrestUrl: row.match.awayTeamCrestUrl || (row.match.awayTeamId ? teamMap.get(row.match.awayTeamId)?.crestUrl : null),
            matchDateUtc: row.match.matchDateUtc,
            status: row.match.status,
            league: row.league ? { id: row.league.id, name: row.league.name, shortName: row.league.shortName, logoUrl: row.league.logoUrl } : null,
        });
    }

    return c.json(apiResponse(grouped));
});

// ─── GET /:matchId ──────────────────────────────
matchRoutes.post('/youtube-recaps/process-recent', authMiddleware, requireRole('ADMIN', 'SUPER_ADMIN'), async (c) => {
    const parsed = youtubeRecapBatchSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid recap batch request', parsed.error.issues), 400);
    }

    const result = await processRecentFinishedMatchRecaps({
        limit: parsed.data.limit,
        forceRefresh: parsed.data.forceRefresh,
        leagueSlugs: parsed.data.leagueSlugs,
    });

    return c.json(apiResponse(result));
});

matchRoutes.post('/:matchId/youtube-recap/refresh', authMiddleware, requireRole('ADMIN', 'SUPER_ADMIN'), async (c) => {
    const matchId = c.req.param('matchId');
    const parsed = youtubeRecapRefreshSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid recap refresh request', parsed.error.issues), 400);
    }

    const result = await processMatchYoutubeRecap(matchId, { forceRefresh: parsed.data.forceRefresh });
    if (result.reason === 'match_not_found') {
        return c.json(apiError('NOT_FOUND', 'Match not found'), 404);
    }

    const recap = await getYoutubeRecapTarget(matchId);
    return c.json(apiResponse({ result, recap }));
});

matchRoutes.get('/:matchId/entries', async (c) => {
    const matchId = c.req.param('matchId');

    const [matchRow] = await db.select({
        id: matches.id,
        eventFormat: matches.eventFormat,
    }).from(matches).where(eq(matches.id, matchId)).limit(1);

    if (!matchRow) {
        return c.json(apiError('NOT_FOUND', 'Match not found'), 404);
    }

    const rows = await db.select({
        id: eventEntries.id,
        matchId: eventEntries.matchId,
        externalId: eventEntries.externalId,
        carNumber: eventEntries.carNumber,
        displayName: eventEntries.displayName,
        gridPosition: eventEntries.gridPosition,
        startPosition: eventEntries.startPosition,
        finishPosition: eventEntries.finishPosition,
        status: eventEntries.status,
        points: eventEntries.points,
        metadata: eventEntries.metadata,
        driverId: drivers.id,
        driverName: drivers.name,
        driverShortName: drivers.shortName,
        driverNationality: drivers.nationality,
        driverCountryCode: drivers.countryCode,
        driverHeadshotUrl: drivers.headshotUrl,
        entrantId: entrants.id,
        entrantName: entrants.name,
        entrantShortName: entrants.shortName,
        entrantBrandColor: entrants.brandColor,
        entrantLogoUrl: entrants.logoUrl,
        manufacturerId: manufacturers.id,
        manufacturerName: manufacturers.name,
        manufacturerShortName: manufacturers.shortName,
        manufacturerLogoUrl: manufacturers.logoUrl,
    })
        .from(eventEntries)
        .leftJoin(drivers, eq(eventEntries.driverId, drivers.id))
        .leftJoin(entrants, eq(eventEntries.entrantId, entrants.id))
        .leftJoin(manufacturers, eq(eventEntries.manufacturerId, manufacturers.id))
        .where(eq(eventEntries.matchId, matchId))
        .orderBy(
            sql`coalesce(${eventEntries.startPosition}, ${eventEntries.gridPosition}, 9999)`,
            sql`coalesce(${eventEntries.finishPosition}, 9999)`,
            asc(eventEntries.carNumber),
            asc(drivers.name),
        );

    return c.json(apiResponse(rows.map((row) => ({
        id: row.id,
        matchId: row.matchId,
        externalId: row.externalId,
        carNumber: row.carNumber,
        displayName: row.displayName,
        gridPosition: row.gridPosition,
        startPosition: row.startPosition,
        finishPosition: row.finishPosition,
        status: row.status,
        points: row.points,
        metadata: row.metadata,
        driver: row.driverId ? {
            id: row.driverId,
            name: row.driverName,
            shortName: row.driverShortName,
            nationality: row.driverNationality,
            countryCode: row.driverCountryCode,
            headshotUrl: row.driverHeadshotUrl,
        } : null,
        entrant: row.entrantId ? {
            id: row.entrantId,
            name: row.entrantName,
            shortName: row.entrantShortName,
            brandColor: row.entrantBrandColor,
            logoUrl: row.entrantLogoUrl,
        } : null,
        manufacturer: row.manufacturerId ? {
            id: row.manufacturerId,
            name: row.manufacturerName,
            shortName: row.manufacturerShortName,
            logoUrl: row.manufacturerLogoUrl,
        } : null,
        isSingleEvent: matchRow.eventFormat === 'SINGLE_EVENT',
    }))));
});

matchRoutes.get('/:matchId', async (c) => {
    const matchId = c.req.param('matchId');

    const [row] = await db.select({
        match: matches,
        league: leagues,
        homeTeam: teams,
    })
        .from(matches)
        .leftJoin(leagues, eq(matches.leagueId, leagues.id))
        .leftJoin(teams, eq(matches.homeTeamId, teams.id))
        .where(eq(matches.id, matchId))
        .limit(1);

    if (!row) {
        return c.json(apiError('NOT_FOUND', 'Match not found'), 404);
    }

    // Get away team
    let awayTeam = null;
    if (row.match.awayTeamId) {
        const [at] = await db.select().from(teams).where(eq(teams.id, row.match.awayTeamId)).limit(1);
        awayTeam = at || null;
    }

    const [venueCountResult] = await db.select({ count: count() })
        .from(venueEvents)
        .innerJoin(venues, eq(venueEvents.venueId, venues.id))
        .where(and(
            eq(venueEvents.matchId, matchId),
            eq(venueEvents.isActive, true),
            eq(venues.isActive, true),
            eq(venues.approvalStatus, 'APPROVED'),
        ));

    return c.json(apiResponse({
        ...row.match,
        isFeatured: row.match.isFeatured,
        homeTeamName: row.match.homeTeamName || row.homeTeam?.name,
        awayTeamName: row.match.awayTeamName || awayTeam?.name,
        homeTeamCrestUrl: row.match.homeTeamCrestUrl || row.homeTeam?.crestUrl || null,
        awayTeamCrestUrl: row.match.awayTeamCrestUrl || awayTeam?.crestUrl || null,
        league: row.league,
        homeTeam: row.homeTeam,
        awayTeam,
        venueCount: Number(venueCountResult?.count ?? 0),
    }));
});

matchRoutes.get('/:matchId/prediction', async (c) => {
    const matchId = c.req.param('matchId');
    const [existing] = await db.select({ id: matches.id }).from(matches).where(eq(matches.id, matchId)).limit(1);
    if (!existing) {
        return c.json(apiError('NOT_FOUND', 'Match not found'), 404);
    }

    const prediction = await getMatchPrediction(matchId);
    if (!prediction) {
        return c.json(apiError('NOT_AVAILABLE', 'Prediction is not available for this match yet'), 404);
    }

    return c.json(apiResponse(prediction));
});

// ─── GET /:matchId/venues ───────────────────────
matchRoutes.get('/:matchId/venues', async (c) => {
    const matchId = c.req.param('matchId');
    const query = matchVenueQuerySchema.safeParse(c.req.query());
    if (!query.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid query', query.error.issues), 400);
    }

    const { lat, lng, page, limit } = query.data;
    const offset = paginationOffset(page, limit);

    const rows = await db.select({
        venue: venues,
        event: venueEvents,
    })
        .from(venueEvents)
        .innerJoin(venues, eq(venueEvents.venueId, venues.id))
        .where(and(
            eq(venueEvents.matchId, matchId),
            eq(venueEvents.isActive, true),
            eq(venues.isActive, true),
            eq(venues.approvalStatus, 'APPROVED'),
        ))
        .limit(limit)
        .offset(offset);

    const [totalResult] = await db.select({ count: count() })
        .from(venueEvents)
        .innerJoin(venues, eq(venueEvents.venueId, venues.id))
        .where(and(
            eq(venueEvents.matchId, matchId),
            eq(venueEvents.isActive, true),
            eq(venues.isActive, true),
            eq(venues.approvalStatus, 'APPROVED'),
        ));

    const results = rows.map((r) => {
        const distance = lat && lng
            ? haversineDistance(lat, lng, Number(r.venue.lat), Number(r.venue.lng))
            : null;

        const spotsRemaining = r.event.bookingLimit
            ? r.event.bookingLimit - r.event.confirmedBookingsCount
            : null;

        return {
            venue: {
                id: r.venue.id,
                name: r.venue.name,
                slug: r.venue.slug,
                address: r.venue.addressLine1,
                city: r.venue.city,
                coverImageUrl: r.venue.coverImageUrl || null,
                amenities: r.venue.amenities,
                vibes: r.venue.vibes,
                cuisineTags: r.venue.cuisineTags,
                priceRange: r.venue.priceRange,
                averageRating: r.venue.ratingOverride ?? r.venue.averageRating,
                totalReviews: r.venue.reviewCountOverride ?? r.venue.totalReviews,
                isVerified: r.venue.isVerified,
                distance: distance ? `${distance.toFixed(1)} km` : null,
            },
            event: {
                id: r.event.id,
                specialNotes: r.event.specialNotes,
                customPrice: r.event.customPrice,
                doorsOpenAt: r.event.doorsOpenAt,
                spotsRemaining,
                requiresApproval: r.event.requiresApproval,
            },
        };
    });

    // Sort by distance if lat/lng provided
    if (lat && lng) {
        results.sort((a, b) => {
            const dA = parseFloat(a.venue.distance || '9999');
            const dB = parseFloat(b.venue.distance || '9999');
            return dA - dB;
        });
    }

    return c.json(apiResponse(results, paginationMeta(page, limit, Number(totalResult?.count ?? 0))));
});

export default matchRoutes;
