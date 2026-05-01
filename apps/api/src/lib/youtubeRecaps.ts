import { and, desc, eq, gte, isNull, lte, or, inArray } from 'drizzle-orm';
import { db } from '../db/client';
import { leagues, matches } from '../db/schema';
import { logger } from './logger';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const DEFAULT_BATCH_LIMIT = 12;
const DEFAULT_LOOKBACK_DAYS = 21;
const DEFAULT_RETRY_AFTER_HOURS = 8;
const DEFAULT_LEAGUE_SLUGS = ['mls'];
const MATCH_END_BUFFER_MS = 2 * 60 * 60 * 1000;
const SEARCH_RESULTS_PER_QUERY = 6;
const MIN_ACCEPTABLE_SCORE = 45;

const FINISHED_MATCH_STATUSES = new Set(['FINISHED']);
const POSITIVE_TITLE_KEYWORDS = ['highlight', 'highlights', 'recap', 'recaps', 'extended highlights', 'match recap'];
const NEGATIVE_TITLE_KEYWORDS = [
    'full match',
    'full game',
    'replay',
    'watchalong',
    'watch along',
    'live stream',
    'simulation',
    'eafc',
    'fc 25',
    'career mode',
    'prediction',
];
const TRUSTED_CHANNEL_KEYWORDS = [
    'mls',
    'major league soccer',
    'official',
    'espn',
    'fox soccer',
    'apple tv',
    'cbs sports',
    'golazo',
    'nbc sports',
    'tudn',
    'bein sports',
    'sky sports',
    'premier league',
    'laliga',
    'bundesliga',
    'serie a',
    'ligue 1',
    'uefa',
    'fifa',
];
const TEAM_NAME_STOP_WORDS = new Set([
    'fc',
    'cf',
    'sc',
    'afc',
    'cfc',
    'club',
    'the',
    'de',
    'ac',
    'cd',
    'if',
    'bk',
    'fk',
    'inter',
    'city',
    'united',
    'sporting',
    'real',
]);

export type YoutubeSearchStatus = 'pending' | 'found' | 'not_found' | 'failed';

type MatchRecapTarget = {
    id: string;
    status: string;
    eventFormat: 'HEAD_TO_HEAD' | 'SINGLE_EVENT';
    eventTitle: string | null;
    eventSubtitle: string | null;
    homeTeamName: string | null;
    awayTeamName: string | null;
    matchDateUtc: Date;
    leagueSlug: string | null;
    leagueName: string | null;
    leagueShortName: string | null;
    youtubeVideoId: string | null;
    youtubeSearchStatus: YoutubeSearchStatus;
    youtubeCheckedAt: Date | null;
};

type MatchRecapProcessResult = {
    matchId: string;
    status: 'found' | 'not_found' | 'failed' | 'skipped';
    reason?: string;
    videoId?: string;
};

type MatchRecapBatchResult = {
    processed: number;
    found: number;
    notFound: number;
    failed: number;
    skipped: number;
    results: MatchRecapProcessResult[];
};

type SearchResponse = {
    items?: Array<{
        id?: { videoId?: string };
        snippet?: {
            title?: string;
            channelTitle?: string;
            publishedAt?: string;
            thumbnails?: Record<string, { url?: string }>;
        };
    }>;
    error?: {
        code?: number;
        message?: string;
        errors?: Array<{ reason?: string; message?: string }>;
    };
};

type VideosResponse = {
    items?: Array<{
        id?: string;
        snippet?: {
            title?: string;
            channelTitle?: string;
            publishedAt?: string;
            thumbnails?: Record<string, { url?: string }>;
        };
        status?: {
            embeddable?: boolean;
        };
        contentDetails?: {
            duration?: string;
        };
    }>;
    error?: {
        code?: number;
        message?: string;
        errors?: Array<{ reason?: string; message?: string }>;
    };
};

type SearchCandidate = {
    videoId: string;
    title: string;
    channelTitle: string;
    publishedAt: Date | null;
    thumbnailUrl: string | null;
    embeddable: boolean;
    durationSeconds: number | null;
    score: number;
};

class YouTubeApiError extends Error {
    status?: number;
    reason?: string;
    retryable: boolean;

