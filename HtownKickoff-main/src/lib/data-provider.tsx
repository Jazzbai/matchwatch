"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import {
    ADMIN_STATS,
    AMENITY_LABELS,
    ALL_TEAMS,
    BOOKINGS,
    LEAGUES,
    MATCHES,
    PRICE_LABELS,
    POSTS,
    REVIEWS,
    VENUES,
    VENUE_EVENTS,
    type Match,
    type Venue,
    type League,
    type Sport,
    type Team,
    type VenueEvent,
    type Review,
    type Post,
    type Booking,
    type User,
    type MatchStatus,
    type PriceRange,
} from "./data";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
const MATCH_FETCH_LIMIT = 50;
const VENUE_FETCH_LIMIT = 50;
const VENUE_MAX_PAGES = 4;
const VENUE_DEEP_MAX_PAGES = 50;
const MATCH_MAX_PAGES = 20;

const BOOKING_FETCH_LIMIT = 50;
const FLAG_CDN_BASE = "https://flagcdn.com";
const HOME_PRIORITY_SOCCER_LEAGUE_MATCHERS = [
    (name: string) => name === "mls" || name.includes("major league soccer"),
    (name: string) => name.includes("premier league"),
    (name: string) => name.includes("la liga"),
    (name: string) => name.includes("bundesliga"),
    (name: string) => name.includes("serie a"),
    (name: string) => name.includes("ligue 1"),
    (name: string) => name.includes("champions league") || name.includes("ucl"),
    (name: string) => name.includes("fifa european qualifiers") || name.includes("wc-qualifiers"),
];

type ApiMeta = {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
};

type ApiEnvelope<T> = {
    data: T | null;
    meta?: ApiMeta;
};

type ApiMatchFacets = {
    sports: Array<{
        id: string;
        name: string;
        slug: string;
        shortName?: string | null;
    }>;
    leagues: Array<{
        id: string;
        sportId?: string | null;
        name: string;
        shortName?: string | null;
        logoUrl?: string | null;
    }>;
};

interface DataContextType {
    matches: Match[];
    venues: Venue[];
    leagues: League[];
    sports: Sport[];
    teams: Team[];
    venueEvents: VenueEvent[];
    reviews: Review[];
    posts: Post[];
    bookings: Booking[];
    users: User[];
    adminStats: {
        totalUsers: number;
        totalVenues: number;
        totalBookings: number;
        totalMatches: number;
        bookingsToday: number;
        bookingsThisWeek: number;
        activeEvents: number;
        revenue: number;
        growthUsers: number;
        growthBookings: number;
        growthVenues: number;
        topLeagues: Array<{ name: string; bookings: number }>;
        recentActivity: Array<{ type: string; message: string; time: string }>;
    };
    isApiConnected: boolean;
    isLoading: boolean;
    getTeam: (id?: string) => Team | undefined;
    getLeague: (id: string) => League | undefined;
    getSport: (id: string) => Sport | undefined;
    getVenue: (idOrSlug: string) => Venue | undefined;
    getMatch: (id: string) => Match | undefined;
    getVenueEvents: (matchId: string) => (VenueEvent & { venue: Venue })[];
    getVenueReviews: (venueId: string) => Review[];
    getVenuePosts: (venueId: string) => Post[];
    getVenueMatchEvents: (venueId: string) => (VenueEvent & { match: Match })[];
    refetch: () => Promise<void>;
}

const EMPTY_ADMIN_STATS: DataContextType["adminStats"] = {
    totalUsers: 0,
    totalVenues: 0,
    totalBookings: 0,
    totalMatches: 0,
    bookingsToday: 0,
    bookingsThisWeek: 0,
    activeEvents: 0,
    revenue: 0,
    growthUsers: 0,
    growthBookings: 0,
    growthVenues: 0,
    topLeagues: [],
    recentActivity: [],
};

const DataContext = createContext<DataContextType | undefined>(undefined);

type ApiMatch = {
    id: string;
    isFeatured?: boolean | null;
    eventFormat?: "HEAD_TO_HEAD" | "SINGLE_EVENT" | null;
    eventTitle?: string | null;
    eventSubtitle?: string | null;
    leagueId?: string | null;
    homeTeamId?: string | null;
    awayTeamId?: string | null;
    homeTeamName?: string | null;
    awayTeamName?: string | null;
    homeTeamCrestUrl?: string | null;
    awayTeamCrestUrl?: string | null;
    homeScore?: number | null;
    awayScore?: number | null;
    matchDateUtc?: string;
    status?: MatchStatus;
    matchDay?: number | string | null;
    stage?: string | null;
    venueName?: string | null;
    venueCount?: number;
    youtubeVideoId?: string | null;
    youtubeVideoTitle?: string | null;
    youtubeChannelTitle?: string | null;
    youtubePublishedAt?: string | null;
    youtubeThumbnailUrl?: string | null;
    youtubeEmbedUrl?: string | null;
    youtubeSearchStatus?: "pending" | "found" | "not_found" | "failed" | null;
    youtubeCheckedAt?: string | null;
    league?: {
        id: string;
        sportId?: string | null;
        name: string;
        shortName?: string | null;
        logoUrl?: string | null;
        sport?: {
            id: string;
            name: string;
            slug: string;
            shortName?: string | null;
        } | null;
    } | null;
};

function normalizeImageUrl(value?: string | null) {
    const raw = (value || "").trim();
    if (!raw) return "";
    if (raw.startsWith("/") || raw.startsWith("http://") || raw.startsWith("https://")) {
        return raw;
    }
    return `https://${raw}`;
}

function sanitizeLegalText(value: string) {
    return value
        .replace(/\bFIFA\b/gi, "")
        .replace(/\bWorld Cup\b/gi, "Global Finals")
        .replace(/\bNWSL Women\b/gi, "NWSL")
        .replace(/\s{2,}/g, " ")
        .trim();
}

function inferLeagueCountry(name: string) {
    const key = name.toLowerCase();
    if (key.includes("premier league")) return "England";
    if (key.includes("la liga")) return "Spain";
    if (key.includes("bundesliga")) return "Germany";
    if (key.includes("serie a")) return "Italy";
    if (key.includes("ligue 1")) return "France";
    if (key.includes("champions league")) return "Europe";
    if (key.includes("mls") || key.includes("major league soccer")) return "USA/Canada";
    if (key.includes("liga mx") || key.includes("mexican primera")) return "Mexico";
    if (key.includes("nwsl")) return "USA";
    if (key.includes("global finals") || key.includes("world cup")) return "International";
    return "International";
}

