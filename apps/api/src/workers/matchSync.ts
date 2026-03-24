import { Queue, Worker } from 'bullmq';
import { redis } from '../lib/redis';
import { db } from '../db/client';
import { sports, leagues, matches, teams, syncHistory } from '../db/schema';
import { and, eq, lt, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';

const QUEUE_NAME = 'matchSync';
const FOOTBALL_DATA_BASE = 'https://api.football-data.org/v4';
const API_FOOTBALL_BASE = process.env.API_FOOTBALL_BASE_URL || 'https://v3.football.api-sports.io';
const THE_SPORTS_DB_BASE = process.env.THE_SPORTS_DB_BASE_URL
    || `https://www.thesportsdb.com/api/v1/json/${process.env.THE_SPORTS_DB_API_KEY?.trim() || '3'}`;
const FOOTBALL_DATA_SUPPORTED_CODES = new Set(['WC', 'PL', 'PD', 'BL1', 'SA', 'FL1', 'CL', 'MLS']);
const THE_SPORTS_DB_PRIORITY_LEAGUE_CODES = new Set(['NWSL', 'LMX']);
const THE_SPORTS_DB_LEAGUE_IDS: Record<string, number> = {
    PL: 4328,
    PD: 4335,
    BL1: 4331,
    SA: 4332,
    FL1: 4334,
    CL: 4480,
    MLS: 4346,
    NWSL: 4521,
    LMX: 4350,
};

type MatchSyncProvider = 'FOOTBALL_DATA' | 'API_FOOTBALL' | 'THE_SPORTS_DB';
type MatchStatus = 'SCHEDULED' | 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'POSTPONED' | 'CANCELLED' | 'SUSPENDED';
type LeagueRow = typeof leagues.$inferSelect;

type SyncResult = {
    fetched: number;
    upserted: number;
    errors: number;
    teamsUpserted: number;
    skipped?: boolean;
    restricted?: boolean;
};

type MatchSyncRunOptions = {
    providerOverride?: MatchSyncProvider;
    sportSlug?: string;
    writeHistory?: boolean;
};

interface FootballDataMatch {
    id: number;
    homeTeam: { id: number; name: string; shortName: string; crest: string };
    awayTeam: { id: number; name: string; shortName: string; crest: string };
    utcDate: string;
    status: string;
    matchday: number;
    stage: string;
    score: { fullTime: { home: number | null; away: number | null } };
    venue: string | null;
}

interface FootballDataResponse {
    matches: FootballDataMatch[];
}

interface FootballDataTeam {
    id: number;
    name: string;
    shortName: string;
    crest: string | null;
}

interface FootballDataTeamsResponse {
    teams: FootballDataTeam[];
}

interface ApiFootballLeague {
    league: { id: number; name: string; logo?: string | null };
    country?: { name?: string | null };
    seasons: Array<{ year: number; current?: boolean }>;
}

interface ApiFootballLeaguesResponse {
    response: ApiFootballLeague[];
}

interface ApiFootballFixture {
    fixture: {
        id: number;
        date: string;
        status: { short: string; long: string };
        venue?: { name?: string | null } | null;
    };
    league: {
        id: number;
        name: string;
        logo?: string | null;
        round?: string | null;
    };
    teams: {
        home: { id: number; name: string; logo?: string | null };
        away: { id: number; name: string; logo?: string | null };
    };
    goals: {
        home: number | null;
        away: number | null;
    };
}

interface ApiFootballFixturesResponse {
    response: ApiFootballFixture[];
}

interface TheSportsDbLeagueLookupResponse {
    leagues?: Array<{
        idLeague: string;
        strCurrentSeason?: string | null;
        strBadge?: string | null;
    }>;
}

interface TheSportsDbEventsSeasonResponse {
    events?: Array<{
        idEvent: string;
        strLeague?: string | null;
        strHomeTeam?: string | null;
        strAwayTeam?: string | null;
        idHomeTeam?: string | null;
        idAwayTeam?: string | null;
        strHomeTeamBadge?: string | null;
        strAwayTeamBadge?: string | null;
        dateEvent?: string | null;
        strTime?: string | null;
        strTimestamp?: string | null;
        intRound?: string | number | null;
        strStatus?: string | null;
        intHomeScore?: string | number | null;
        intAwayScore?: string | number | null;
        strVenue?: string | null;
    }>;
}

let matchSyncQueueInstance: Queue | null = null;

export function getMatchSyncQueue() {
    if (!matchSyncQueueInstance) {
        matchSyncQueueInstance = new Queue(QUEUE_NAME, {
            connection: redis,
            defaultJobOptions: {
                attempts: 3,
                backoff: { type: 'exponential', delay: 5000 },
                removeOnComplete: 100,
                removeOnFail: 50,
            },
        });
    }
    return matchSyncQueueInstance;
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function resolveMatchSyncProvider(rawProvider = process.env.MATCH_SYNC_PROVIDER || ''): MatchSyncProvider {
    const raw = rawProvider.trim().toUpperCase();
    if (raw === 'API_FOOTBALL' || raw === 'API-FOOTBALL') return 'API_FOOTBALL';
    if (raw === 'FOOTBALL_DATA') return 'FOOTBALL_DATA';
    if (raw === 'THE_SPORTS_DB' || raw === 'THESPORTSDB') return 'THE_SPORTS_DB';
    if (process.env.API_FOOTBALL_API_KEY) return 'API_FOOTBALL';
    if (process.env.FOOTBALL_DATA_API_KEY) return 'FOOTBALL_DATA';
    return 'THE_SPORTS_DB';
}

function resolveProvider(): MatchSyncProvider {
    return resolveMatchSyncProvider();
}

const teamLookupCache = new Map<string, string | null>();

function teamCacheKey(externalId: string) {
    return externalId.trim();
}

async function getTeamIdByExternalId(externalId: string) {
    const key = teamCacheKey(externalId);
    if (teamLookupCache.has(key)) return teamLookupCache.get(key) ?? null;
    const [row] = await db.select({ id: teams.id }).from(teams).where(eq(teams.externalId, key)).limit(1);
    const id = row?.id ?? null;
    teamLookupCache.set(key, id);
    return id;
}

async function getTeamIdByLeagueAndName(leagueId: string, teamName: string) {
    const [row] = await db.select({ id: teams.id })
        .from(teams)
        .where(and(
            eq(teams.leagueId, leagueId),
            sql`lower(${teams.name}) = lower(${teamName})`,
        ))
        .limit(1);
    return row?.id ?? null;
}

async function applyTeamMetadata(teamId: string, input: { shortName?: string | null; crestUrl?: string | null }) {
    const updates: Record<string, string> = {};
    const safeShortName = trimText(input.shortName || '', 30);
    const safeCrestUrl = trimText(input.crestUrl || '', 1000);

    if (safeShortName) updates.shortName = safeShortName;
    if (safeCrestUrl) updates.crestUrl = safeCrestUrl;
    if (Object.keys(updates).length === 0) return;

    await db.update(teams).set(updates).where(eq(teams.id, teamId));
}

function clearSyncCaches() {
    teamLookupCache.clear();
}

function parseTheSportsDbDateTime(dateEvent?: string | null, strTime?: string | null, strTimestamp?: string | null) {
    if (strTimestamp) {
        const parsed = new Date(strTimestamp);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    if (!dateEvent) return null;
    const composed = strTime ? `${dateEvent}T${strTime}Z` : `${dateEvent}T00:00:00Z`;
    const parsed = new Date(composed);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
}

function mapTheSportsDbStatus(event: NonNullable<TheSportsDbEventsSeasonResponse['events']>[number], matchDate: Date): MatchStatus {
    const now = Date.now();
    const statusText = (event.strStatus || '').toUpperCase();
    if (statusText.includes('IN PLAY') || statusText.includes('LIVE')) return 'IN_PLAY';
    if (statusText.includes('HALF')) return 'PAUSED';
    if (event.intHomeScore !== null && event.intAwayScore !== null && event.intHomeScore !== undefined && event.intAwayScore !== undefined) {
        return 'FINISHED';
    }
    if (matchDate.getTime() < now - 3 * 60 * 60 * 1000) return 'FINISHED';
    return 'SCHEDULED';
}

async function fetchTheSportsDb<T>(endpoint: string, params: Record<string, string | number | undefined>) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') continue;
        query.set(key, String(value));
    }
    const suffix = query.toString();
    const url = `${THE_SPORTS_DB_BASE}${endpoint}${suffix ? `?${suffix}` : ''}`;
    return fetchJsonWithRetry<T>(url, {}, 'the-sports-db');
}

async function fetchTheSportsDbSeason(leagueId: number) {
    const league = await fetchTheSportsDb<TheSportsDbLeagueLookupResponse>('/lookupleague.php', { id: leagueId });
    const season = league?.leagues?.[0]?.strCurrentSeason || String(new Date().getUTCFullYear());
    const logoUrl = league?.leagues?.[0]?.strBadge || null;
    return { season, logoUrl };
}

async function syncLeagueFromTheSportsDb(league: LeagueRow): Promise<SyncResult> {
    const result: SyncResult = { fetched: 0, upserted: 0, errors: 0, teamsUpserted: 0 };
    const externalId = (league.externalId || '').trim().toUpperCase();
    const sourceLeagueId = THE_SPORTS_DB_LEAGUE_IDS[externalId];
    if (!sourceLeagueId) {
        result.skipped = true;
        return result;
    }

    try {
        const { season, logoUrl } = await fetchTheSportsDbSeason(sourceLeagueId);
        if (logoUrl && league.logoUrl !== logoUrl) {
            await db.update(leagues).set({ logoUrl }).where(eq(leagues.id, league.id));
        }
        const [nextData, pastData, seasonData] = await Promise.all([
            fetchTheSportsDb<TheSportsDbEventsSeasonResponse>('/eventsnextleague.php', { id: sourceLeagueId }),
            fetchTheSportsDb<TheSportsDbEventsSeasonResponse>('/eventspastleague.php', { id: sourceLeagueId }),
            fetchTheSportsDb<TheSportsDbEventsSeasonResponse>('/eventsseason.php', { id: sourceLeagueId, s: season }),
        ]);

        // Free TheSportsDB returns limited rows. Combine next+past for better coverage,
        // and fallback to season rows if those endpoints are empty.
        const merged = [
            ...(nextData?.events || []),
            ...(pastData?.events || []),
            ...(seasonData?.events || []),
        ];
        const deduped = new Map<string, NonNullable<TheSportsDbEventsSeasonResponse['events']>[number]>();
        for (const item of merged) {
            if (!item?.idEvent) continue;
            if (!deduped.has(item.idEvent)) deduped.set(item.idEvent, item);
        }
        const events = Array.from(deduped.values());
        result.fetched = events.length;

        const now = Date.now();
        const minTs = now - 14 * 24 * 60 * 60 * 1000;
        const maxTs = now + 60 * 24 * 60 * 60 * 1000;

        for (const event of events) {
            try {
                if (!event.idEvent || !event.strHomeTeam || !event.strAwayTeam) continue;
                const matchDate = parseTheSportsDbDateTime(event.dateEvent, event.strTime, event.strTimestamp);
                if (!matchDate) continue;

                const eventTs = matchDate.getTime();
                if (eventTs < minTs || eventTs > maxTs) continue;

                // Namespace IDs by source league to avoid cross-league overwrite when
                // provider returns duplicated event/team IDs across different league endpoints.
                const homeExternal = `TSD-${sourceLeagueId}-${event.idHomeTeam || `HOME-${event.idEvent}`}`;
                const awayExternal = `TSD-${sourceLeagueId}-${event.idAwayTeam || `AWAY-${event.idEvent}`}`;

                const home = await upsertTeamRecord({
                    leagueId: league.id,
                    name: event.strHomeTeam,
                    shortName: event.strHomeTeam,
                    externalId: homeExternal,
                    crestUrl: event.strHomeTeamBadge || null,
                });
                const away = await upsertTeamRecord({
                    leagueId: league.id,
                    name: event.strAwayTeam,
                    shortName: event.strAwayTeam,
                    externalId: awayExternal,
                    crestUrl: event.strAwayTeamBadge || null,
                });

                if (home.created) result.teamsUpserted += 1;
                if (away.created) result.teamsUpserted += 1;

                await upsertMatchRecord({
                    leagueId: league.id,
                    externalMatchId: `TSD-${sourceLeagueId}-${event.idEvent}`,
                    homeTeamId: home.id,
                    awayTeamId: away.id,
                    homeTeamName: event.strHomeTeam,
                    awayTeamName: event.strAwayTeam,
                    homeTeamCrestUrl: event.strHomeTeamBadge || null,
                    awayTeamCrestUrl: event.strAwayTeamBadge || null,
                    matchDateUtc: matchDate,
                    status: mapTheSportsDbStatus(event, matchDate),
                    matchDay: event.intRound ? Number(event.intRound) || null : null,
                    stage: null,
                    homeScore: event.intHomeScore !== null && event.intHomeScore !== undefined ? Number(event.intHomeScore) : null,
                    awayScore: event.intAwayScore !== null && event.intAwayScore !== undefined ? Number(event.intAwayScore) : null,
                    venueName: event.strVenue || null,
                });
                result.upserted += 1;
            } catch (err) {
                result.errors += 1;
                logger.error({ league: league.name, eventId: event.idEvent, err }, 'Failed upserting TheSportsDB event');
            }
        }
    } catch (err) {
        result.errors += 1;
        logger.error({ league: league.name, err }, 'Failed syncing league from TheSportsDB');
    }

    return result;
}

function trimText(value: string | null | undefined, maxLength: number) {
    if (!value) return '';
    return value.slice(0, maxLength);
}

function mapFootballDataStatus(apiStatus: string): MatchStatus {
    const validStatuses = new Set<MatchStatus>([
        'SCHEDULED',
        'TIMED',
        'IN_PLAY',
        'PAUSED',
        'FINISHED',
        'POSTPONED',
        'CANCELLED',
        'SUSPENDED',
    ]);
    if (validStatuses.has(apiStatus as MatchStatus)) return apiStatus as MatchStatus;
    return 'SCHEDULED';
}

function mapApiFootballStatus(shortStatus: string): MatchStatus {
    if (['1H', '2H', 'ET', 'BT', 'LIVE'].includes(shortStatus)) return 'IN_PLAY';
    if (shortStatus === 'HT') return 'PAUSED';
    if (['FT', 'AET', 'PEN'].includes(shortStatus)) return 'FINISHED';
    if (shortStatus === 'PST') return 'POSTPONED';
    if (shortStatus === 'CANC') return 'CANCELLED';
    if (['SUSP', 'INT', 'ABD', 'AWD', 'WO'].includes(shortStatus)) return 'SUSPENDED';
    return 'SCHEDULED';
}

function parseMatchDay(round?: string | null): number | null {
    if (!round) return null;
    const m = round.match(/(\d+)/);
    return m ? Number(m[1]) : null;
}

async function upsertTeamRecord(input: {
    leagueId: string;
    name: string;
    shortName?: string | null;
    externalId: string;
    crestUrl?: string | null;
}): Promise<{ id: string | null; created: boolean }> {
    const safeExternalId = trimText(input.externalId, 20);
    if (!safeExternalId || !input.name) return { id: null, created: false };

    const cached = await getTeamIdByExternalId(safeExternalId);
    if (cached) {
        await applyTeamMetadata(cached, input);
        return { id: cached, created: false };
    }

    const matchedByName = await getTeamIdByLeagueAndName(input.leagueId, input.name);
    if (matchedByName) {
        teamLookupCache.set(safeExternalId, matchedByName);
        await applyTeamMetadata(matchedByName, input);
        return { id: matchedByName, created: false };
    }

    const inserted = await db.insert(teams).values({
        name: trimText(input.name, 150),
        shortName: trimText(input.shortName || input.name, 30),
        externalId: safeExternalId,
        crestUrl: trimText(input.crestUrl || '', 1000) || null,
        leagueId: input.leagueId,
    }).onConflictDoNothing().returning({ id: teams.id });

    const id = inserted[0]?.id || await getTeamIdByExternalId(safeExternalId);
    if (id) teamLookupCache.set(safeExternalId, id);
    return { id: id ?? null, created: inserted.length > 0 };
}

async function upsertMatchRecord(input: {
    leagueId: string;
    externalMatchId: string;
    homeTeamId: string | null;
    awayTeamId: string | null;
    homeTeamName: string;
    awayTeamName: string;
    homeTeamCrestUrl?: string | null;
    awayTeamCrestUrl?: string | null;
    matchDateUtc: Date;
    status: MatchStatus;
    matchDay: number | null;
    stage: string | null;
    homeScore: number | null;
    awayScore: number | null;
    venueName: string | null;
}) {
    const safeExternalMatchId = trimText(input.externalMatchId, 50);
    if (!safeExternalMatchId) return;

    const payload = {
        leagueId: input.leagueId,
        externalMatchId: safeExternalMatchId,
        homeTeamId: input.homeTeamId || undefined,
        awayTeamId: input.awayTeamId || undefined,
        homeTeamName: trimText(input.homeTeamName, 150),
        awayTeamName: trimText(input.awayTeamName, 150),
        homeTeamCrestUrl: trimText(input.homeTeamCrestUrl || '', 1000) || null,
        awayTeamCrestUrl: trimText(input.awayTeamCrestUrl || '', 1000) || null,
        matchDateUtc: input.matchDateUtc,
        status: input.status,
        matchDay: input.matchDay ?? null,
        stage: trimText(input.stage || '', 50) || null,
        homeScore: input.homeScore,
        awayScore: input.awayScore,
        venueName: trimText(input.venueName || '', 200) || null,
        lastSyncedAt: new Date(),
    };

    await db.insert(matches).values(payload).onConflictDoUpdate({
        target: matches.externalMatchId,
        set: { ...payload, updatedAt: new Date() },
    });
}

async function fetchJsonWithRetry<T>(url: string, headers: Record<string, string>, source: string, attempt = 0): Promise<T | null> {
    const response = await fetch(url, { headers });
    if (response.status === 429 && attempt < 3) {
        const retryHeader = response.headers.get('Retry-After')
            || response.headers.get('X-RequestCounter-Reset')
            || '20';
        const retrySeconds = Number.parseInt(retryHeader, 10) || 20;
        logger.warn({ source, retrySeconds, attempt }, 'Rate limited, waiting before retry');
        await sleep(retrySeconds * 1000);
        return fetchJsonWithRetry<T>(url, headers, source, attempt + 1);
    }

    if (!response.ok) {
        const body = await response.text();
        logger.error({ source, url, status: response.status, body }, 'Match sync provider request failed');
        return null;
    }

    return response.json() as Promise<T>;
}

async function fetchFootballDataMatches(competitionCode: string, apiKey: string): Promise<FootballDataMatch[]> {
    const now = new Date();
    const dateFrom = now.toISOString().split('T')[0];
    const dateTo = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const url = `${FOOTBALL_DATA_BASE}/competitions/${competitionCode}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;

    logger.info({ competitionCode, dateFrom, dateTo }, 'Fetching matches from Football-Data');
    const data = await fetchJsonWithRetry<FootballDataResponse>(url, { 'X-Auth-Token': apiKey }, 'football-data');
    return data?.matches || [];
}

export async function fetchFootballDataCompetitionTeams(competitionCode: string, apiKey: string): Promise<FootballDataTeam[]> {
    const url = `${FOOTBALL_DATA_BASE}/competitions/${competitionCode}/teams`;
    logger.info({ competitionCode }, 'Fetching teams from Football-Data');
    const data = await fetchJsonWithRetry<FootballDataTeamsResponse>(url, { 'X-Auth-Token': apiKey }, 'football-data');
    return data?.teams || [];
}

async function fetchApiFootball<T>(
    endpoint: string,
    params: Record<string, string | number | boolean | undefined>,
    apiKey: string,
): Promise<T | null> {
    const query = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null || v === '') continue;
        query.set(k, String(v));
    }
    const url = `${API_FOOTBALL_BASE}${endpoint}?${query.toString()}`;
    return fetchJsonWithRetry<T>(url, { 'x-apisports-key': apiKey }, 'api-football');
}

function pickApiFootballLeague(candidates: ApiFootballLeague[], league: LeagueRow) {
    const wantedName = league.name.toLowerCase();
    const wantedShort = (league.shortName || '').toLowerCase();
    const wantedCountry = (league.country || '').toLowerCase();

    return candidates
        .map((candidate) => {
            let score = 0;
            const candidateName = (candidate.league.name || '').toLowerCase();
            const candidateCountry = (candidate.country?.name || '').toLowerCase();
            if (candidateName === wantedName) score += 4;
            if (wantedShort && candidateName.includes(wantedShort)) score += 2;
            if (wantedCountry && (candidateCountry.includes(wantedCountry) || wantedCountry.includes(candidateCountry))) {
                score += 3;
            }
            if (candidate.seasons.some((s) => s.current)) score += 1;
            return { candidate, score };
        })
        .sort((a, b) => b.score - a.score)[0]?.candidate;
}

function pickSeason(c: ApiFootballLeague) {
    const currentSeason = c.seasons.find((s) => s.current);
    if (currentSeason) return currentSeason.year;
    if (c.seasons.length === 0) return new Date().getUTCFullYear();
    return Math.max(...c.seasons.map((s) => s.year));
}

const apiFootballLeagueCache = new Map<string, { leagueId: number; season: number; logoUrl?: string | null } | null>();

async function resolveApiFootballLeague(league: LeagueRow, apiKey: string) {
    const cached = apiFootballLeagueCache.get(league.id);
    if (cached !== undefined) return cached;

    const externalId = (league.externalId || '').trim();
    const candidates: ApiFootballLeague[] = [];
    const seenLeagueIds = new Set<number>();

    const collect = async (params: Record<string, string | number | boolean | undefined>) => {
        const data = await fetchApiFootball<ApiFootballLeaguesResponse>('/leagues', params, apiKey);
        for (const row of data?.response || []) {
            if (seenLeagueIds.has(row.league.id)) continue;
            seenLeagueIds.add(row.league.id);
            candidates.push(row);
        }
    };

    if (externalId === 'INTL') {
        await collect({ id: 10 });
    }
    if (externalId && /^\d+$/.test(externalId)) {
        await collect({ id: Number(externalId) });
    }
    if (externalId && !/^\d+$/.test(externalId)) {
        await collect({ code: externalId });
    }
    if (league.name) {
        await collect({ name: league.name });
    }
    if (league.shortName) {
        await collect({ name: league.shortName });
    }

    if (candidates.length === 0) {
        apiFootballLeagueCache.set(league.id, null);
        logger.warn({ leagueName: league.name, externalId: league.externalId }, 'No API-Football league mapping found');
        return null;
    }

    const chosen = pickApiFootballLeague(candidates, league);
    if (!chosen) {
        apiFootballLeagueCache.set(league.id, null);
        logger.warn({ leagueName: league.name, externalId: league.externalId }, 'No API-Football candidate matched');
        return null;
    }

    const resolved = {
        leagueId: chosen.league.id,
        season: pickSeason(chosen),
        logoUrl: chosen.league.logo || null,
    };
    apiFootballLeagueCache.set(league.id, resolved);
    return resolved;
}

async function syncLeagueFromFootballData(league: LeagueRow, apiKey: string): Promise<SyncResult> {
    const result: SyncResult = { fetched: 0, upserted: 0, errors: 0, teamsUpserted: 0 };
    const code = (league.externalId || '').trim();
    if (!code || !FOOTBALL_DATA_SUPPORTED_CODES.has(code)) {
        result.skipped = true;
        return result;
    }

    try {
        const apiMatches = await fetchFootballDataMatches(code, apiKey);
        result.fetched = apiMatches.length;

        for (const row of apiMatches) {
            try {
                const home = await upsertTeamRecord({
                    leagueId: league.id,
                    name: row.homeTeam.name,
                    shortName: row.homeTeam.shortName,
                    externalId: String(row.homeTeam.id),
                    crestUrl: row.homeTeam.crest,
                });
                const away = await upsertTeamRecord({
                    leagueId: league.id,
                    name: row.awayTeam.name,
                    shortName: row.awayTeam.shortName,
                    externalId: String(row.awayTeam.id),
                    crestUrl: row.awayTeam.crest,
                });

                if (home.created) result.teamsUpserted += 1;
                if (away.created) result.teamsUpserted += 1;

                await upsertMatchRecord({
                    leagueId: league.id,
                    externalMatchId: String(row.id),
                    homeTeamId: home.id,
                    awayTeamId: away.id,
                    homeTeamName: row.homeTeam.name,
                    awayTeamName: row.awayTeam.name,
                    homeTeamCrestUrl: row.homeTeam.crest,
                    awayTeamCrestUrl: row.awayTeam.crest,
                    matchDateUtc: new Date(row.utcDate),
                    status: mapFootballDataStatus(row.status),
                    matchDay: row.matchday ?? null,
                    stage: row.stage || null,
                    homeScore: row.score.fullTime.home,
                    awayScore: row.score.fullTime.away,
                    venueName: row.venue || null,
                });
                result.upserted += 1;
            } catch (err) {
                result.errors += 1;
                logger.error({ league: league.name, matchId: row.id, err }, 'Failed upserting Football-Data match');
            }
        }
    } catch (err) {
        result.errors += 1;
        const status = typeof err === 'object' && err !== null && 'status' in err ? Number((err as { status?: number }).status) : null;
        if (status === 401 || status === 403) {
            result.restricted = true;
        }
        logger.error({ league: league.name, code, err }, 'Failed syncing league from Football-Data');
    }

    return result;
}

async function syncLeagueFromApiFootball(league: LeagueRow, apiKey: string): Promise<SyncResult> {
    const result: SyncResult = { fetched: 0, upserted: 0, errors: 0, teamsUpserted: 0 };
    const resolved = await resolveApiFootballLeague(league, apiKey);
    if (!resolved) {
        result.skipped = true;
        return result;
    }

    if (resolved.logoUrl && league.logoUrl !== resolved.logoUrl) {
        await db.update(leagues).set({ logoUrl: resolved.logoUrl }).where(eq(leagues.id, league.id));
    }

    const now = new Date();
    const dateFrom = now.toISOString().split('T')[0];
    const externalCode = (league.externalId || '').trim().toUpperCase();
    const lookaheadDays = externalCode === 'INTL' ? 90 : FOOTBALL_DATA_SUPPORTED_CODES.has(externalCode) ? 30 : 14;
    const dateTo = new Date(now.getTime() + lookaheadDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const fixtures = await fetchApiFootball<ApiFootballFixturesResponse>('/fixtures', {
        league: resolved.leagueId,
        season: resolved.season,
        from: dateFrom,
        to: dateTo,
        timezone: 'UTC',
    }, apiKey);

    const rows = fixtures?.response || [];
    result.fetched = rows.length;

    for (const fixture of rows) {
        try {
            const home = await upsertTeamRecord({
                leagueId: league.id,
                name: fixture.teams.home.name,
                shortName: fixture.teams.home.name,
                externalId: `AF-${fixture.teams.home.id}`,
                crestUrl: fixture.teams.home.logo || null,
            });
            const away = await upsertTeamRecord({
                leagueId: league.id,
                name: fixture.teams.away.name,
                shortName: fixture.teams.away.name,
                externalId: `AF-${fixture.teams.away.id}`,
                crestUrl: fixture.teams.away.logo || null,
            });

            if (home.created) result.teamsUpserted += 1;
            if (away.created) result.teamsUpserted += 1;

            await upsertMatchRecord({
                leagueId: league.id,
                externalMatchId: `AF-${fixture.fixture.id}`,
                homeTeamId: home.id,
                awayTeamId: away.id,
                homeTeamName: fixture.teams.home.name,
                awayTeamName: fixture.teams.away.name,
                homeTeamCrestUrl: fixture.teams.home.logo || null,
                awayTeamCrestUrl: fixture.teams.away.logo || null,
                matchDateUtc: new Date(fixture.fixture.date),
                status: mapApiFootballStatus(fixture.fixture.status.short),
                matchDay: parseMatchDay(fixture.league.round),
                stage: fixture.league.round || null,
                homeScore: fixture.goals.home,
                awayScore: fixture.goals.away,
                venueName: fixture.fixture.venue?.name || null,
            });
            result.upserted += 1;
        } catch (err) {
            result.errors += 1;
            logger.error({ league: league.name, fixtureId: fixture.fixture.id, err }, 'Failed upserting API-Football fixture');
        }
    }

    return result;
}

export async function scheduleMatchSync() {
    const matchSyncQueue = getMatchSyncQueue();
    const existingJobs = await matchSyncQueue.getRepeatableJobs();
    for (const job of existingJobs) {
        await matchSyncQueue.removeRepeatableByKey(job.key);
    }

    await matchSyncQueue.add('nightly-sync', {}, {
        repeat: { pattern: '0 2 * * *' },
        jobId: 'nightly-match-sync',
    });

    logger.info('Match sync cron scheduled: nightly at 02:00 UTC');
}

export async function runMatchSyncOnce(options: MatchSyncRunOptions = {}) {
    const provider = options.providerOverride || resolveProvider();
    const apiKey: string | undefined = provider === 'API_FOOTBALL'
        ? process.env.API_FOOTBALL_API_KEY
        : provider === 'FOOTBALL_DATA'
            ? process.env.FOOTBALL_DATA_API_KEY
            : undefined;
    const apiFootballApiKey = process.env.API_FOOTBALL_API_KEY;
    const footballDataApiKey = process.env.FOOTBALL_DATA_API_KEY;
    const sportSlug = options.sportSlug || 'soccer';
    const writeHistory = options.writeHistory ?? true;

    if (!apiKey && provider !== 'THE_SPORTS_DB') {
        throw new Error(`${provider === 'API_FOOTBALL' ? 'API_FOOTBALL_API_KEY' : 'FOOTBALL_DATA_API_KEY'} not set`);
    }

    logger.info({ provider, sportSlug }, 'Starting direct match sync run');

    const leagueRows = provider === 'API_FOOTBALL'
        ? await db.select({ league: leagues })
            .from(leagues)
            .innerJoin(sports, eq(leagues.sportId, sports.id))
            .where(and(eq(leagues.isActive, true), eq(sports.slug, sportSlug)))
        : await db.select({ league: leagues })
            .from(leagues)
            .innerJoin(sports, eq(leagues.sportId, sports.id))
            .where(and(eq(leagues.isActive, true), eq(sports.slug, sportSlug), sql`${leagues.externalId} IS NOT NULL`));

    const syncResults: Record<string, SyncResult> = {};
    clearSyncCaches();

    for (const row of leagueRows) {
        const league = row.league;
        const startedAt = Date.now();
        const externalCode = (league.externalId || '').trim().toUpperCase();

        // Keep leagues on TheSportsDB where its coverage is a better fit.
        // Use Football-Data for major global leagues when key exists.
        let providerUsed: MatchSyncProvider = provider;
        let result: SyncResult;
        if (THE_SPORTS_DB_PRIORITY_LEAGUE_CODES.has(externalCode)) {
            providerUsed = 'THE_SPORTS_DB';
            result = await syncLeagueFromTheSportsDb(league);
        } else if (externalCode === 'INTL' && apiFootballApiKey) {
            providerUsed = 'API_FOOTBALL';
            result = await syncLeagueFromApiFootball(league, apiFootballApiKey);
        } else if (provider === 'API_FOOTBALL') {
            result = await syncLeagueFromApiFootball(league, apiKey as string);
        } else if (provider === 'FOOTBALL_DATA') {
            result = await syncLeagueFromFootballData(league, apiKey as string);
        } else if (footballDataApiKey) {
            providerUsed = 'FOOTBALL_DATA';
            result = await syncLeagueFromFootballData(league, footballDataApiKey);
        } else {
            result = await syncLeagueFromTheSportsDb(league);
        }

        if (
            providerUsed === 'FOOTBALL_DATA'
            && result.restricted
            && apiFootballApiKey
            && !THE_SPORTS_DB_PRIORITY_LEAGUE_CODES.has(externalCode)
        ) {
            logger.warn({ league: league.name, externalCode }, 'Football-Data access restricted, falling back to API-Football');
            providerUsed = 'API_FOOTBALL';
            result = await syncLeagueFromApiFootball(league, apiFootballApiKey);
        }

        const durationMs = Date.now() - startedAt;
        syncResults[league.name] = result;

        if (writeHistory) {
            await db.insert(syncHistory).values({
                leagueId: league.id,
                matchesUpserted: result.upserted,
                teamsUpserted: result.teamsUpserted,
                errorMessage: result.errors > 0
                    ? `${result.errors} errors during sync`
                    : result.skipped ? 'Skipped for current sync provider' : null,
                status: result.errors > 0 ? 'PARTIAL' : 'SUCCESS',
                durationMs,
            });
        }

        await sleep(providerUsed === 'FOOTBALL_DATA' ? 6200 : providerUsed === 'THE_SPORTS_DB' ? 900 : 1200);
    }

    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    await db.delete(matches).where(and(lt(matches.matchDateUtc, sixtyDaysAgo), eq(matches.status, 'FINISHED')));

    logger.info({ provider, syncResults }, 'Match sync completed');
    return syncResults;
}

export function startMatchSyncWorker() {
    const provider = resolveProvider();
    const apiKey: string | undefined = provider === 'API_FOOTBALL'
        ? process.env.API_FOOTBALL_API_KEY
        : provider === 'FOOTBALL_DATA'
            ? process.env.FOOTBALL_DATA_API_KEY
            : undefined;

    if (!apiKey && provider !== 'THE_SPORTS_DB') {
        logger.warn(`${provider === 'API_FOOTBALL' ? 'API_FOOTBALL_API_KEY' : 'FOOTBALL_DATA_API_KEY'} not set, match sync worker disabled`);
        return;
    }

    const worker = new Worker(QUEUE_NAME, async (job) => {
        logger.info({ jobId: job.id, provider }, 'Starting match sync job');
        return runMatchSyncOnce({ providerOverride: provider, sportSlug: 'soccer', writeHistory: true });
    }, {
        connection: redis,
        concurrency: 1,
        limiter: { max: 1, duration: 60000 },
    });

    worker.on('completed', (job) => {
        logger.info({ jobId: job.id, provider }, 'Match sync job completed');
    });

    worker.on('failed', (job, err) => {
        logger.error({ jobId: job?.id, provider, err: err.message }, 'Match sync job failed');
    });

    logger.info({ provider }, 'Match sync worker started');
    return worker;
}

export async function triggerManualSync() {
    const matchSyncQueue = getMatchSyncQueue();
    const job = await matchSyncQueue.add('manual-sync', {}, { priority: 1 });
    return { jobId: job.id, message: 'Match sync queued' };
}
