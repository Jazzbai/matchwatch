import { Hono } from 'hono';
import { db } from '../db/client';
import { matches, leagues, sports, teams, venueEvents, venues } from '../db/schema';
import { eq, and, gte, lte, desc, asc, count, inArray, or } from 'drizzle-orm';
import { apiResponse, apiError, paginationMeta, paginationOffset, haversineDistance } from '../lib/utils';
import { matchQuerySchema, matchVenueQuerySchema } from '@matchwatch/shared';
import { optionalAuthMiddleware } from '../middleware';

const matchRoutes = new Hono();

// ─── GET / ──────────────────────────────────────
matchRoutes.get('/', optionalAuthMiddleware, async (c) => {
    const query = matchQuerySchema.safeParse(c.req.query());
    if (!query.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid query parameters', query.error.issues), 400);
    }

    const { page, limit, sort, sport_id, league_id, date_from, date_to, status, has_venues } = query.data;
    const offset = paginationOffset(page, limit);

    let conditions: any[] = [];
    const now = new Date();

    if (league_id) conditions.push(eq(matches.leagueId, league_id));
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
            .orderBy(orderBy)
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
            .where(and(
                inArray(venueEvents.matchId, matchIds),
                eq(venueEvents.isActive, true),
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
        .orderBy(asc(matches.matchDateUtc))
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
        .where(and(eq(venueEvents.matchId, matchId), eq(venueEvents.isActive, true)));

    return c.json(apiResponse({
        ...row.match,
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
                averageRating: r.venue.averageRating,
                totalReviews: r.venue.totalReviews,
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