function inferSportFromLeague(name: string): Sport {
    const key = name.toLowerCase();
    if (key.includes('nfl') || key.includes('american football')) {
        return { id: 'american-football', name: 'American Football', slug: 'american-football', shortName: 'NFL' };
    }
    if (key.includes('nba') || key.includes('basketball')) {
        return { id: 'basketball', name: 'Basketball', slug: 'basketball', shortName: 'NBA' };
    }
    if (key.includes('mlb') || key.includes('baseball')) {
        return { id: 'baseball', name: 'Baseball', slug: 'baseball', shortName: 'MLB' };
    }
    if (key.includes('nhl') || key.includes('hockey')) {
        return { id: 'hockey', name: 'Hockey', slug: 'hockey', shortName: 'NHL' };
    }
    return { id: 'soccer', name: 'Soccer', slug: 'soccer', shortName: 'SOC' };
}

function resolveLeagueBranding(name: string, logoUrl?: string | null) {
    const safeName = sanitizeLegalText(name);
    const image = normalizeImageUrl(logoUrl);
    const key = safeName.toLowerCase();
    if (image) {
        const short = key.includes("formula 1")
            ? "F1"
            : key.includes("nascar")
                ? "NASCAR"
                : key.includes("indycar")
                    ? "INDY"
                    : safeName
                        .split(/\s+/)
                        .map((chunk) => chunk[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 6) || "LG";
        return { logo: short, image };
    }

    if (key.includes("premier league")) return { logo: "EPL", image: "/epl-logo.webp" };
    if (key.includes("la liga")) return { logo: "LL", image: "/laliga-logo.webp" };
    if (key.includes("bundesliga")) return { logo: "BL", image: "/bundesliga-logo.svg" };
    if (key.includes("serie a")) return { logo: "SA", image: "/seriea-logo.png" };
    if (key.includes("ligue 1")) return { logo: "L1" };
    if (key.includes("champions league")) return { logo: "UCL" };
    if (key.includes("play-off")) return { logo: "PO" };
    if (key.includes("friendlies")) return { logo: "INTL" };
    if (key.includes("world cup") || key.includes("global finals")) return { logo: "WC" };
    if (key === "mls" || key.includes("major league soccer")) return { logo: "MLS" };
    if (key === "nfl" || key.includes("national football league")) return { logo: "NFL" };
    if (key === "nba" || key.includes("national basketball association")) return { logo: "NBA" };
    if (key === "mlb" || key.includes("major league baseball")) return { logo: "MLB" };
    if (key === "nhl" || key.includes("national hockey league")) return { logo: "NHL" };
    if (key.includes("formula 1")) return { logo: "F1" };
    if (key.includes("nascar")) return { logo: "NASCAR" };
    if (key.includes("indycar")) return { logo: "INDY" };
    return { logo: "LG" };
}

function slugify(input: string) {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
}

function hashColor(input: string) {
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
        hash = input.charCodeAt(i) + ((hash << 5) - hash);
    }
    const palette = ["#1D3557", "#E63946", "#2A9D8F", "#264653", "#F4A261", "#8D99AE", "#457B9D", "#6A4C93"];
    return palette[Math.abs(hash) % palette.length];
}

type NationalTeamMeta = {
    countryCode: string;
    flagCode: string;
    shortName: string;
};