    constructor(message: string, options?: { status?: number; reason?: string; retryable?: boolean }) {
        super(message);
        this.name = 'YouTubeApiError';
        this.status = options?.status;
        this.reason = options?.reason;
        this.retryable = options?.retryable ?? true;
    }
}

function getYoutubeApiKey() {
    return process.env.YOUTUBE_API_KEY?.trim() || '';
}

export function isYoutubeRecapSearchEnabled() {
    return Boolean(getYoutubeApiKey());
}

export function buildYoutubeEmbedUrl(videoId: string | null | undefined) {
    const safeVideoId = (videoId || '').trim();
    if (!/^[A-Za-z0-9_-]{11}$/.test(safeVideoId)) return null;
    return `https://www.youtube.com/embed/${safeVideoId}`;
}

function stripDiacritics(value: string) {
    return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeText(value: string | null | undefined) {
    return stripDiacritics(value || '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function buildTeamTerms(teamName: string | null | undefined) {
    const normalized = normalizeText(teamName);
    if (!normalized) return [];

    const tokens = normalized
        .split(' ')
        .filter((token) => token.length >= 3 && !TEAM_NAME_STOP_WORDS.has(token));

    const phrases = new Set<string>([normalized]);
    if (tokens.length > 0) {
        phrases.add(tokens.join(' '));
    }
    for (const token of tokens) {
        phrases.add(token);
    }
    return Array.from(phrases).filter(Boolean);
}

function titleContainsTeam(title: string, teamName: string | null | undefined) {
    const normalizedTitle = normalizeText(title);
    if (!normalizedTitle || !teamName) return false;

    const terms = buildTeamTerms(teamName);
    if (terms.length === 0) return false;

    if (terms.some((term) => term.includes(' ') && normalizedTitle.includes(term))) {
        return true;
    }

    const significantTokens = terms
        .filter((term) => !term.includes(' '))
        .filter((token) => token.length >= 4);

    return significantTokens.length > 0
        && significantTokens.every((token) => normalizedTitle.includes(token));
}

function parseIsoDurationSeconds(duration: string | null | undefined) {
    if (!duration) return null;
    const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(duration.trim());
    if (!match) return null;
    const hours = Number(match[1] || 0);
    const minutes = Number(match[2] || 0);
    const seconds = Number(match[3] || 0);
    return (hours * 60 * 60) + (minutes * 60) + seconds;
}

function pickThumbnail(thumbnails?: Record<string, { url?: string }>) {
    if (!thumbnails) return null;
    return thumbnails.maxres?.url
        || thumbnails.standard?.url
        || thumbnails.high?.url
        || thumbnails.medium?.url
        || thumbnails.default?.url
        || null;
}

function buildCompetitionLabel(target: MatchRecapTarget) {
    return target.leagueShortName?.trim()
        || target.leagueName?.trim()
        || target.eventSubtitle?.trim()
        || null;
}

function buildSearchQueries(target: MatchRecapTarget) {
    const queries = new Set<string>();
    const competition = buildCompetitionLabel(target);

    if (target.eventFormat === 'SINGLE_EVENT') {
        const eventLabel = target.eventTitle?.trim() || target.eventSubtitle?.trim();
        if (eventLabel) {
            queries.add(`${eventLabel} highlights`);
            queries.add(`${eventLabel} recap`);
            if (competition && competition.toLowerCase() !== eventLabel.toLowerCase()) {
                queries.add(`${competition} ${eventLabel} highlights`);
            }
        }
        return Array.from(queries);
    }

    const home = target.homeTeamName?.trim();
    const away = target.awayTeamName?.trim();
    if (!home || !away) return Array.from(queries);

    const matchup = `${home} vs ${away}`;
    queries.add(`${matchup} highlights`);
    queries.add(`${matchup} recap`);
    if (competition) {
        queries.add(`${competition} ${matchup} highlights`);
    }
    if (normalizeText(target.leagueSlug) === 'mls' || normalizeText(competition) === 'mls') {
        queries.add(`MLS ${matchup} highlights`);
        queries.add(`${home} ${away} MLS highlights`);
        queries.add(`${home} official highlights ${away}`);
        queries.add(`${away} official highlights ${home}`);
    }

    return Array.from(queries);
}

function scorePublishedAt(target: MatchRecapTarget, publishedAt: Date | null) {
    if (!publishedAt) return 0;
    const kickoffMs = target.matchDateUtc.getTime();
    const expectedEndMs = kickoffMs + MATCH_END_BUFFER_MS;
    const deltaHours = Math.abs(publishedAt.getTime() - expectedEndMs) / (60 * 60 * 1000);

    if (publishedAt.getTime() < kickoffMs - (60 * 60 * 1000)) {
        return -50;
    }
    if (deltaHours <= 6) return 20;
    if (deltaHours <= 24) return 14;
    if (deltaHours <= 72) return 8;
    if (deltaHours <= 168) return 2;
    return -10;
}

function scoreChannel(channelTitle: string, target: MatchRecapTarget) {
    const normalizedChannel = normalizeText(channelTitle);
    let score = 0;

    if (TRUSTED_CHANNEL_KEYWORDS.some((keyword) => normalizedChannel.includes(normalizeText(keyword)))) {
        score += 20;
    }
    if (target.leagueName && normalizedChannel.includes(normalizeText(target.leagueName))) {
        score += 10;
    }
    if (target.leagueShortName && normalizedChannel.includes(normalizeText(target.leagueShortName))) {
        score += 10;
    }
    if (target.homeTeamName && normalizedChannel.includes(normalizeText(target.homeTeamName))) {
        score += 8;
    }
    if (target.awayTeamName && normalizedChannel.includes(normalizeText(target.awayTeamName))) {
        score += 8;
    }

    return score;
}

function scoreDuration(durationSeconds: number | null) {
    if (!durationSeconds) return 0;
    if (durationSeconds > 2 * 60 * 60) return -90;
    if (durationSeconds > 60 * 60) return -60;
    if (durationSeconds > 35 * 60) return -28;
    if (durationSeconds < 45) return -15;
    if (durationSeconds <= 20 * 60) return 8;
    return 0;
}

function scoreCandidate(target: MatchRecapTarget, candidate: Omit<SearchCandidate, 'score'>) {
    const normalizedTitle = normalizeText(candidate.title);
    let score = 0;

    const hasHomeTeam = titleContainsTeam(candidate.title, target.homeTeamName);
    const hasAwayTeam = titleContainsTeam(candidate.title, target.awayTeamName);

    if (hasHomeTeam && hasAwayTeam) {
        score += 48;
    } else if (hasHomeTeam || hasAwayTeam) {
        score += 14;
    }

    if (POSITIVE_TITLE_KEYWORDS.some((keyword) => normalizedTitle.includes(normalizeText(keyword)))) {
        score += 22;
    }
    if (normalizedTitle.includes('extended highlights')) {
        score += 8;
    }

    if (NEGATIVE_TITLE_KEYWORDS.some((keyword) => normalizedTitle.includes(normalizeText(keyword)))) {
        score -= 65;
    }

    score += scoreChannel(candidate.channelTitle, target);
    score += scorePublishedAt(target, candidate.publishedAt);
    score += scoreDuration(candidate.durationSeconds);

    return score;
}

async function fetchYoutubeJson<T>(path: string, params: Record<string, string>) {
    const apiKey = getYoutubeApiKey();
    if (!apiKey) {
        throw new YouTubeApiError('YOUTUBE_API_KEY is not configured', { retryable: false });
    }

    const searchParams = new URLSearchParams({ ...params, key: apiKey });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
        const response = await fetch(`${YOUTUBE_API_BASE}${path}?${searchParams.toString()}`, {
            signal: controller.signal,
        });

        const payload: any = await response.json().catch(() => null);
        if (!response.ok) {
            const reason = payload?.error?.errors?.[0]?.reason || 'unknown';
            throw new YouTubeApiError(
                payload?.error?.message || `YouTube API request failed with status ${response.status}`,
                {
                    status: response.status,
                    reason,
                    retryable: !['quotaExceeded', 'dailyLimitExceeded', 'keyInvalid', 'forbidden'].includes(reason),
                },
            );
        }

        if (!payload || typeof payload !== 'object') {
            throw new YouTubeApiError('YouTube API returned an invalid response shape');
        }

        return payload as T;
    } catch (error) {
        if (error instanceof YouTubeApiError) {
            throw error;
        }
        if (error instanceof Error && error.name === 'AbortError') {
            throw new YouTubeApiError('YouTube API request timed out');
        }
        throw new YouTubeApiError(error instanceof Error ? error.message : 'Unknown YouTube API error');
    } finally {
        clearTimeout(timeout);
    }
}

async function searchYoutubeByQuery(query: string) {
    logger.info({ query }, 'Searching YouTube recap candidates');
    const payload = await fetchYoutubeJson<SearchResponse>('/search', {
        part: 'snippet',
        type: 'video',
        order: 'relevance',
        maxResults: String(SEARCH_RESULTS_PER_QUERY),
        videoEmbeddable: 'true',
        q: query,
    });

    return payload.items || [];
}

async function getYoutubeVideoDetails(videoIds: string[]) {
    if (videoIds.length === 0) return new Map<string, NonNullable<VideosResponse['items']>[number]>();

    const payload = await fetchYoutubeJson<VideosResponse>('/videos', {
        part: 'snippet,contentDetails,status',
        id: videoIds.join(','),
        maxResults: String(videoIds.length),
    });

    return new Map(
        (payload.items || [])
            .filter((item): item is NonNullable<VideosResponse['items']>[number] & { id: string } => Boolean(item?.id))
            .map((item) => [item.id, item]),
    );
}

async function selectBestYoutubeRecap(target: MatchRecapTarget) {
    const queries = buildSearchQueries(target);
    const candidatesById = new Map<string, SearchCandidate>();

    for (const query of queries) {
        const searchItems = await searchYoutubeByQuery(query);
        const videoIds = Array.from(new Set(
            searchItems
                .map((item) => item.id?.videoId?.trim())
                .filter((videoId): videoId is string => Boolean(videoId)),
        ));
        const detailsById = await getYoutubeVideoDetails(videoIds);

        for (const searchItem of searchItems) {
            const videoId = searchItem.id?.videoId?.trim();
            if (!videoId) continue;

            const details = detailsById.get(videoId);
            const title = details?.snippet?.title?.trim() || searchItem.snippet?.title?.trim() || '';
            if (!title) continue;

            const channelTitle = details?.snippet?.channelTitle?.trim()
                || searchItem.snippet?.channelTitle?.trim()
                || '';
            const publishedAtRaw = details?.snippet?.publishedAt || searchItem.snippet?.publishedAt;
            const publishedAt = publishedAtRaw ? new Date(publishedAtRaw) : null;
            const thumbnailUrl = pickThumbnail(details?.snippet?.thumbnails || searchItem.snippet?.thumbnails);
            const candidateBase = {
                videoId,
                title,
                channelTitle,
                publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
                thumbnailUrl,
                embeddable: details?.status?.embeddable !== false,
                durationSeconds: parseIsoDurationSeconds(details?.contentDetails?.duration),
            };

            if (!candidateBase.embeddable) continue;

            const score = scoreCandidate(target, candidateBase);
            const existing = candidatesById.get(videoId);
            if (!existing || score > existing.score) {
                candidatesById.set(videoId, { ...candidateBase, score });
            }
        }
    }

    const ranked = Array.from(candidatesById.values())
        .sort((left, right) => right.score - left.score);

    return ranked[0] && ranked[0].score >= MIN_ACCEPTABLE_SCORE
        ? ranked[0]
        : null;
}

function mapTarget(row: {
    match: typeof matches.$inferSelect;
    leagueName: string | null;
    leagueShortName: string | null;
    leagueSlug: string | null;
}): MatchRecapTarget {
    return {
        id: row.match.id,
        status: row.match.status,
        eventFormat: row.match.eventFormat,
        eventTitle: row.match.eventTitle,
        eventSubtitle: row.match.eventSubtitle,
        homeTeamName: row.match.homeTeamName,
        awayTeamName: row.match.awayTeamName,
        matchDateUtc: row.match.matchDateUtc,
        leagueSlug: row.leagueSlug,
        leagueName: row.leagueName,
        leagueShortName: row.leagueShortName,
        youtubeVideoId: row.match.youtubeVideoId,
        youtubeSearchStatus: row.match.youtubeSearchStatus,
        youtubeCheckedAt: row.match.youtubeCheckedAt,
    };
}

function isTargetEligible(target: MatchRecapTarget, forceRefresh: boolean) {
    if (!FINISHED_MATCH_STATUSES.has(target.status)) return false;
    if (target.matchDateUtc.getTime() > Date.now()) return false;
    if (!forceRefresh && target.youtubeVideoId) return false;
    return true;
}

async function markMatchRecapNotFound(target: MatchRecapTarget) {
    await db.update(matches)
        .set({
            youtubeVideoId: null,
            youtubeVideoTitle: null,
            youtubeChannelTitle: null,
            youtubePublishedAt: null,
            youtubeThumbnailUrl: null,
            youtubeEmbedUrl: null,
            youtubeSearchStatus: 'not_found',
            youtubeCheckedAt: new Date(),
            updatedAt: new Date(),
        })
        .where(eq(matches.id, target.id));
}

async function markMatchRecapFailed(target: MatchRecapTarget) {
    await db.update(matches)
        .set({
            youtubeSearchStatus: target.youtubeVideoId ? 'found' : 'failed',
            youtubeCheckedAt: new Date(),
            updatedAt: new Date(),
        })
        .where(eq(matches.id, target.id));
}

async function saveMatchRecap(target: MatchRecapTarget, candidate: SearchCandidate) {
    await db.update(matches)
        .set({
            youtubeVideoId: candidate.videoId,
            youtubeVideoTitle: candidate.title,
            youtubeChannelTitle: candidate.channelTitle || null,
            youtubePublishedAt: candidate.publishedAt,
            youtubeThumbnailUrl: candidate.thumbnailUrl,
            youtubeEmbedUrl: buildYoutubeEmbedUrl(candidate.videoId),
            youtubeSearchStatus: 'found',
            youtubeCheckedAt: new Date(),
            updatedAt: new Date(),
        })
        .where(eq(matches.id, target.id));
}

export async function getYoutubeRecapTarget(matchId: string) {
    const [row] = await db.select({
        match: matches,
        leagueSlug: leagues.slug,
        leagueName: leagues.name,
        leagueShortName: leagues.shortName,
    })
        .from(matches)
        .leftJoin(leagues, eq(matches.leagueId, leagues.id))
        .where(eq(matches.id, matchId))
        .limit(1);

    return row ? mapTarget(row) : null;
}

export async function processMatchYoutubeRecap(matchId: string, options: { forceRefresh?: boolean } = {}): Promise<MatchRecapProcessResult> {
    const target = await getYoutubeRecapTarget(matchId);
    if (!target) {
        return { matchId, status: 'skipped', reason: 'match_not_found' };
    }

    return processYoutubeRecapTarget(target, options);
}

async function processYoutubeRecapTarget(target: MatchRecapTarget, options: { forceRefresh?: boolean } = {}): Promise<MatchRecapProcessResult> {
    const forceRefresh = options.forceRefresh ?? false;

    if (!isYoutubeRecapSearchEnabled()) {
        return { matchId: target.id, status: 'failed', reason: 'youtube_api_key_missing' };
    }

    if (!isTargetEligible(target, forceRefresh)) {
        return { matchId: target.id, status: 'skipped', reason: 'match_not_eligible' };
    }

    logger.info({
        matchId: target.id,
        status: target.status,
        homeTeamName: target.homeTeamName,
        awayTeamName: target.awayTeamName,
        competition: buildCompetitionLabel(target),
        forceRefresh,
    }, 'Processing YouTube recap for match');

    try {
        const candidate = await selectBestYoutubeRecap(target);

        if (!candidate) {
            if (!target.youtubeVideoId) {
                await markMatchRecapNotFound(target);
            } else {
                await db.update(matches)
                    .set({ youtubeCheckedAt: new Date(), updatedAt: new Date() })
                    .where(eq(matches.id, target.id));
            }

            logger.info({ matchId: target.id }, 'No YouTube recap found for match');
            return { matchId: target.id, status: 'not_found' };
        }

        await saveMatchRecap(target, candidate);
        logger.info({
            matchId: target.id,
            videoId: candidate.videoId,
            videoTitle: candidate.title,
            channelTitle: candidate.channelTitle,
            score: candidate.score,
        }, 'Selected YouTube recap for match');

        return {
            matchId: target.id,
            status: 'found',
            videoId: candidate.videoId,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown YouTube recap error';
        const reason = error instanceof YouTubeApiError ? error.reason : undefined;

        await markMatchRecapFailed(target);
        logger.error({
            matchId: target.id,
            err: message,
            reason,
        }, 'YouTube recap processing failed');

        return {
            matchId: target.id,
            status: 'failed',
            reason: reason || message,
        };
    }
}

export async function processRecentFinishedMatchRecaps(options: {
    limit?: number;
    forceRefresh?: boolean;
    matchIds?: string[];
    retryAfterHours?: number;
    lookbackDays?: number;
    leagueSlugs?: string[];
} = {}): Promise<MatchRecapBatchResult> {
    const limit = options.limit ?? DEFAULT_BATCH_LIMIT;
    const forceRefresh = options.forceRefresh ?? false;
    const retryAfterHours = options.retryAfterHours ?? DEFAULT_RETRY_AFTER_HOURS;
    const lookbackDays = options.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
    const leagueSlugs = options.leagueSlugs ?? DEFAULT_LEAGUE_SLUGS;
    const now = new Date();
    const retryCutoff = new Date(now.getTime() - (retryAfterHours * 60 * 60 * 1000));
    const lookbackStart = new Date(now.getTime() - (lookbackDays * 24 * 60 * 60 * 1000));

    const whereClauses: any[] = [
        eq(matches.status, 'FINISHED'),
        lte(matches.matchDateUtc, now),
        gte(matches.matchDateUtc, lookbackStart),
    ];

    if (options.matchIds && options.matchIds.length > 0) {
        whereClauses.push(inArray(matches.id, options.matchIds));
    }
    if (leagueSlugs.length > 0) {
        whereClauses.push(inArray(leagues.slug, leagueSlugs));
    }

    if (!forceRefresh) {
        whereClauses.push(or(
            isNull(matches.youtubeVideoId),
            eq(matches.youtubeSearchStatus, 'pending'),
            and(eq(matches.youtubeSearchStatus, 'not_found'), or(isNull(matches.youtubeCheckedAt), lte(matches.youtubeCheckedAt, retryCutoff))),
            and(eq(matches.youtubeSearchStatus, 'failed'), or(isNull(matches.youtubeCheckedAt), lte(matches.youtubeCheckedAt, retryCutoff))),
        ));
    }

    const rows = await db.select({
        match: matches,
        leagueSlug: leagues.slug,
        leagueName: leagues.name,
        leagueShortName: leagues.shortName,
    })
        .from(matches)
        .leftJoin(leagues, eq(matches.leagueId, leagues.id))
        .where(and(...whereClauses))
        .orderBy(desc(matches.matchDateUtc))
        .limit(limit);

    const targets = rows.map(mapTarget);
    const results: MatchRecapProcessResult[] = [];

    for (const target of targets) {
        results.push(await processYoutubeRecapTarget(target, { forceRefresh }));
    }

    const summary = results.reduce<MatchRecapBatchResult>((acc, result) => {
        acc.processed += 1;
        if (result.status === 'found') acc.found += 1;
        if (result.status === 'not_found') acc.notFound += 1;
        if (result.status === 'failed') acc.failed += 1;
        if (result.status === 'skipped') acc.skipped += 1;
        acc.results.push(result);
        return acc;
    }, {
        processed: 0,
        found: 0,
        notFound: 0,
        failed: 0,
        skipped: 0,
        results: [],
    });

    logger.info({
        processed: summary.processed,
        found: summary.found,
        notFound: summary.notFound,
        failed: summary.failed,
        skipped: summary.skipped,
    }, 'Finished YouTube recap batch run');

    return summary;
}