const NATIONAL_TEAM_META_BY_NAME: Record<string, NationalTeamMeta> = {
    "Albania": { countryCode: "AL", flagCode: "al", shortName: "ALB" },
    "Algeria": { countryCode: "DZ", flagCode: "dz", shortName: "ALG" },
    "Argentina": { countryCode: "AR", flagCode: "ar", shortName: "ARG" },
    "Armenia": { countryCode: "AM", flagCode: "am", shortName: "ARM" },
    "Australia": { countryCode: "AU", flagCode: "au", shortName: "AUS" },
    "Austria": { countryCode: "AT", flagCode: "at", shortName: "AUT" },
    "Azerbaijan": { countryCode: "AZ", flagCode: "az", shortName: "AZE" },
    "Belgium": { countryCode: "BE", flagCode: "be", shortName: "BEL" },
    "Bolivia": { countryCode: "BO", flagCode: "bo", shortName: "BOL" },
    "Bosnia and Herzegovina": { countryCode: "BA", flagCode: "ba", shortName: "BIH" },
    "Brazil": { countryCode: "BR", flagCode: "br", shortName: "BRA" },
    "Cameroon": { countryCode: "CM", flagCode: "cm", shortName: "CMR" },
    "Canada": { countryCode: "CA", flagCode: "ca", shortName: "CAN" },
    "Cape Verde": { countryCode: "CV", flagCode: "cv", shortName: "CPV" },
    "Chile": { countryCode: "CL", flagCode: "cl", shortName: "CHI" },
    "Colombia": { countryCode: "CO", flagCode: "co", shortName: "COL" },
    "Costa Rica": { countryCode: "CR", flagCode: "cr", shortName: "CRC" },
    "Croatia": { countryCode: "HR", flagCode: "hr", shortName: "CRO" },
    "Curaçao": { countryCode: "CW", flagCode: "cw", shortName: "CUW" },
    "Czechia": { countryCode: "CZ", flagCode: "cz", shortName: "CZE" },
    "Denmark": { countryCode: "DK", flagCode: "dk", shortName: "DEN" },
    "Ecuador": { countryCode: "EC", flagCode: "ec", shortName: "ECU" },
    "Egypt": { countryCode: "EG", flagCode: "eg", shortName: "EGY" },
    "England": { countryCode: "GB-ENG", flagCode: "gb-eng", shortName: "ENG" },
    "Finland": { countryCode: "FI", flagCode: "fi", shortName: "FIN" },
    "France": { countryCode: "FR", flagCode: "fr", shortName: "FRA" },
    "Georgia": { countryCode: "GE", flagCode: "ge", shortName: "GEO" },
    "Germany": { countryCode: "DE", flagCode: "de", shortName: "GER" },
    "Ghana": { countryCode: "GH", flagCode: "gh", shortName: "GHA" },
    "Greece": { countryCode: "GR", flagCode: "gr", shortName: "GRE" },
    "Haiti": { countryCode: "HT", flagCode: "ht", shortName: "HAI" },
    "Honduras": { countryCode: "HN", flagCode: "hn", shortName: "HON" },
    "Hungary": { countryCode: "HU", flagCode: "hu", shortName: "HUN" },
    "Iceland": { countryCode: "IS", flagCode: "is", shortName: "ISL" },
    "Iran": { countryCode: "IR", flagCode: "ir", shortName: "IRN" },
    "Ireland": { countryCode: "IE", flagCode: "ie", shortName: "IRL" },
    "Israel": { countryCode: "IL", flagCode: "il", shortName: "ISR" },
    "Italy": { countryCode: "IT", flagCode: "it", shortName: "ITA" },
    "Ivory Coast": { countryCode: "CI", flagCode: "ci", shortName: "CIV" },
    "Jamaica": { countryCode: "JM", flagCode: "jm", shortName: "JAM" },
    "Japan": { countryCode: "JP", flagCode: "jp", shortName: "JPN" },
    "Jordan": { countryCode: "JO", flagCode: "jo", shortName: "JOR" },
    "Kosovo": { countryCode: "XK", flagCode: "xk", shortName: "KOS" },
    "Mexico": { countryCode: "MX", flagCode: "mx", shortName: "MEX" },
    "Montenegro": { countryCode: "ME", flagCode: "me", shortName: "MNE" },
    "Morocco": { countryCode: "MA", flagCode: "ma", shortName: "MAR" },
    "Netherlands": { countryCode: "NL", flagCode: "nl", shortName: "NED" },
    "New Zealand": { countryCode: "NZ", flagCode: "nz", shortName: "NZL" },
    "Nigeria": { countryCode: "NG", flagCode: "ng", shortName: "NGA" },
    "Northern Ireland": { countryCode: "GB-NIR", flagCode: "gb-nir", shortName: "NIR" },
    "North Macedonia": { countryCode: "MK", flagCode: "mk", shortName: "MKD" },
    "Norway": { countryCode: "NO", flagCode: "no", shortName: "NOR" },
    "Panama": { countryCode: "PA", flagCode: "pa", shortName: "PAN" },
    "Paraguay": { countryCode: "PY", flagCode: "py", shortName: "PAR" },
    "Peru": { countryCode: "PE", flagCode: "pe", shortName: "PER" },
    "Poland": { countryCode: "PL", flagCode: "pl", shortName: "POL" },
    "Portugal": { countryCode: "PT", flagCode: "pt", shortName: "POR" },
    "Qatar": { countryCode: "QA", flagCode: "qa", shortName: "QAT" },
    "Romania": { countryCode: "RO", flagCode: "ro", shortName: "ROU" },
    "Saudi Arabia": { countryCode: "SA", flagCode: "sa", shortName: "KSA" },
    "Scotland": { countryCode: "GB-SCT", flagCode: "gb-sct", shortName: "SCO" },
    "Senegal": { countryCode: "SN", flagCode: "sn", shortName: "SEN" },
    "Serbia": { countryCode: "RS", flagCode: "rs", shortName: "SRB" },
    "Slovakia": { countryCode: "SK", flagCode: "sk", shortName: "SVK" },
    "Slovenia": { countryCode: "SI", flagCode: "si", shortName: "SVN" },
    "South Africa": { countryCode: "ZA", flagCode: "za", shortName: "RSA" },
    "South Korea": { countryCode: "KR", flagCode: "kr", shortName: "KOR" },
    "Spain": { countryCode: "ES", flagCode: "es", shortName: "ESP" },
    "Sweden": { countryCode: "SE", flagCode: "se", shortName: "SWE" },
    "Switzerland": { countryCode: "CH", flagCode: "ch", shortName: "SUI" },
    "Tunisia": { countryCode: "TN", flagCode: "tn", shortName: "TUN" },
    "Turkey": { countryCode: "TR", flagCode: "tr", shortName: "TUR" },
    "Ukraine": { countryCode: "UA", flagCode: "ua", shortName: "UKR" },
    "United Arab Emirates": { countryCode: "AE", flagCode: "ae", shortName: "UAE" },
    "United States": { countryCode: "US", flagCode: "us", shortName: "USA" },
    "Uruguay": { countryCode: "UY", flagCode: "uy", shortName: "URU" },
    "Uzbekistan": { countryCode: "UZ", flagCode: "uz", shortName: "UZB" },
    "Venezuela": { countryCode: "VE", flagCode: "ve", shortName: "VEN" },
    "Wales": { countryCode: "GB-WLS", flagCode: "gb-wls", shortName: "WAL" },
};

const NATIONAL_TEAM_ALIASES: Record<string, string> = {
    usa: "United States",
    us: "United States",
    usmnt: "United States",
    "united states of america": "United States",
    mex: "Mexico",
    eng: "England",
    sco: "Scotland",
    wal: "Wales",
    nir: "Northern Ireland",
    ni: "Northern Ireland",
    "cote d ivoire": "Ivory Coast",
    "cote divoire": "Ivory Coast",
    "cape verde islands": "Cape Verde",
    curacao: "Curaçao",
    "czech republic": "Czechia",
    "korea republic": "South Korea",
    "republic of korea": "South Korea",
    korea: "South Korea",
    uae: "United Arab Emirates",
    ksa: "Saudi Arabia",
};

function normalizeTeamKey(input: string) {
    return input
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function resolveNationalTeamMeta(name: string) {
    const normalized = normalizeTeamKey(name);
    const canonical = NATIONAL_TEAM_ALIASES[normalized]
        || Object.keys(NATIONAL_TEAM_META_BY_NAME).find((candidate) => normalizeTeamKey(candidate) === normalized);
    return canonical ? NATIONAL_TEAM_META_BY_NAME[canonical] : null;
}

function buildFlagImageUrl(flagCode: string) {
    return `${FLAG_CDN_BASE}/w80/${flagCode.toLowerCase()}.png`;
}

function toShortName(name: string) {
    const national = resolveNationalTeamMeta(name);
    if (national) return national.shortName;
    const words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
    if (words.length === 2) return words.map((w) => w[0]).join("").toUpperCase();
    return words.slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function toFlagOrBall(name: string) {
    const national = resolveNationalTeamMeta(name);
    return national?.shortName || "TEAM";
}

function toCountry(name: string) {
    return resolveNationalTeamMeta(name)?.countryCode || "INT";
}

function toEventTimeLabel(isoOrNull: string | null | undefined) {
    if (!isoOrNull) return "TBD";
    const d = new Date(isoOrNull);
    if (Number.isNaN(d.getTime())) return "TBD";
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function shouldSkipBootstrapFetch(pathname: string) {
    return pathname === "/login"
        || pathname === "/signup"
        || pathname === "/register"
        || pathname === "/register-venue"
        || pathname.startsWith("/for-venues/register")
        || pathname.startsWith("/admin")
        || pathname.startsWith("/jazzbai");
}

function getVenueDetailSlug(pathname: string) {
    if (!pathname.startsWith("/venues/")) return null;
    const slug = pathname.slice("/venues/".length).split("/")[0]?.trim();
    if (!slug || slug === "[slug]") return null;
    return slug;
}

function getVenueBootstrapMaxPages(pathname: string) {
    return pathname.startsWith("/venues") ? VENUE_DEEP_MAX_PAGES : VENUE_MAX_PAGES;
}

function authHeader(): Record<string, string> {
    if (typeof window === "undefined") return {};
    const token = localStorage.getItem("accessToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
}

async function safeFetchEnvelope<T>(endpoint: string): Promise<ApiEnvelope<T> | null> {
    try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                "Content-Type": "application/json",
                ...authHeader(),
            },
            credentials: "include",
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return null;
        const json = await res.json();
        return {
            data: (json.data ?? null) as T | null,
            meta: json.meta as ApiMeta | undefined,
        };
    } catch {
        return null;
    }
}

async function safeFetch<T>(endpoint: string): Promise<T | null> {
    const envelope = await safeFetchEnvelope<T>(endpoint);
    return envelope?.data ?? null;
}

async function safeFetchPaginated<T>(
    endpoint: string,
    limit: number,
    maxPages: number,
): Promise<T[] | null> {
    const rows: T[] = [];
    let page = 1;
    let totalPages = 1;
    let hadSuccessfulPage = false;

    while (page <= totalPages && page <= maxPages) {
        const pageEndpoint = `${endpoint}${endpoint.includes("?") ? "&" : "?"}page=${page}&limit=${limit}`;
        const envelope = await safeFetchEnvelope<T[]>(pageEndpoint);
        if (!envelope) {
            return hadSuccessfulPage ? rows : null;
        }

        hadSuccessfulPage = true;
        const data = Array.isArray(envelope.data) ? envelope.data : [];
        rows.push(...data);

        totalPages = Number(envelope.meta?.totalPages || page);
        if (data.length === 0) break;
        page += 1;
    }

    return rows;
}

async function fetchPrioritySoccerMatches(): Promise<{ matches: ApiMatch[]; facets: ApiMatchFacets | null }> {
    const facets = await safeFetch<ApiMatchFacets>("/matches/facets");
    if (!facets) {
        return { matches: [], facets: null };
    }

    const targetLeagues = facets.leagues.filter((league) => {
        const candidates = [league.name, league.shortName]
            .map((value) => sanitizeLegalText(value || "").trim().toLowerCase())
            .filter(Boolean);
        return HOME_PRIORITY_SOCCER_LEAGUE_MATCHERS.some((matcher) => candidates.some((candidate) => matcher(candidate)));
    });

    if (targetLeagues.length === 0) {
        return { matches: [], facets };
    }

    const matchGroups = await Promise.all(
        targetLeagues.map((league) =>
            safeFetchPaginated<ApiMatch>(`/matches?sort=date_asc&upcoming_only=true&league_id=${league.id}`, MATCH_FETCH_LIMIT, 1),
        ),
    );

    const merged = new Map<string, ApiMatch>();
    for (const rows of matchGroups) {
        for (const match of rows || []) {
            merged.set(match.id, match);
        }
    }

    return { matches: Array.from(merged.values()), facets };
}

export function DataProvider({ children }: { children: ReactNode }) {
    const [matches, setMatches] = useState<Match[]>(MATCHES);
    const [venues, setVenues] = useState<Venue[]>(VENUES);
    const [leagues, setLeagues] = useState<League[]>(LEAGUES);
    const [sports, setSports] = useState<Sport[]>([{ id: "soccer", name: "Soccer", slug: "soccer", shortName: "SOC" }]);
    const [teams, setTeams] = useState<Team[]>(ALL_TEAMS);
    const [venueEvents, setVenueEvents] = useState<VenueEvent[]>(VENUE_EVENTS);
    const [reviews, setReviews] = useState<Review[]>(REVIEWS);
    const [posts, setPosts] = useState<Post[]>(POSTS);
    const [bookings, setBookings] = useState<Booking[]>(BOOKINGS);
    const [users] = useState<User[]>([]);
    const [adminStats] = useState(ADMIN_STATS || EMPTY_ADMIN_STATS);
    const [isApiConnected, setIsApiConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const fetchFromApi = useCallback(async () => {
        const pathname = typeof window !== "undefined" ? window.location.pathname : "";

        if (pathname && shouldSkipBootstrapFetch(pathname)) {
            setIsLoading(false);
            return;
        }

        if (!isApiConnected) {
            setIsLoading(true);
        }

        const hasToken = typeof window !== "undefined" && Boolean(localStorage.getItem("accessToken"));
        const venueBootstrapMaxPages = getVenueBootstrapMaxPages(pathname);
        const [apiMatches, apiVenues, apiBookings, prioritySoccerPayload] = await Promise.all([
            safeFetchPaginated<ApiMatch>("/matches?sort=date_asc", MATCH_FETCH_LIMIT, MATCH_MAX_PAGES),
            safeFetchPaginated<any>("/venues?sort=featured", VENUE_FETCH_LIMIT, venueBootstrapMaxPages),
            hasToken ? safeFetch<any[]>(`/bookings?page=1&limit=${BOOKING_FETCH_LIMIT}`) : Promise.resolve([] as any[]),
            fetchPrioritySoccerMatches(),
        ]);

        if (!apiMatches || !apiVenues) {
            setIsApiConnected(false);
            setIsLoading(false);
            return;
        }

        const mergedApiMatchMap = new Map<string, ApiMatch>();
        for (const match of apiMatches) {
            mergedApiMatchMap.set(match.id, match);
        }
        for (const match of prioritySoccerPayload.matches) {
            mergedApiMatchMap.set(match.id, match);
        }
        const allApiMatches = Array.from(mergedApiMatchMap.values()).sort((a, b) => {
            const aTs = new Date(a.matchDateUtc || "").getTime();
            const bTs = new Date(b.matchDateUtc || "").getTime();
            return aTs - bTs;
        });

        const teamMap = new Map<string, Team>();
        const leagueMap = new Map<string, League>();
        const sportMap = new Map<string, Sport>();

        const upsertSport = (input: { id: string; name: string; slug: string; shortName?: string | null }) => {
            if (!input.id || !input.name || !input.slug) return;
            const existing = sportMap.get(input.id);
            if (existing) {
                sportMap.set(input.id, {
                    ...existing,
                    name: existing.name || input.name,
                    slug: existing.slug || input.slug,
                    shortName: existing.shortName || input.shortName || undefined,
                });
                return;
            }
            sportMap.set(input.id, {
                id: input.id,
                name: input.name,
                slug: input.slug,
                shortName: input.shortName || undefined,
            });
        };

        const upsertLeague = (leagueInput: {
            id: string;
            sportId?: string | null;
            name: string;
            shortName?: string | null;
            logoUrl?: string | null;
        }) => {
            const safeName = sanitizeLegalText(leagueInput.name);
            const safeShortName = sanitizeLegalText(leagueInput.shortName || leagueInput.name);
            const branding = resolveLeagueBranding(safeName, leagueInput.logoUrl);
            const inferredSport = inferSportFromLeague(safeName);
            const sportId = leagueInput.sportId || inferredSport.id;
            upsertSport({
                id: sportId,
                name: inferredSport.name,
                slug: inferredSport.slug,
                shortName: inferredSport.shortName,
            });
            const existing = leagueMap.get(leagueInput.id);
            if (existing) {
                leagueMap.set(leagueInput.id, {
                    ...existing,
                    sportId: existing.sportId || sportId,
                    name: existing.name || safeName,
                    shortName: existing.shortName || safeShortName,
                    logo: existing.logo || branding.logo,
                    image: existing.image || branding.image,
                    country: existing.country && existing.country !== "INT" ? existing.country : inferLeagueCountry(safeName),
                });
                return;
            }

            leagueMap.set(leagueInput.id, {
                id: leagueInput.id,
                sportId,
                name: safeName,
                shortName: safeShortName,
                logo: branding.logo,
                image: branding.image,
                country: inferLeagueCountry(safeName),
                externalId: leagueInput.id,
            });
        };

        for (const sport of prioritySoccerPayload.facets?.sports || []) {
            upsertSport({
                id: sport.id,
                name: sport.name,
                slug: sport.slug,
                shortName: sport.shortName,
            });
        }

        for (const league of prioritySoccerPayload.facets?.leagues || []) {
            upsertLeague({
                id: league.id,
                sportId: league.sportId || undefined,
                name: league.name,
                shortName: league.shortName,
                logoUrl: league.logoUrl,
            });
        }

        const upsertTeam = (
            teamId: string,
            teamName: string,
            leagueId: string,
            crestUrl?: string | null,
        ) => {
            if (!teamId || !teamName) return;
            const nationalTeam = resolveNationalTeamMeta(teamName);
            const image = normalizeImageUrl(crestUrl) || (nationalTeam ? buildFlagImageUrl(nationalTeam.flagCode) : "");
            const existing = teamMap.get(teamId);
            if (existing) {
                if (!existing.image && image) {
                    teamMap.set(teamId, { ...existing, image });
                }
                return;
            }

            teamMap.set(teamId, {
                id: teamId,
                name: teamName,
                shortName: toShortName(teamName),
                crest: toFlagOrBall(teamName),
                color: hashColor(teamId),
                leagueId,
                country: toCountry(teamName),
                image,
            });
        };

        const mappedMatches: Match[] = allApiMatches.map((m) => {
            const homeTeamId = m.homeTeamId || slugify(m.homeTeamName || `home-${m.id}`);
            const awayTeamId = m.awayTeamId || slugify(m.awayTeamName || `away-${m.id}`);
            const leagueId = m.leagueId || m.league?.id || "unknown-league";
            const eventFormat = (m.eventFormat || "HEAD_TO_HEAD") as Match["eventFormat"];

            if (m.league?.id && m.league.name) {
                if (m.league.sport?.id && m.league.sport.name && m.league.sport.slug) {
                    upsertSport({
                        id: m.league.sport.id,
                        name: m.league.sport.name,
                        slug: m.league.sport.slug,
                        shortName: m.league.sport.shortName,
                    });
                }
                upsertLeague({
                    id: m.league.id,
                    sportId: m.league.sportId || m.league.sport?.id || undefined,
                    name: m.league.name,
                    shortName: m.league.shortName,
                    logoUrl: m.league.logoUrl,
                });
            }
            if (eventFormat !== "SINGLE_EVENT") {
                if (m.homeTeamName) upsertTeam(homeTeamId, m.homeTeamName, leagueId, m.homeTeamCrestUrl);
                if (m.awayTeamName) upsertTeam(awayTeamId, m.awayTeamName, leagueId, m.awayTeamCrestUrl);
            }

            const dateUtc = m.matchDateUtc || new Date().toISOString();
            return {
                id: m.id,
                isFeatured: Boolean(m.isFeatured),
                homeTeamId: eventFormat === "SINGLE_EVENT" ? undefined : homeTeamId,
                awayTeamId: eventFormat === "SINGLE_EVENT" ? undefined : awayTeamId,
                homeTeamName: m.homeTeamName || undefined,
                awayTeamName: m.awayTeamName || undefined,
                leagueId,
                matchDateUTC: dateUtc,
                status: (m.status || "SCHEDULED") as MatchStatus,
                homeScore: m.homeScore ?? null,
                awayScore: m.awayScore ?? null,
                matchDay: m.matchDay ? String(m.matchDay) : "",
                stage: m.stage || "",
                stadiumName: m.venueName || "",
                venueCount: m.venueCount || 0,
                isHot: (m.venueCount || 0) >= 10,
                eventFormat,
                eventTitle: m.eventTitle || undefined,
                eventSubtitle: m.eventSubtitle || undefined,
                youtubeVideoId: m.youtubeVideoId || undefined,
                youtubeVideoTitle: m.youtubeVideoTitle || undefined,
                youtubeChannelTitle: m.youtubeChannelTitle || undefined,
                youtubePublishedAt: m.youtubePublishedAt || undefined,
                youtubeThumbnailUrl: m.youtubeThumbnailUrl || undefined,
                youtubeEmbedUrl: m.youtubeEmbedUrl || undefined,
                youtubeSearchStatus: m.youtubeSearchStatus || undefined,
                youtubeCheckedAt: m.youtubeCheckedAt || undefined,
            };
        });

        const baseVenues = apiVenues.map((v) => {
            const withGallery = v as { galleryImageUrls?: string[] };
            return ({
            id: v.id,
            slug: v.slug,
            name: v.name,
            shortDescription: sanitizeLegalText(v.shortDescription || ""),
            description: "",
            coverImageUrl: normalizeImageUrl(v.coverImageUrl),
            galleryImageUrls: Array.isArray(withGallery.galleryImageUrls)
                ? withGallery.galleryImageUrls.map((url: string) => normalizeImageUrl(url)).filter(Boolean)
                : [],
            imageSource: v.imageSource || "none",
            coverImageAttributions: Array.isArray((v as { coverImageAttributions?: unknown[] }).coverImageAttributions)
                ? ((v as { coverImageAttributions?: Array<{ displayName: string; uri?: string | null; photoUri?: string | null }> }).coverImageAttributions || [])
                : [],
            galleryImageAttributions: Array.isArray((v as { galleryImageAttributions?: unknown[] }).galleryImageAttributions)
                ? ((v as { galleryImageAttributions?: Array<Array<{ displayName: string; uri?: string | null; photoUri?: string | null }>> }).galleryImageAttributions || [])
                : [],
            workingHours: [],
            googleEditorialSummary: null,
            googlePriceLevel: null,
            googleReviews: [],
            addressLine1: v.addressLine1 || "",
            addressLine2: "",
            city: v.city || "",
            state: v.stateProvince || "",
            postalCode: "",
            lat: Number(v.lat || 0),
            lng: Number(v.lng || 0),
            phone: "",
            website: "",
            instagram: "",
            capacity: v.capacity || 0,
            rating: Number(v.ratingOverride ?? v.averageRating ?? 0),
            reviewCount: Number(v.reviewCountOverride ?? v.totalReviews ?? 0),
            amenities: Array.isArray(v.amenities) ? v.amenities : [],
            cuisineTags: Array.isArray(v.cuisineTags) ? v.cuisineTags : [],
            priceRange: (v.priceRange || "MID") as PriceRange,
            isVerified: Boolean(v.isVerified),
            isFeatured: Boolean(v.isFeatured),
            isActive: true,
            coverColor: hashColor(v.slug || v.id),
            followerCount: 0,
            upcomingEventsCount: 0,
            totalBookings: 0,
            ownerName: "",
            ownerEmail: "",
            promotedVenueEventId: null,
            descriptionSource: null,
            shortDescriptionSource: null,
            priceRangeSource: null,
            fanTeams: Array.isArray((v as any).fanTeams) ? (v as any).fanTeams : [],
        } satisfies Venue);
        });

        const venueDetailSlug = getVenueDetailSlug(pathname);
        const detailedVenueIds = new Set<string>();
        if (venueDetailSlug) {
            const detailedVenue = baseVenues.find((venue) => venue.slug === venueDetailSlug || venue.id === venueDetailSlug);
            if (detailedVenue) {
                detailedVenueIds.add(detailedVenue.id);
            }
        }

        const venueDetails = await Promise.all(
            baseVenues.map(async (venue) => {
                const shouldFetchDeepVenueData = detailedVenueIds.has(venue.id);
                const shouldFetchVenueEvents = venueDetailSlug ? shouldFetchDeepVenueData : true;
                const venueSlugOrId = venue.slug || venue.id;
                const events = shouldFetchVenueEvents
                    ? await safeFetchPaginated<any>(`/venues/${venueSlugOrId}/events`, VENUE_FETCH_LIMIT, 6)
                    : [];

                if (!shouldFetchDeepVenueData) {
                    return { venue, detail: null, events: events || [], venuePosts: [], venueReviews: [] };
                }

                const [detail, venuePosts, venueReviews] = await Promise.all([
                    safeFetch<any>(`/venues/${venueSlugOrId}`),
                    safeFetchPaginated<any>(`/venues/${venueSlugOrId}/posts`, VENUE_FETCH_LIMIT, 6),
                    safeFetchPaginated<any>(`/venues/${venueSlugOrId}/reviews`, VENUE_FETCH_LIMIT, 6),
                ]);

                return { venue, detail, events: events || [], venuePosts: venuePosts || [], venueReviews: venueReviews || [] };

            }),
        );

        const mappedVenueEvents: VenueEvent[] = [];
        const mappedPosts: Post[] = [];
        const mappedReviews: Review[] = [];
        const mergedVenues: Venue[] = [];
        const knownMatchIds = new Set(mappedMatches.map((match) => String(match.id).trim().toLowerCase()));

        for (const row of venueDetails) {
            const detail = row.detail;
            const events = row.events;

            const totalConfirmed = events.reduce((acc, ev) => acc + Number(ev.confirmedBookingsCount || 0), 0);
            mergedVenues.push({
                ...row.venue,
                description: sanitizeLegalText(detail?.description || row.venue.shortDescription),
                coverImageUrl: normalizeImageUrl(detail?.coverImageUrl || row.venue.coverImageUrl),
                galleryImageUrls: Array.isArray(detail?.galleryImageUrls)
                    ? detail.galleryImageUrls.map((url: string) => normalizeImageUrl(url)).filter(Boolean)
                    : row.venue.galleryImageUrls || [],
                imageSource: detail?.imageSource || row.venue.imageSource || "none",
                coverImageAttributions: Array.isArray(detail?.coverImageAttributions)
                    ? detail.coverImageAttributions
                    : row.venue.coverImageAttributions || [],
                galleryImageAttributions: Array.isArray(detail?.galleryImageAttributions)
                    ? detail.galleryImageAttributions
                    : row.venue.galleryImageAttributions || [],
                workingHours: Array.isArray(detail?.workingHours) ? detail.workingHours : row.venue.workingHours || [],
                googleEditorialSummary: detail?.googleEditorialSummary ?? row.venue.googleEditorialSummary ?? null,
                googlePriceLevel: detail?.googlePriceLevel ?? row.venue.googlePriceLevel ?? null,
                googleReviews: Array.isArray(detail?.googleReviews) ? detail.googleReviews : row.venue.googleReviews || [],
                addressLine2: detail?.addressLine2 || "",
                state: detail?.stateProvince || row.venue.state || "",
                postalCode: detail?.postalCode || "",
                lat: Number(detail?.lat ?? row.venue.lat ?? 0),
                lng: Number(detail?.lng ?? row.venue.lng ?? 0),
                phone: detail?.phone || "",
                website: detail?.website || "",
                instagram: detail?.instagramHandle || "",
                capacity: Number(detail?.capacity || row.venue.capacity || 0),
                rating: Number(detail?.ratingOverride ?? detail?.averageRating ?? row.venue.rating ?? 0),
                reviewCount: Number(detail?.reviewCountOverride ?? detail?.totalReviews ?? row.venue.reviewCount ?? 0),
                amenities: Array.isArray(detail?.amenities) ? detail.amenities : row.venue.amenities,
                cuisineTags: Array.isArray(detail?.cuisineTags) ? detail.cuisineTags : row.venue.cuisineTags,
                isVerified: detail?.isVerified ?? row.venue.isVerified,
                isFeatured: detail?.isFeatured ?? row.venue.isFeatured,
                followerCount: Number(detail?.followerCount || 0),
                upcomingEventsCount: events.length,
                totalBookings: totalConfirmed,
                promotedVenueEventId: typeof detail?.promotedVenueEventId === "string"
                    ? detail.promotedVenueEventId
                    : null,
                descriptionSource: detail?.descriptionSource ?? row.venue.descriptionSource ?? null,
                shortDescriptionSource: detail?.shortDescriptionSource ?? row.venue.shortDescriptionSource ?? null,
                priceRangeSource: detail?.priceRangeSource ?? row.venue.priceRangeSource ?? null,
                fanTeams: row.venue.fanTeams ?? [],
            });

            for (const ev of events) {
                const match = ev.match as ApiMatch | undefined;
                const eventMatchIdRaw = ev.matchId || match?.id || "";
                const eventMatchId = String(eventMatchIdRaw).trim();
                const leagueId = match?.leagueId || match?.league?.id || "unknown-league";
                const homeTeamId = match?.homeTeamId || slugify(match?.homeTeamName || `home-${ev.id}`);
                const awayTeamId = match?.awayTeamId || slugify(match?.awayTeamName || `away-${ev.id}`);
                const eventFormat = ((match?.eventFormat || "HEAD_TO_HEAD") as Match["eventFormat"]);

                if (match?.league?.id && match.league.name) {
                    if (match.league.sport?.id && match.league.sport.name && match.league.sport.slug) {
                        upsertSport({
                            id: match.league.sport.id,
                            name: match.league.sport.name,
                            slug: match.league.sport.slug,
                            shortName: match.league.sport.shortName,
                        });
                    }
                    upsertLeague({
                        id: match.league.id,
                        sportId: match.league.sportId || match.league.sport?.id || undefined,
                        name: match.league.name,
                        shortName: match.league.shortName,
                        logoUrl: match.league.logoUrl,
                    });
                }
                if (eventFormat !== "SINGLE_EVENT") {
                    if (match?.homeTeamName) upsertTeam(homeTeamId, match.homeTeamName, leagueId, match.homeTeamCrestUrl);
                    if (match?.awayTeamName) upsertTeam(awayTeamId, match.awayTeamName, leagueId, match.awayTeamCrestUrl);
                }

                const normalizedEventMatchId = eventMatchId.toLowerCase();
                if (eventMatchId && !knownMatchIds.has(normalizedEventMatchId)) {
                    mappedMatches.push({
                        id: eventMatchId,
                        isFeatured: Boolean(match?.isFeatured),
                        homeTeamId: eventFormat === "SINGLE_EVENT" ? undefined : homeTeamId,
                        awayTeamId: eventFormat === "SINGLE_EVENT" ? undefined : awayTeamId,
                        homeTeamName: match?.homeTeamName || undefined,
                        awayTeamName: match?.awayTeamName || undefined,
                        leagueId,
                        matchDateUTC: match?.matchDateUtc || new Date().toISOString(),
                        status: (match?.status || "SCHEDULED") as MatchStatus,
                        homeScore: match?.homeScore ?? null,
                        awayScore: match?.awayScore ?? null,
                        matchDay: match?.matchDay ? String(match.matchDay) : "",
                        stage: match?.stage || "",
                        stadiumName: match?.venueName || "",
                        venueCount: 0,
                        isHot: false,
                        eventFormat,
                        eventTitle: match?.eventTitle || undefined,
                        eventSubtitle: match?.eventSubtitle || undefined,
                        youtubeVideoId: match?.youtubeVideoId || undefined,
                        youtubeVideoTitle: match?.youtubeVideoTitle || undefined,
                        youtubeChannelTitle: match?.youtubeChannelTitle || undefined,
                        youtubePublishedAt: match?.youtubePublishedAt || undefined,
                        youtubeThumbnailUrl: match?.youtubeThumbnailUrl || undefined,
                        youtubeEmbedUrl: match?.youtubeEmbedUrl || undefined,
                        youtubeSearchStatus: match?.youtubeSearchStatus || undefined,
                        youtubeCheckedAt: match?.youtubeCheckedAt || undefined,
                    });
                    knownMatchIds.add(normalizedEventMatchId);
                }

                if (!eventMatchId) continue;

                mappedVenueEvents.push({
                    id: ev.id,
                    venueId: ev.venueId,
                    matchId: eventMatchId,
                    isActive: ev.isActive !== false,
                    bookingLimit: ev.bookingLimit ?? null,
                    confirmedBookings: Number(ev.confirmedBookingsCount || 0),
                    specialNotes: ev.specialNotes || "",
                    entryFee: ev.customPrice != null ? Number(ev.customPrice) : null,
                    doorsOpenAt: toEventTimeLabel(ev.doorsOpenAt),
                    requiresApproval: Boolean(ev.requiresApproval),
                });
            }

            for (const post of row.venuePosts) {
                mappedPosts.push({
                    id: post.id,
                    venueId: post.venueId,
                    content: sanitizeLegalText(post.content || ""),
                    matchId: post.matchId || undefined,
                    createdAt: post.createdAt || new Date().toISOString(),
                    viewsCount: Number(post.viewsCount || 0),
                });
            }

            for (const review of row.venueReviews) {
                mappedReviews.push({
                    id: review.id,
                    venueId: review.venueId,
                    userName: review.userName || "Guest",
                    userAvatar: review.userAvatar || "User",
                    rating: Number(review.rating || 0),
                    title: sanitizeLegalText(review.title || ""),
                    content: sanitizeLegalText(review.content || ""),
                    date: review.createdAt || new Date().toISOString(),
                    isVerifiedVisit: Boolean(review.isVerifiedVisit),
                    ownerReply: review.ownerReply ? sanitizeLegalText(review.ownerReply) : undefined,
                });
            }
        }

        const mappedBookings: Booking[] = Array.isArray(apiBookings)
            ? apiBookings.map((b) => ({
                id: b.id,
                reference: b.bookingReference || b.id,
                userId: b.userId || "",
                venueEventId: b.venueEventId,
                partySize: Number(b.partySize || 1),
                specialRequests: b.specialRequests || "",
                status: b.status,
                createdAt: b.createdAt || new Date().toISOString(),
            }))
            : [];

        setMatches(mappedMatches);
        setVenues(mergedVenues);
        setLeagues(Array.from(leagueMap.values()));
        setSports(
            Array.from(sportMap.values()).length > 0
                ? Array.from(sportMap.values())
                : [{ id: 'soccer', name: 'Soccer', slug: 'soccer', shortName: 'SOC' }],
        );
        setTeams(Array.from(teamMap.values()));
        setVenueEvents(mappedVenueEvents);
        setPosts(mappedPosts);
        setReviews(mappedReviews);
        setBookings(mappedBookings);
        setIsApiConnected(true);
        setIsLoading(false);
    }, [isApiConnected]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
        void fetchFromApi();
    }, [fetchFromApi]);

    useEffect(() => {
        if (isApiConnected) return;
        if (typeof window !== "undefined" && shouldSkipBootstrapFetch(window.location.pathname)) return;
        const timer = window.setInterval(() => {
            void fetchFromApi();
        }, 5000);
        return () => window.clearInterval(timer);
    }, [isApiConnected, fetchFromApi]);

    useEffect(() => {
        // Refresh data every 5 minutes — not 30s, which hammered the API
        const timer = window.setInterval(() => {
            void fetchFromApi();
        }, 5 * 60 * 1000);
        return () => window.clearInterval(timer);
    }, [fetchFromApi]);

    useEffect(() => {
        // Only refetch on focus/visibility if data is more than 5 minutes old
        const STALE_MS = 5 * 60 * 1000;
        let lastFetchAt = Date.now();
        const originalFetch = fetchFromApi;
        const conditionalFetch = () => {
            if (Date.now() - lastFetchAt >= STALE_MS) {
                lastFetchAt = Date.now();
                void originalFetch();
            }
        };
        window.addEventListener("focus", conditionalFetch);
        document.addEventListener("visibilitychange", conditionalFetch);
        return () => {
            window.removeEventListener("focus", conditionalFetch);
            document.removeEventListener("visibilitychange", conditionalFetch);
        };
    }, [fetchFromApi]);

    const getTeam = (id?: string) => {
        if (!id) return undefined;

        const existing = teams.find((t) => t.id === id);
        if (existing) return existing;

        const sourceMatch = matches.find((match) => match.homeTeamId === id || match.awayTeamId === id);
        if (!sourceMatch) return undefined;

        const isHome = sourceMatch.homeTeamId === id;
        const fallbackName = isHome
            ? sourceMatch.homeTeamName || "Home Team"
            : sourceMatch.awayTeamName || "Away Team";

        return {
            id,
            name: fallbackName,
            shortName: toShortName(fallbackName),
            crest: toFlagOrBall(fallbackName),
            color: hashColor(id),
            leagueId: sourceMatch.leagueId,
            country: toCountry(fallbackName),
            image: "",
        } satisfies Team;
    };
    const getLeague = (id: string) => leagues.find((l) => l.id === id);
    const getSport = (id: string) => sports.find((s) => s.id === id);
    const getVenue = (idOrSlug: string) => venues.find((v) => v.id === idOrSlug || v.slug === idOrSlug);
    const getMatch = (id: string) => matches.find((m) => m.id === id);

    const getVenueEventsForMatch = (matchId: string) => {
        const target = String(matchId).trim().toLowerCase();
        return venueEvents
            .filter((ve) => String(ve.matchId).trim().toLowerCase() === target)
            .map((ve) => ({ ...ve, venue: venues.find((v) => v.id === ve.venueId)! }))
            .filter((ve) => ve.venue);
    };

    const getVenueReviewsForVenue = (venueId: string) => reviews.filter((r) => r.venueId === venueId);
    const getVenuePostsForVenue = (venueId: string) => posts.filter((p) => p.venueId === venueId);

    const getVenueMatchEvents = (venueId: string) =>
        venueEvents
            .filter((ve) => ve.venueId === venueId)
            .map((ve) => ({
                ...ve,
                match: matches.find((m) => String(m.id).trim().toLowerCase() === String(ve.matchId).trim().toLowerCase())!,
            }))
            .filter((ve) => ve.match);

    return (
        <DataContext.Provider
            value={{
                matches,
                venues,
                leagues,
                sports,
                teams,
                venueEvents,
                reviews,
                posts,
                bookings,
                users,
                adminStats,
                isApiConnected,
                isLoading,
                getTeam,
                getLeague,
                getSport,
                getVenue,
                getMatch,
                getVenueEvents: getVenueEventsForMatch,
                getVenueReviews: getVenueReviewsForVenue,
                getVenuePosts: getVenuePostsForVenue,
                getVenueMatchEvents,
                refetch: fetchFromApi,
            }}
        >
            {children}
        </DataContext.Provider>
    );
}

export function useData(): DataContextType {
    const ctx = useContext(DataContext);
    if (!ctx) throw new Error("useData must be used within DataProvider");
    return ctx;
}

export { AMENITY_LABELS, PRICE_LABELS };
export type { Match, Venue, League, Sport, Team, VenueEvent, Review, Post, Booking, User, MatchStatus, PriceRange };
