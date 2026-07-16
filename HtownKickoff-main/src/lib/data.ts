/* ═══════════════════════════════════════════════════
   MATCHWATCH — Shared Data Fixtures
   Full dummy data for all pages: teams, leagues,
   matches, venues, bookings, users, posts.
   ═══════════════════════════════════════════════════ */

// ─── Country Labels ─────────────────────────────
export const FLAGS: Record<string, string> = {
    US: "US", MX: "MX", BR: "BR", AR: "AR", DE: "DE",
    GB: "GB", ES: "ES", FR: "FR", IT: "IT", PT: "PT",
    NL: "NL", BE: "BE", JP: "JP", KR: "KR", SA: "SA",
    QA: "QA", AU: "AU", CA: "CA", CO: "CO", UY: "UY",
    CR: "CR", GH: "GH", SN: "SN", NG: "NG", CM: "CM",
    MA: "MA", TN: "TN", PL: "PL", HR: "HR", RS: "RS",
    CH: "CH", DK: "DK", SE: "SE", EC: "EC", CL: "CL",
    PE: "PE", VE: "VE", PY: "PY", JM: "JM", HN: "HN",
};

// ─── League Data ─────────────────────────────────
export interface Sport {
    id: string;
    name: string;
    slug: string;
    shortName?: string;
}

export interface League {
    id: string;
    sportId?: string;
    name: string;
    shortName: string;
    logo: string;
    image?: string;
    country: string;
    externalId: string;
}

export const LEAGUES: League[] = [
    { id: "wc-2026", sportId: "soccer", name: "Global Finals 2026", shortName: "Global Finals", logo: "WC", country: "US/MX/CA", externalId: "WC" },
    { id: "mls", sportId: "soccer", name: "Major League Soccer", shortName: "MLS", logo: "MLS", country: "US", externalId: "MLS" },
    { id: "epl", sportId: "soccer", name: "English Premier League", shortName: "EPL", logo: "EPL", image: "/epl-logo.webp", country: "GB", externalId: "PL" },
    { id: "laliga", sportId: "soccer", name: "La Liga", shortName: "La Liga", logo: "LL", image: "/laliga-logo.webp", country: "ES", externalId: "PD" },
    { id: "bundesliga", sportId: "soccer", name: "Bundesliga", shortName: "Bundesliga", logo: "BL", image: "/bundesliga-logo.svg", country: "DE", externalId: "BL1" },
    { id: "seriea", sportId: "soccer", name: "Serie A", shortName: "Serie A", logo: "SA", image: "/seriea-logo.png", country: "IT", externalId: "SA" },
    { id: "ligue1", sportId: "soccer", name: "Ligue 1", shortName: "Ligue 1", logo: "L1", country: "FR", externalId: "FL1" },
    { id: "ucl", sportId: "soccer", name: "UEFA Champions League", shortName: "UCL", logo: "UCL", country: "EU", externalId: "CL" },
    { id: "ligamx", sportId: "soccer", name: "Liga MX", shortName: "Liga MX", logo: "LMX", country: "MX", externalId: "LMX" },
    { id: "nwsl", sportId: "soccer", name: "NWSL", shortName: "NWSL", logo: "NWSL", country: "US", externalId: "NWSL" },
    { id: "mlb", sportId: "baseball", name: "Major League Baseball", shortName: "MLB", logo: "MLB", country: "US", externalId: "MLB" },
];

// ─── Country ─────────────────────────────────────
export interface Country {
    id: string;
    name: string;
    iso2: string;
    iso3: string;
    fifaCode?: string | null;
    iocCode?: string | null;
    flagEmoji?: string | null;
    flagSvgUrl?: string | null;
}

// ─── Team / National Team Data ───────────────────
export interface Team {
    id: string;
    name: string;
    shortName: string;
    crest: string; // text fallback when logo image is unavailable
    color: string; // primary kit color
    leagueId: string;
    country: string;
    image: string; // team logo/flag image path
    countryId?: string | null;
    teamType?: 'national_team' | 'club' | 'franchise';
}

const TEAM_IMAGES = ["/argentina.png", "/germany.png", "/brazil.png", "/real-madrid.png", "/barcelona.png"];

export const NATIONAL_TEAMS: Team[] = [
    { id: "usa", name: "United States", shortName: "USA", crest: "TEAM", color: "#002868", leagueId: "wc-2026", country: "US", image: TEAM_IMAGES[0] },
    { id: "mexico", name: "Mexico", shortName: "MEX", crest: "TEAM", color: "#006847", leagueId: "wc-2026", country: "MX", image: TEAM_IMAGES[1] },
    { id: "brazil", name: "Brazil", shortName: "BRA", crest: "TEAM", color: "#FFDF00", leagueId: "wc-2026", country: "BR", image: TEAM_IMAGES[2] },
    { id: "argentina", name: "Argentina", shortName: "ARG", crest: "TEAM", color: "#75AADB", leagueId: "wc-2026", country: "AR", image: TEAM_IMAGES[0] },
    { id: "germany", name: "Germany", shortName: "GER", crest: "TEAM", color: "#000000", leagueId: "wc-2026", country: "DE", image: TEAM_IMAGES[1] },
    { id: "england", name: "England", shortName: "ENG", crest: "TEAM", color: "#FFFFFF", leagueId: "wc-2026", country: "GB", image: TEAM_IMAGES[2] },
    { id: "france", name: "France", shortName: "FRA", crest: "TEAM", color: "#002395", leagueId: "wc-2026", country: "FR", image: TEAM_IMAGES[3] },
    { id: "spain", name: "Spain", shortName: "ESP", crest: "TEAM", color: "#AA151B", leagueId: "wc-2026", country: "ES", image: TEAM_IMAGES[4] },
    { id: "portugal", name: "Portugal", shortName: "POR", crest: "TEAM", color: "#006600", leagueId: "wc-2026", country: "PT", image: TEAM_IMAGES[0] },
    { id: "netherlands", name: "Netherlands", shortName: "NED", crest: "TEAM", color: "#FF6600", leagueId: "wc-2026", country: "NL", image: TEAM_IMAGES[1] },
    { id: "belgium", name: "Belgium", shortName: "BEL", crest: "TEAM", color: "#ED2939", leagueId: "wc-2026", country: "BE", image: TEAM_IMAGES[2] },
    { id: "japan", name: "Japan", shortName: "JPN", crest: "TEAM", color: "#000080", leagueId: "wc-2026", country: "JP", image: TEAM_IMAGES[3] },
    { id: "korea", name: "South Korea", shortName: "KOR", crest: "TEAM", color: "#C60C30", leagueId: "wc-2026", country: "KR", image: TEAM_IMAGES[4] },
    { id: "senegal", name: "Senegal", shortName: "SEN", crest: "TEAM", color: "#00853F", leagueId: "wc-2026", country: "SN", image: TEAM_IMAGES[0] },
    { id: "morocco", name: "Morocco", shortName: "MAR", crest: "TEAM", color: "#C1272D", leagueId: "wc-2026", country: "MA", image: TEAM_IMAGES[1] },
    { id: "canada", name: "Canada", shortName: "CAN", crest: "TEAM", color: "#FF0000", leagueId: "wc-2026", country: "CA", image: TEAM_IMAGES[2] },
    { id: "colombia", name: "Colombia", shortName: "COL", crest: "TEAM", color: "#FCD116", leagueId: "wc-2026", country: "CO", image: TEAM_IMAGES[3] },
    { id: "uruguay", name: "Uruguay", shortName: "URU", crest: "TEAM", color: "#001489", leagueId: "wc-2026", country: "UY", image: TEAM_IMAGES[4] },
    { id: "croatia", name: "Croatia", shortName: "CRO", crest: "TEAM", color: "#FF0000", leagueId: "wc-2026", country: "HR", image: TEAM_IMAGES[0] },
    { id: "switzerland", name: "Switzerland", shortName: "SUI", crest: "TEAM", color: "#FF0000", leagueId: "wc-2026", country: "CH", image: TEAM_IMAGES[1] },
    { id: "ghana", name: "Ghana", shortName: "GHA", crest: "TEAM", color: "#FFFFFF", leagueId: "wc-2026", country: "GH", image: TEAM_IMAGES[2] },
    { id: "nigeria", name: "Nigeria", shortName: "NGA", crest: "TEAM", color: "#008751", leagueId: "wc-2026", country: "NG", image: TEAM_IMAGES[3] },
    { id: "cameroon", name: "Cameroon", shortName: "CMR", crest: "TEAM", color: "#007A5E", leagueId: "wc-2026", country: "CM", image: TEAM_IMAGES[4] },
    { id: "costarica", name: "Costa Rica", shortName: "CRC", crest: "TEAM", color: "#CE1126", leagueId: "wc-2026", country: "CR", image: TEAM_IMAGES[0] },
];

export const CLUB_TEAMS: Team[] = [
    // MLS
    { id: "dynamo", name: "Houston Dynamo FC", shortName: "Dynamo", crest: "TEAM", color: "#F68712", leagueId: "mls", country: "US", image: TEAM_IMAGES[1] },
    { id: "austin", name: "Austin FC", shortName: "Austin", crest: "TEAM", color: "#00B140", leagueId: "mls", country: "US", image: TEAM_IMAGES[2] },
    { id: "lafc", name: "Los Angeles FC", shortName: "LAFC", crest: "TEAM", color: "#C39E6D", leagueId: "mls", country: "US", image: TEAM_IMAGES[3] },
    { id: "inter-miami", name: "Inter Miami CF", shortName: "Miami", crest: "TEAM", color: "#F7B5CD", leagueId: "mls", country: "US", image: TEAM_IMAGES[4] },
    { id: "fc-dallas", name: "FC Dallas", shortName: "Dallas", crest: "TEAM", color: "#BF0D3E", leagueId: "mls", country: "US", image: TEAM_IMAGES[0] },
    // EPL
    { id: "mancity", name: "Manchester City", shortName: "Man City", crest: "TEAM", color: "#6CABDD", leagueId: "epl", country: "GB", image: TEAM_IMAGES[1] },
    { id: "liverpool", name: "Liverpool FC", shortName: "Liverpool", crest: "TEAM", color: "#C8102E", leagueId: "epl", country: "GB", image: TEAM_IMAGES[2] },
    { id: "arsenal", name: "Arsenal FC", shortName: "Arsenal", crest: "TEAM", color: "#EF0107", leagueId: "epl", country: "GB", image: TEAM_IMAGES[3] },
    { id: "chelsea", name: "Chelsea FC", shortName: "Chelsea", crest: "TEAM", color: "#034694", leagueId: "epl", country: "GB", image: TEAM_IMAGES[4] },
    { id: "man-utd", name: "Manchester United", shortName: "Man Utd", crest: "TEAM", color: "#DA291C", leagueId: "epl", country: "GB", image: TEAM_IMAGES[0] },
    { id: "tottenham", name: "Tottenham Hotspur", shortName: "Spurs", crest: "TEAM", color: "#132257", leagueId: "epl", country: "GB", image: TEAM_IMAGES[1] },
    // La Liga
    { id: "realmadrid", name: "Real Madrid", shortName: "R. Madrid", crest: "TEAM", color: "#FEBE10", leagueId: "laliga", country: "ES", image: TEAM_IMAGES[3] },
    { id: "barcelona", name: "FC Barcelona", shortName: "Barcelona", crest: "TEAM", color: "#A50044", leagueId: "laliga", country: "ES", image: TEAM_IMAGES[4] },
    { id: "atletico", name: "Atlético Madrid", shortName: "Atlético", crest: "TEAM", color: "#CE3524", leagueId: "laliga", country: "ES", image: TEAM_IMAGES[0] },
    // Liga MX
    { id: "america", name: "Club América", shortName: "América", crest: "TEAM", color: "#FFD200", leagueId: "ligamx", country: "MX", image: TEAM_IMAGES[1] },
    { id: "chivas", name: "CD Guadalajara", shortName: "Chivas", crest: "TEAM", color: "#CD0E2C", leagueId: "ligamx", country: "MX", image: TEAM_IMAGES[2] },
    { id: "tigres", name: "Tigres UANL", shortName: "Tigres", crest: "TEAM", color: "#FDB913", leagueId: "ligamx", country: "MX", image: TEAM_IMAGES[3] },
    // MLB — American League East
    { id: "baltimore-orioles", name: "Baltimore Orioles", shortName: "Orioles", crest: "TEAM", color: "#DF4601", leagueId: "mlb", country: "US", image: "", teamType: "franchise" },
    { id: "boston-red-sox", name: "Boston Red Sox", shortName: "Red Sox", crest: "TEAM", color: "#BD3039", leagueId: "mlb", country: "US", image: "", teamType: "franchise" },
    { id: "new-york-yankees", name: "New York Yankees", shortName: "Yankees", crest: "TEAM", color: "#0C2340", leagueId: "mlb", country: "US", image: "", teamType: "franchise" },
    { id: "tampa-bay-rays", name: "Tampa Bay Rays", shortName: "Rays", crest: "TEAM", color: "#092C5C", leagueId: "mlb", country: "US", image: "", teamType: "franchise" },
    { id: "toronto-blue-jays", name: "Toronto Blue Jays", shortName: "Blue Jays", crest: "TEAM", color: "#134A8E", leagueId: "mlb", country: "CA", image: "", teamType: "franchise" },
    // MLB — American League Central
    { id: "chicago-white-sox", name: "Chicago White Sox", shortName: "White Sox", crest: "TEAM", color: "#27251F", leagueId: "mlb", country: "US", image: "", teamType: "franchise" },
    { id: "cleveland-guardians", name: "Cleveland Guardians", shortName: "Guardians", crest: "TEAM", color: "#0C2340", leagueId: "mlb", country: "US", image: "", teamType: "franchise" },
    { id: "detroit-tigers", name: "Detroit Tigers", shortName: "Tigers", crest: "TEAM", color: "#0C2340", leagueId: "mlb", country: "US", image: "", teamType: "franchise" },
    { id: "kansas-city-royals", name: "Kansas City Royals", shortName: "Royals", crest: "TEAM", color: "#004687", leagueId: "mlb", country: "US", image: "", teamType: "franchise" },
    { id: "minnesota-twins", name: "Minnesota Twins", shortName: "Twins", crest: "TEAM", color: "#002B5C", leagueId: "mlb", country: "US", image: "", teamType: "franchise" },
    // MLB — American League West
    { id: "houston-astros", name: "Houston Astros", shortName: "Astros", crest: "TEAM", color: "#002D62", leagueId: "mlb", country: "US", image: "", teamType: "franchise" },
    { id: "los-angeles-angels", name: "Los Angeles Angels", shortName: "Angels", crest: "TEAM", color: "#BA0021", leagueId: "mlb", country: "US", image: "", teamType: "franchise" },
    { id: "athletics", name: "Athletics", shortName: "Athletics", crest: "TEAM", color: "#003831", leagueId: "mlb", country: "US", image: "", teamType: "franchise" },
    { id: "seattle-mariners", name: "Seattle Mariners", shortName: "Mariners", crest: "TEAM", color: "#0C2C56", leagueId: "mlb", country: "US", image: "", teamType: "franchise" },
    { id: "texas-rangers", name: "Texas Rangers", shortName: "Rangers", crest: "TEAM", color: "#003278", leagueId: "mlb", country: "US", image: "", teamType: "franchise" },
    // MLB — National League East
    { id: "atlanta-braves", name: "Atlanta Braves", shortName: "Braves", crest: "TEAM", color: "#CE1141", leagueId: "mlb", country: "US", image: "", teamType: "franchise" },
    { id: "miami-marlins", name: "Miami Marlins", shortName: "Marlins", crest: "TEAM", color: "#00A3E0", leagueId: "mlb", country: "US", image: "", teamType: "franchise" },
    { id: "new-york-mets", name: "New York Mets", shortName: "Mets", crest: "TEAM", color: "#002D72", leagueId: "mlb", country: "US", image: "", teamType: "franchise" },
    { id: "philadelphia-phillies", name: "Philadelphia Phillies", shortName: "Phillies", crest: "TEAM", color: "#E81828", leagueId: "mlb", country: "US", image: "", teamType: "franchise" },
    { id: "washington-nationals", name: "Washington Nationals", shortName: "Nationals", crest: "TEAM", color: "#AB0003", leagueId: "mlb", country: "US", image: "", teamType: "franchise" },
    // MLB — National League Central
    { id: "chicago-cubs", name: "Chicago Cubs", shortName: "Cubs", crest: "TEAM", color: "#0E3386", leagueId: "mlb", country: "US", image: "", teamType: "franchise" },
    { id: "cincinnati-reds", name: "Cincinnati Reds", shortName: "Reds", crest: "TEAM", color: "#C6011F", leagueId: "mlb", country: "US", image: "", teamType: "franchise" },
    { id: "milwaukee-brewers", name: "Milwaukee Brewers", shortName: "Brewers", crest: "TEAM", color: "#12284B", leagueId: "mlb", country: "US", image: "", teamType: "franchise" },
    { id: "pittsburgh-pirates", name: "Pittsburgh Pirates", shortName: "Pirates", crest: "TEAM", color: "#27251F", leagueId: "mlb", country: "US", image: "", teamType: "franchise" },
    { id: "st-louis-cardinals", name: "St. Louis Cardinals", shortName: "Cardinals", crest: "TEAM", color: "#C41E3A", leagueId: "mlb", country: "US", image: "", teamType: "franchise" },
    // MLB — National League West
    { id: "arizona-diamondbacks", name: "Arizona Diamondbacks", shortName: "D-backs", crest: "TEAM", color: "#A71930", leagueId: "mlb", country: "US", image: "", teamType: "franchise" },
    { id: "colorado-rockies", name: "Colorado Rockies", shortName: "Rockies", crest: "TEAM", color: "#333366", leagueId: "mlb", country: "US", image: "", teamType: "franchise" },
    { id: "los-angeles-dodgers", name: "Los Angeles Dodgers", shortName: "Dodgers", crest: "TEAM", color: "#005A9C", leagueId: "mlb", country: "US", image: "", teamType: "franchise" },
    { id: "san-diego-padres", name: "San Diego Padres", shortName: "Padres", crest: "TEAM", color: "#2F241D", leagueId: "mlb", country: "US", image: "", teamType: "franchise" },
    { id: "san-francisco-giants", name: "San Francisco Giants", shortName: "Giants", crest: "TEAM", color: "#FD5A1E", leagueId: "mlb", country: "US", image: "", teamType: "franchise" },
];

export const ALL_TEAMS = [...NATIONAL_TEAMS, ...CLUB_TEAMS];

// ─── Match Data ──────────────────────────────────
export type MatchStatus = "SCHEDULED" | "TIMED" | "IN_PLAY" | "PAUSED" | "FINISHED" | "POSTPONED" | "CANCELLED";
export type MatchEventFormat = "HEAD_TO_HEAD" | "SINGLE_EVENT";

export interface Match {
    id: string;
    isFeatured: boolean;
    homeTeamId?: string;
    awayTeamId?: string;
    homeTeamName?: string;
    awayTeamName?: string;
    leagueId: string;
    matchDateUTC: string;
    status: MatchStatus;
    homeScore: number | null;
    awayScore: number | null;
    matchDay: string;
    stage: string;
    stadiumName: string;
    venueCount: number;
    isHot: boolean;
    eventFormat?: MatchEventFormat;
    eventTitle?: string;
    eventSubtitle?: string;
    youtubeVideoId?: string;
    youtubeVideoTitle?: string;
    youtubeChannelTitle?: string;
    youtubePublishedAt?: string;
    youtubeThumbnailUrl?: string;
    youtubeEmbedUrl?: string;
    youtubeSearchStatus?: "pending" | "found" | "not_found" | "failed";
    youtubeCheckedAt?: string;
}

function fallbackMatchDate(daysFromNow: number, hourUtc: number, minuteUtc = 0) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + daysFromNow);
    date.setUTCHours(hourUtc, minuteUtc, 0, 0);
    return date.toISOString();
}

const RAW_MATCHES: Omit<Match, "isFeatured">[] = [
    // Global Finals 2026 — Group Stage
    { id: "wc-1", homeTeamId: "usa", awayTeamId: "england", leagueId: "wc-2026", matchDateUTC: "2026-06-14T00:00:00Z", status: "SCHEDULED", homeScore: null, awayScore: null, matchDay: "Match Day 1", stage: "Group A", stadiumName: "NRG Stadium, Houston", venueCount: 24, isHot: true },
    { id: "wc-2", homeTeamId: "mexico", awayTeamId: "brazil", leagueId: "wc-2026", matchDateUTC: "2026-06-15T21:00:00Z", status: "SCHEDULED", homeScore: null, awayScore: null, matchDay: "Match Day 1", stage: "Group B", stadiumName: "NRG Stadium, Houston", venueCount: 18, isHot: true },
    { id: "wc-3", homeTeamId: "argentina", awayTeamId: "germany", leagueId: "wc-2026", matchDateUTC: "2026-06-16T18:00:00Z", status: "SCHEDULED", homeScore: null, awayScore: null, matchDay: "Match Day 1", stage: "Group C", stadiumName: "NRG Stadium, Houston", venueCount: 21, isHot: true },
    { id: "wc-4", homeTeamId: "france", awayTeamId: "morocco", leagueId: "wc-2026", matchDateUTC: "2026-06-17T21:00:00Z", status: "SCHEDULED", homeScore: null, awayScore: null, matchDay: "Match Day 1", stage: "Group D", stadiumName: "NRG Stadium, Houston", venueCount: 15, isHot: false },
    { id: "wc-5", homeTeamId: "spain", awayTeamId: "japan", leagueId: "wc-2026", matchDateUTC: "2026-06-18T18:00:00Z", status: "SCHEDULED", homeScore: null, awayScore: null, matchDay: "Match Day 1", stage: "Group E", stadiumName: "NRG Stadium, Houston", venueCount: 14, isHot: false },
    { id: "wc-6", homeTeamId: "portugal", awayTeamId: "senegal", leagueId: "wc-2026", matchDateUTC: "2026-06-19T21:00:00Z", status: "SCHEDULED", homeScore: null, awayScore: null, matchDay: "Match Day 1", stage: "Group F", stadiumName: "NRG Stadium, Houston", venueCount: 11, isHot: false },
    { id: "wc-7", homeTeamId: "netherlands", awayTeamId: "colombia", leagueId: "wc-2026", matchDateUTC: "2026-06-20T18:00:00Z", status: "SCHEDULED", homeScore: null, awayScore: null, matchDay: "Match Day 1", stage: "Group G", stadiumName: "NRG Stadium, Houston", venueCount: 13, isHot: false },
    { id: "wc-8", homeTeamId: "croatia", awayTeamId: "canada", leagueId: "wc-2026", matchDateUTC: "2026-06-21T21:00:00Z", status: "SCHEDULED", homeScore: null, awayScore: null, matchDay: "Match Day 1", stage: "Group H", stadiumName: "NRG Stadium, Houston", venueCount: 9, isHot: false },
    // Upcoming fallback club matches
    { id: "mls-1", homeTeamId: "dynamo", awayTeamId: "austin", leagueId: "mls", matchDateUTC: fallbackMatchDate(1, 20), status: "SCHEDULED", homeScore: null, awayScore: null, matchDay: "Week 4", stage: "Regular Season", stadiumName: "Shell Energy Stadium", venueCount: 12, isHot: false },
    // Finished matches
    { id: "epl-1", homeTeamId: "mancity", awayTeamId: "liverpool", leagueId: "epl", matchDateUTC: "2026-02-21T15:30:00Z", status: "FINISHED", homeScore: 3, awayScore: 3, matchDay: "Matchday 28", stage: "Regular Season", stadiumName: "Etihad Stadium", venueCount: 8, isHot: false },
    { id: "epl-2", homeTeamId: "arsenal", awayTeamId: "chelsea", leagueId: "epl", matchDateUTC: "2026-02-20T20:00:00Z", status: "FINISHED", homeScore: 2, awayScore: 0, matchDay: "Matchday 28", stage: "Regular Season", stadiumName: "Emirates Stadium", venueCount: 6, isHot: false },
    // Upcoming club matches
    { id: "laliga-1", homeTeamId: "realmadrid", awayTeamId: "barcelona", leagueId: "laliga", matchDateUTC: fallbackMatchDate(2, 20), status: "SCHEDULED", homeScore: null, awayScore: null, matchDay: "Matchday 26", stage: "El Clasico", stadiumName: "Santiago Bernabeu", venueCount: 16, isHot: true },
    { id: "mls-2", homeTeamId: "inter-miami", awayTeamId: "lafc", leagueId: "mls", matchDateUTC: fallbackMatchDate(3, 1, 30), status: "SCHEDULED", homeScore: null, awayScore: null, matchDay: "Week 5", stage: "Regular Season", stadiumName: "Chase Stadium", venueCount: 10, isHot: true },
    { id: "ligamx-1", homeTeamId: "america", awayTeamId: "chivas", leagueId: "ligamx", matchDateUTC: fallbackMatchDate(4, 1), status: "SCHEDULED", homeScore: null, awayScore: null, matchDay: "Jornada 10", stage: "Clasico Nacional", stadiumName: "Estadio Azteca", venueCount: 14, isHot: true },
    { id: "mls-3", homeTeamId: "dynamo", awayTeamId: "fc-dallas", leagueId: "mls", matchDateUTC: fallbackMatchDate(5, 1, 30), status: "SCHEDULED", homeScore: null, awayScore: null, matchDay: "Week 6", stage: "Texas Derby", stadiumName: "Shell Energy Stadium", venueCount: 15, isHot: true },
];

export const MATCHES: Match[] = RAW_MATCHES.map((match) => ({
    ...match,
    isFeatured: false,
}));

// ─── Venue Data ──────────────────────────────────
export type PriceRange = "BUDGET" | "MID" | "UPSCALE" | "LUXURY";

export interface Venue {
    id: string;
    slug: string;
    name: string;
    shortDescription: string;
    description: string;
    coverImageUrl?: string;
    galleryImageUrls?: string[];
    imageSource?: "manual" | "google" | "none";
    coverImageAttributions?: Array<{
        displayName: string;
        uri?: string | null;
        photoUri?: string | null;
    }>;
    galleryImageAttributions?: Array<Array<{
        displayName: string;
        uri?: string | null;
        photoUri?: string | null;
    }>>;
    workingHours?: Array<{
        day: string;
        hours: string;
        sortOrder: number;
        isClosed?: boolean;
        isTwentyFourHours?: boolean;
    }>;
    googleEditorialSummary?: string | null;
    googlePriceLevel?: string | null;
    googleReviews?: Array<{
        authorName: string;
        rating: number;
        text?: string | null;
        publishedAt?: string | null;
        relativePublishTimeText?: string | null;
        authorUrl?: string | null;
        profilePhotoUrl?: string | null;
        sourceUrl?: string | null;
    }>;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    postalCode: string;
    lat: number;
    lng: number;
    phone: string;
    website: string;
    instagram: string;
    capacity: number;
    rating: number;
    reviewCount: number;
    amenities: string[];
    cuisineTags: string[];
    priceRange: PriceRange;
    isVerified: boolean;
    isFeatured: boolean;
    isActive: boolean;
    coverColor: string; // for placeholder gradient
    followerCount: number;
    upcomingEventsCount: number;
    totalBookings: number;
    ownerName: string;
    ownerEmail: string;
    promotedVenueEventId?: string | null;
    descriptionSource?: "NONE" | "GOOGLE" | "MANUAL" | null;
    shortDescriptionSource?: "NONE" | "GOOGLE" | "MANUAL" | null;
    priceRangeSource?: "NONE" | "GOOGLE" | "MANUAL" | null;
    fanTeams?: Array<{
        teamId: string;
        teamName: string;
        teamShortName?: string | null;
        teamSlug: string;
        teamCrestUrl?: string | null;
        leagueName?: string | null;
    }>;
}

export const AMENITY_LABELS: Record<string, { icon: string; label: string }> = {
    TV: { icon: "TV", label: "Big Screen TVs" },
    PROJECTOR: { icon: "PR", label: "Projector" },
    HOOKAH: { icon: "HK", label: "Hookah" },
    VIP: { icon: "VIP", label: "VIP Section" },
    SMOKE_FREE: { icon: "SF", label: "Smoke Free" },
    ALCOHOLIC: { icon: "BAR", label: "Full Bar" },
    OUTDOOR: { icon: "OUT", label: "Outdoor Seating" },
    WIFI: { icon: "WF", label: "Free WiFi" },
    PARKING: { icon: "P", label: "Parking" },
    LIVE_MUSIC: { icon: "MUS", label: "Live Music" },
    FOOD: { icon: "FD", label: "Full Kitchen" },
    KIDS: { icon: "KID", label: "Kid Friendly" },
};

export const PRICE_LABELS: Record<PriceRange, string> = {
    BUDGET: "$", MID: "$$", UPSCALE: "$$$", LUXURY: "$$$$",
};

export const VENUES: Venue[] = [
    {
        id: "v1", slug: "the-pitch-house", name: "The Pitch House", shortDescription: "Houston's #1 Turkish-inspired sports lounge with 8K screens and premium hookah.",
        description: "Step into The Pitch House, where Turkish hospitality meets Houston's game-day energy. Our 5,200 sq ft venue features 12 ultra-HD screens including a 180-inch 8K projector wall, premium hookah with over 40 flavors, a full Mediterranean kitchen, and a VIP section with private viewing booths. Located in the heart of Montrose, we're the go-to destination for major match-night watch parties. Our chef brings authentic Turkish delights — think lamb kebab platters, meze boards, and baklava sundaes — paired with craft cocktails and an extensive mocktail menu. On match days, expect live DJs during halftime, giveaways, and the loudest fan atmosphere in the city.",
        addressLine1: "1201 Westheimer Rd", addressLine2: "Suite 100", city: "Houston", state: "TX", postalCode: "77006",
        lat: 29.7437, lng: -95.3909, phone: "(713) 555-0101", website: "https://thepitchhouse.com", instagram: "@thepitchhouse",
        capacity: 200, rating: 4.8, reviewCount: 234, amenities: ["TV", "PROJECTOR", "HOOKAH", "VIP", "WIFI", "PARKING", "FOOD"],
        cuisineTags: ["Turkish", "Mediterranean", "Hookah Lounge"], priceRange: "MID", isVerified: true, isFeatured: true, isActive: true,
        coverColor: "#E63946", followerCount: 1247, upcomingEventsCount: 8, totalBookings: 3420, ownerName: "Emre Yilmaz", ownerEmail: "emre@thepitchhouse.com",
    },
    {
        id: "v2", slug: "golazo-sports-bar", name: "Golazo Sports Bar & Grill", shortDescription: "Authentic Mexican food meets championship-level sports viewing on Washington Ave.",
        description: "¡GOLAZO! We're Houston's most beloved Mexican sports bar, serving up ice-cold micheladas, sizzling fajitas, and non-stop fútbol action since 2018. With 20 flat-screen TVs, two outdoor patios, and the city's best al pastor tacos, Golazo is where every goal feels like it happened right in front of you. Our bar stocks over 50 tequilas and mezcals, plus fresh-squeezed margaritas by the pitcher. During major tournament nights, we're expanding capacity with a tented outdoor viewing area featuring a 200-inch screen. Free parking for the first 50 cars on match days!",
        addressLine1: "4502 Washington Ave", addressLine2: "", city: "Houston", state: "TX", postalCode: "77007",
        lat: 29.7672, lng: -95.3990, phone: "(713) 555-0202", website: "https://golazosportsbar.com", instagram: "@golazosportsbar",
        capacity: 350, rating: 4.5, reviewCount: 187, amenities: ["TV", "PROJECTOR", "ALCOHOLIC", "OUTDOOR", "PARKING", "FOOD", "LIVE_MUSIC"],
        cuisineTags: ["Mexican", "Tex-Mex", "Taqueria"], priceRange: "BUDGET", isVerified: true, isFeatured: false, isActive: true,
        coverColor: "#006847", followerCount: 892, upcomingEventsCount: 6, totalBookings: 2180, ownerName: "Carlos Mendoza", ownerEmail: "carlos@golazosportsbar.com",
    },
    {
        id: "v3", slug: "match-day-lounge", name: "Match Day Lounge", shortDescription: "Upscale cocktail lounge meets premium sports experience in Downtown Houston.",
        description: "Match Day Lounge redefines the sports viewing experience with a luxurious twist. Think craft cocktails by award-winning mixologists, an Italian-American fusion menu, and a sound system that makes you feel the crowd roar. Our three distinct zones — The Terrace (rooftop), The Dugout (intimate booths), and The Pitch (main floor) — each offer a unique atmosphere. Reserved tables come with bottle service options and a dedicated server. We project every match in 4K HDR with Dolby Atmos surround sound. Perfect for corporate watch parties and premium fan experiences.",
        addressLine1: "718 Main St", addressLine2: "Floor 2", city: "Houston", state: "TX", postalCode: "77002",
        lat: 29.7589, lng: -95.3632, phone: "(713) 555-0303", website: "https://matchdaylounge.com", instagram: "@matchdayhtx",
        capacity: 150, rating: 4.9, reviewCount: 342, amenities: ["TV", "VIP", "HOOKAH", "SMOKE_FREE", "WIFI", "ALCOHOLIC", "FOOD"],
        cuisineTags: ["Italian", "Cocktails", "American"], priceRange: "UPSCALE", isVerified: true, isFeatured: true, isActive: true,
        coverColor: "#1D3557", followerCount: 2105, upcomingEventsCount: 10, totalBookings: 4890, ownerName: "Isabella Rossi", ownerEmail: "isabella@matchdaylounge.com",
    },
    {
        id: "v4", slug: "la-fonda-futbol", name: "La Fonda Fútbol", shortDescription: "Family-friendly Central American restaurant with giant outdoor screens in Hillcroft.",
        description: "La Fonda Fútbol is Houston's home for Central American soccer culture. Our 8,000 sq ft space combines authentic Salvadorian, Honduran, and Guatemalan cuisine with a massive outdoor patio featuring twin 150-inch screens. Families are welcome — we have a dedicated kids zone with mini-goals and face painting on match days. The pupusas are made fresh by hand, the horchata flows endlessly, and the passion for la selección is unmatched. We host viewing parties for every CONCACAF match and Liga MX rivalry game. La Fonda is more than a restaurant — it's a community gathering place.",
        addressLine1: "2910 Hillcroft Ave", addressLine2: "", city: "Houston", state: "TX", postalCode: "77057",
        lat: 29.7367, lng: -95.4913, phone: "(713) 555-0404", website: "https://lafondafutbol.com", instagram: "@lafondafutbol",
        capacity: 400, rating: 4.3, reviewCount: 98, amenities: ["TV", "OUTDOOR", "PARKING", "FOOD", "KIDS"],
        cuisineTags: ["Salvadorian", "Honduran", "Central American"], priceRange: "BUDGET", isVerified: false, isFeatured: false, isActive: true,
        coverColor: "#2ECC71", followerCount: 456, upcomingEventsCount: 5, totalBookings: 870, ownerName: "Rosa Martinez", ownerEmail: "rosa@lafondafutbol.com",
    },
    {
        id: "v5", slug: "smoke-and-score-vip", name: "Smoke & Score VIP", shortDescription: "Ultra-premium hookah lounge with private suites and velvet-rope match-day experiences.",
        description: "Smoke & Score VIP is the Galleria's most exclusive hookah and sports destination. Each of our 12 private suites has its own 85-inch OLED screen, premium sound bar, a personal hookah butler, and a dedicated server. The main lounge features a curved LED video wall spanning 30 feet wide — the largest in any Houston venue. Our Lebanese chef crafts shareable plates of hummus, kafta, and fattoush alongside an extensive mocktain and shisha menu with over 60 premium blends. For the 2026 international finals, we're offering season packages with guaranteed reserved suites for every match.",
        addressLine1: "5085 Westheimer Rd", addressLine2: "Suite 200", city: "Houston", state: "TX", postalCode: "77056",
        lat: 29.7372, lng: -95.4653, phone: "(713) 555-0505", website: "https://smokeandscorehouston.com", instagram: "@smokeandscorehtx",
        capacity: 120, rating: 4.7, reviewCount: 156, amenities: ["HOOKAH", "VIP", "PROJECTOR", "WIFI", "ALCOHOLIC", "FOOD", "PARKING"],
        cuisineTags: ["Lebanese", "Hookah Lounge", "Cocktails"], priceRange: "LUXURY", isVerified: true, isFeatured: true, isActive: true,
        coverColor: "#9B59B6", followerCount: 1890, upcomingEventsCount: 12, totalBookings: 5230, ownerName: "Hassan El-Khoury", ownerEmail: "hassan@smokeandscore.com",
    },
    {
        id: "v6", slug: "the-den-sports-pub", name: "The Den Sports Pub", shortDescription: "Classic British pub atmosphere with craft beers and a massive screen in The Heights.",
        description: "Proper pub. Proper football. The Den Sports Pub brings an authentic British pub experience to The Heights. With 15 craft beers on tap — including rotating English ales — plus fish & chips, bangers & mash, and a Sunday roast that rivals any London gastropub, it's the EPL fan's paradise. Our main bar features a 120-inch screen with Sky Sports and every match you could ask for. Quiz nights on Wednesdays, live acoustic on Fridays, and weekend brunch with bottomless mimosas. The Den is where Houston's English football community calls home.",
        addressLine1: "815 Yale St", addressLine2: "", city: "Houston", state: "TX", postalCode: "77007",
        lat: 29.7909, lng: -95.3985, phone: "(713) 555-0606", website: "https://thedenhouston.com", instagram: "@thedenhtx",
        capacity: 180, rating: 4.6, reviewCount: 276, amenities: ["TV", "PROJECTOR", "ALCOHOLIC", "WIFI", "FOOD", "LIVE_MUSIC"],
        cuisineTags: ["British", "Pub Food", "Craft Beer"], priceRange: "MID", isVerified: true, isFeatured: false, isActive: true,
        coverColor: "#2C3E50", followerCount: 934, upcomingEventsCount: 7, totalBookings: 3100, ownerName: "James Whitfield", ownerEmail: "james@thedenhouston.com",
    },
    {
        id: "v7", slug: "samba-house", name: "Samba House Houston", shortDescription: "Brazilian steakhouse and sports bar with live samba on match days in Midtown.",
        description: "Samba House brings the energia of Rio to Houston's Midtown. Our rodízio-style Brazilian steakhouse serves unlimited grilled meats carved tableside, feijoada, pastel de queijo, and caipirinha flights. During international tournament matches, our resident DJ spins samba, MPB, and funk carioca, while our 10 screens and 160-inch projector keep you locked into every play. The crowd is electric for Seleção games — expect confetti, drumlines, and the most passionate fans in Texas. With a capacity for 300 and a full outdoor patio, this is the place for the ultimate Brazilian match-day experience.",
        addressLine1: "2600 Travis St", addressLine2: "Floor 1", city: "Houston", state: "TX", postalCode: "77006",
        lat: 29.7435, lng: -95.3751, phone: "(713) 555-0707", website: "https://sambahousehtx.com", instagram: "@sambahousehtx",
        capacity: 300, rating: 4.4, reviewCount: 189, amenities: ["TV", "PROJECTOR", "ALCOHOLIC", "OUTDOOR", "LIVE_MUSIC", "FOOD", "PARKING"],
        cuisineTags: ["Brazilian", "Steakhouse", "Cocktails"], priceRange: "UPSCALE", isVerified: true, isFeatured: false, isActive: true,
        coverColor: "#F39C12", followerCount: 1123, upcomingEventsCount: 9, totalBookings: 2750, ownerName: "Lucas Ferreira", ownerEmail: "lucas@sambahousehtx.com",
    },
    {
        id: "v8", slug: "halftime-hookah", name: "Halftime Hookah & Café", shortDescription: "Chill hookah café with Mediterranean bites and late-night match viewing near UH campus.",
        description: "Halftime is the University of Houston crowd's favorite hookah spot for late-night match viewing. We stay open until 3 AM on match nights, serving our signature shawarma wraps, falafel bowls, and Turkish coffee alongside 50+ hookah flavors. Our cozy atmosphere features neon lighting, velvet booths, and six strategically placed 65-inch screens so every seat has a perfect view. We're known for our student-friendly pricing — $5 hookah happy hour and BOGO during Champions League nights. Come for the game, stay for the vibe.",
        addressLine1: "4310 Wheeler Ave", addressLine2: "", city: "Houston", state: "TX", postalCode: "77004",
        lat: 29.7230, lng: -95.3522, phone: "(713) 555-0808", website: "https://halftimehookah.com", instagram: "@halftimehookah",
        capacity: 100, rating: 4.2, reviewCount: 124, amenities: ["TV", "HOOKAH", "WIFI", "FOOD"],
        cuisineTags: ["Mediterranean", "Hookah Lounge", "Café"], priceRange: "BUDGET", isVerified: false, isFeatured: false, isActive: true,
        coverColor: "#E74C3C", followerCount: 567, upcomingEventsCount: 4, totalBookings: 1340, ownerName: "Ahmed Khalil", ownerEmail: "ahmed@halftimehookah.com",
    },
];

// ─── Venue Events ────────────────────────────────
export interface VenueEvent {
    id: string;
    venueId: string;
    matchId: string;
    isActive: boolean;
    bookingLimit: number | null;
    confirmedBookings: number;
    specialNotes: string;
    entryFee: number | null;
    doorsOpenAt: string;
    requiresApproval: boolean;
}

export const VENUE_EVENTS: VenueEvent[] = [
    { id: "ve1", venueId: "v1", matchId: "wc-1", isActive: true, bookingLimit: 180, confirmedBookings: 176, specialNotes: "Free hookah with every table of 4+. Live DJ at halftime. Turkish meze board included with VIP booking.", entryFee: 15, doorsOpenAt: "5:00 PM", requiresApproval: false },
    { id: "ve2", venueId: "v2", matchId: "wc-1", isActive: true, bookingLimit: 300, confirmedBookings: 212, specialNotes: "Outdoor tent expansion for this match. $5 micheladas all day. Free parking first-come.", entryFee: null, doorsOpenAt: "5:30 PM", requiresApproval: false },
    { id: "ve3", venueId: "v3", matchId: "wc-1", isActive: true, bookingLimit: 120, confirmedBookings: 118, specialNotes: "Rooftop terrace SOLD OUT — main floor only. Complimentary prosecco toast at match start.", entryFee: 35, doorsOpenAt: "5:00 PM", requiresApproval: true },
    { id: "ve4", venueId: "v5", matchId: "wc-1", isActive: true, bookingLimit: 100, confirmedBookings: 98, specialNotes: "Private suites available (6-person minimum). Premium hookah package included. Bottle service pricing available.", entryFee: 50, doorsOpenAt: "4:30 PM", requiresApproval: true },
    { id: "ve5", venueId: "v1", matchId: "wc-2", isActive: true, bookingLimit: 180, confirmedBookings: 95, specialNotes: "Special Mexico vs Brazil carne asada menu. Mariachi band at halftime!", entryFee: 15, doorsOpenAt: "2:30 PM", requiresApproval: false },
    { id: "ve6", venueId: "v4", matchId: "wc-2", isActive: true, bookingLimit: null, confirmedBookings: 67, specialNotes: "Kids zone open. Extended outdoor seating. Pupusa eating contest at halftime!", entryFee: null, doorsOpenAt: "2:00 PM", requiresApproval: false },
    { id: "ve7", venueId: "v7", matchId: "wc-2", isActive: true, bookingLimit: 250, confirmedBookings: 134, specialNotes: "Live samba show pre-match. Complimentary caipirinha with table booking. Brazilian flag face painting.", entryFee: 20, doorsOpenAt: "2:00 PM", requiresApproval: false },
    { id: "ve8", venueId: "v6", matchId: "epl-1", isActive: true, bookingLimit: 150, confirmedBookings: 142, specialNotes: "Premier League Sunday Roast special — £15 roast + pint combo.", entryFee: null, doorsOpenAt: "9:00 AM", requiresApproval: false },
];

// ─── Reviews ─────────────────────────────────────
export interface Review {
    id: string;
    venueId: string;
    userName: string;
    userAvatar: string;
    rating: number;
    title: string;
    content: string;
    date: string;
    isVerifiedVisit: boolean;
    ownerReply?: string;
}

export const REVIEWS: Review[] = [
    { id: "r1", venueId: "v1", userName: "Mike T.", userAvatar: "", rating: 5, title: "Best watch party spot in Houston!", content: "Went for the Champions League final and it was INSANE. The 180-inch screen, the hookah, the Turkish food — everything was perfect. The VIP booth was worth every penny. Already booked for the next big international match.", date: "2026-01-15", isVerifiedVisit: true, ownerReply: "Thanks Mike! Can't wait to see you again. Your VIP booth is reserved!" },
    { id: "r2", venueId: "v1", userName: "Sarah K.", userAvatar: "", rating: 5, title: "Incredible atmosphere and food", content: "The lamb kebab platter is divine. Watched the USA qualifier here and the crowd was electric. Staff is super friendly and they actually know football. Hookah selection is the best I've found in Houston.", date: "2026-01-28", isVerifiedVisit: true },
    { id: "r3", venueId: "v1", userName: "David R.", userAvatar: "", rating: 4, title: "Great but book VIP early", content: "Loved the experience overall but the main floor got really crowded during the derby. Next time I'm booking VIP for sure. Food was excellent though, especially the meze board.", date: "2026-02-05", isVerifiedVisit: true },
    { id: "r4", venueId: "v3", userName: "Jessica L.", userAvatar: "", rating: 5, title: "Unmatched luxury sports viewing", content: "This place is on another level. Craft cocktails, 4K screens with surround sound, and the rooftop terrace during golden hour is magical. Perfect for a date night that happens to have a big match.", date: "2026-02-10", isVerifiedVisit: true, ownerReply: "Thank you Jessica! We're thrilled you loved the rooftop. See you at the next match night." },
    { id: "r5", venueId: "v2", userName: "Roberto M.", userAvatar: "", rating: 5, title: "¡Viva el fútbol! Best micheladas in town", content: "If you want the real fútbol experience with authentic Mexican food, this is IT. The al pastor tacos are unreal and $5 micheladas on match days? Come on. The outdoor patio with the big screen is amazing.", date: "2026-02-12", isVerifiedVisit: true },
];

// ─── Posts from Venues ───────────────────────────
export interface Post {
    id: string;
    venueId: string;
    content: string;
    matchId?: string;
    createdAt: string;
    viewsCount: number;
}

export const POSTS: Post[] = [
    { id: "p1", venueId: "v1", content: "TOURNAMENT PACKAGES NOW LIVE! Book your table for the full group stage and save 25%. VIP suites are going fast for USA vs England. Link in bio. #MatchWatch #Houston", matchId: "wc-1", createdAt: "2026-02-20T14:00:00Z", viewsCount: 3420 },
    { id: "p2", venueId: "v2", content: "Big news: we're building a massive outdoor tent for tournament nights. 200+ extra seats, a 200-inch screen, and our michelada bar on wheels. Tickets go live this Friday.", createdAt: "2026-02-18T10:00:00Z", viewsCount: 2890 },
    { id: "p3", venueId: "v5", content: "New: season suite packages for the 2026 international finals. 12 private suites, unlimited premium hookah, personal butler service, and bottle menu included. Only 12 packages available.", matchId: "wc-1", createdAt: "2026-02-19T16:00:00Z", viewsCount: 5120 },
    { id: "p4", venueId: "v3", content: "Match Day Lounge presents the International Cocktail Collection. 32 countries, 32 signature cocktails. Try them all and win a VIP season pass. Launching June 1.", createdAt: "2026-02-17T12:00:00Z", viewsCount: 1980 },
    { id: "p5", venueId: "v7", content: "Brazil fans: Samba House is your home base for tournament nights. Live samba before every Seleção match, unlimited rodízio packages, and caipirinha towers.", matchId: "wc-2", createdAt: "2026-02-21T09:00:00Z", viewsCount: 4200 },
];

// ─── Menu Data ───────────────────────────────────
export interface MenuCategory {
    id: string;
    name: string;
    items: MenuItem[];
}

export interface MenuItem {
    id: string;
    name: string;
    description: string;
    price: number;
    isAvailable: boolean;
    isFeatured: boolean;
    dietaryTags: string[];
}

export const SAMPLE_MENU: MenuCategory[] = [
    {
        id: "mc1", name: "Starters & Meze",
        items: [
            { id: "mi1", name: "Mixed Meze Board", description: "Hummus, baba ganoush, tzatziki, tabouleh, stuffed grape leaves, and warm pita", price: 24.99, isAvailable: true, isFeatured: true, dietaryTags: ["VEGETARIAN"] },
            { id: "mi2", name: "Crispy Falafel Plate", description: "6 pieces with tahini sauce, pickled turnips, and fresh herbs", price: 12.99, isAvailable: true, isFeatured: false, dietaryTags: ["VEGAN", "GLUTEN_FREE"] },
            { id: "mi3", name: "Turkish Sigara Böreği", description: "Crispy filo rolls stuffed with feta and herbs", price: 10.99, isAvailable: true, isFeatured: false, dietaryTags: ["VEGETARIAN"] },
            { id: "mi4", name: "Lamb Kibbeh", description: "Fried bulgur shells filled with spiced ground lamb and pine nuts", price: 14.99, isAvailable: true, isFeatured: false, dietaryTags: [] },
        ],
    },
    {
        id: "mc2", name: "Main Plates",
        items: [
            { id: "mi5", name: "Adana Kebab Platter", description: "Hand-minced lamb kebab with charred peppers, rice pilaf, and grilled flatbread", price: 28.99, isAvailable: true, isFeatured: true, dietaryTags: ["HALAL"] },
            { id: "mi6", name: "Chicken Shawarma Plate", description: "Marinated chicken carved from vertical spit with garlic sauce, pickles, and fries", price: 22.99, isAvailable: true, isFeatured: false, dietaryTags: ["HALAL", "GLUTEN_FREE"] },
            { id: "mi7", name: "Grilled Sea Bass", description: "Whole grilled Mediterranean sea bass with lemon, capers, and roasted vegetables", price: 34.99, isAvailable: true, isFeatured: false, dietaryTags: ["GLUTEN_FREE"] },
            { id: "mi8", name: "Matchday Burger", description: "Double smash patty with Turkish pepper jam, white cheddar, and pickle slaw", price: 18.99, isAvailable: true, isFeatured: false, dietaryTags: [] },
        ],
    },
    {
        id: "mc3", name: "Hookah Menu",
        items: [
            { id: "mi9", name: "Classic Shisha", description: "Single flavor: Double Apple, Mint, Grape, Blueberry, Watermelon", price: 25.00, isAvailable: true, isFeatured: false, dietaryTags: [] },
            { id: "mi10", name: "Premium Mix", description: "Custom 2-flavor blend by our hookah master", price: 30.00, isAvailable: true, isFeatured: true, dietaryTags: [] },
            { id: "mi11", name: "Fruit Head Hookah", description: "Shisha packed in a carved pineapple, watermelon, or grapefruit", price: 45.00, isAvailable: true, isFeatured: false, dietaryTags: [] },
        ],
    },
    {
        id: "mc4", name: "Drinks",
        items: [
            { id: "mi12", name: "Turkish Tea (Çay)", description: "Traditional double-brewed black tea served in tulip glass", price: 4.00, isAvailable: true, isFeatured: false, dietaryTags: ["VEGAN"] },
            { id: "mi13", name: "Fresh Lemonade w/ Mint", description: "House-made with real lemons and fresh spearmint", price: 6.99, isAvailable: true, isFeatured: false, dietaryTags: ["VEGAN"] },
            { id: "mi14", name: "Ayran", description: "Traditional Turkish yogurt drink — cold, salty, refreshing", price: 5.99, isAvailable: true, isFeatured: false, dietaryTags: ["VEGETARIAN"] },
            { id: "mi15", name: "MatchWatch Cocktail", description: "Pomegranate molasses, vodka, lime, and sparkling water", price: 14.99, isAvailable: true, isFeatured: true, dietaryTags: [] },
        ],
    },
];

// ─── Admin / User Data ───────────────────────────
export interface User {
    id: string;
    name: string;
    email: string;
    role: "USER" | "VENUE_OWNER" | "BUSINESS" | "ADMIN" | "SUPER_ADMIN";
    avatar: string;
    isActive: boolean;
    isSuspended: boolean;
    createdAt: string;
    lastLoginAt: string;
    bookingsCount: number;
}

export const USERS: User[] = [
    { id: "u1", name: "Mike Thompson", email: "mike.t@gmail.com", role: "USER", avatar: "", isActive: true, isSuspended: false, createdAt: "2026-01-10", lastLoginAt: "2026-02-22", bookingsCount: 8 },
    { id: "u2", name: "Sarah Kim", email: "sarah.k@outlook.com", role: "USER", avatar: "", isActive: true, isSuspended: false, createdAt: "2026-01-15", lastLoginAt: "2026-02-21", bookingsCount: 5 },
    { id: "u3", name: "Roberto Mendoza", email: "roberto.m@yahoo.com", role: "USER", avatar: "", isActive: true, isSuspended: false, createdAt: "2026-01-20", lastLoginAt: "2026-02-22", bookingsCount: 12 },
    { id: "u4", name: "Jessica Liu", email: "jessica.l@gmail.com", role: "USER", avatar: "", isActive: true, isSuspended: false, createdAt: "2026-01-22", lastLoginAt: "2026-02-20", bookingsCount: 3 },
    { id: "u5", name: "David Rodriguez", email: "david.r@gmail.com", role: "USER", avatar: "", isActive: true, isSuspended: false, createdAt: "2026-01-25", lastLoginAt: "2026-02-19", bookingsCount: 7 },
    { id: "u6", name: "Emre Yilmaz", email: "emre@thepitchhouse.com", role: "BUSINESS", avatar: "", isActive: true, isSuspended: false, createdAt: "2025-11-01", lastLoginAt: "2026-02-22", bookingsCount: 0 },
    { id: "u7", name: "Carlos Mendoza", email: "carlos@golazosportsbar.com", role: "BUSINESS", avatar: "", isActive: true, isSuspended: false, createdAt: "2025-12-01", lastLoginAt: "2026-02-22", bookingsCount: 0 },
    { id: "u8", name: "Admin User", email: "admin@matchwatch.us", role: "ADMIN", avatar: "", isActive: true, isSuspended: false, createdAt: "2025-10-01", lastLoginAt: "2026-02-22", bookingsCount: 0 },
    { id: "u9", name: "Suspended Troll", email: "troll@example.com", role: "USER", avatar: "", isActive: false, isSuspended: true, createdAt: "2026-02-01", lastLoginAt: "2026-02-05", bookingsCount: 0 },
    { id: "u10", name: "Hassan El-Khoury", email: "hassan@smokeandscore.com", role: "BUSINESS", avatar: "", isActive: true, isSuspended: false, createdAt: "2025-11-15", lastLoginAt: "2026-02-22", bookingsCount: 0 },
];

// ─── Booking Data ────────────────────────────────
export interface Booking {
    id: string;
    reference: string;
    userId: string;
    venueEventId: string;
    partySize: number;
    specialRequests: string;
    status: "PENDING" | "CONFIRMED" | "CANCELLED_BY_USER" | "CANCELLED_BY_VENUE" | "NO_SHOW";
    createdAt: string;
}

export const BOOKINGS: Booking[] = [
    { id: "b1", reference: "FW-A3K9PX", userId: "u1", venueEventId: "ve1", partySize: 4, specialRequests: "VIP booth please, celebrating a birthday!", status: "CONFIRMED", createdAt: "2026-02-10" },
    { id: "b2", reference: "FW-B7M2QR", userId: "u2", venueEventId: "ve1", partySize: 2, specialRequests: "", status: "CONFIRMED", createdAt: "2026-02-11" },
    { id: "b3", reference: "FW-C1N5ST", userId: "u3", venueEventId: "ve2", partySize: 6, specialRequests: "Outdoor patio if possible", status: "CONFIRMED", createdAt: "2026-02-12" },
    { id: "b4", reference: "FW-D9P3UV", userId: "u4", venueEventId: "ve3", partySize: 2, specialRequests: "Rooftop terrace seat", status: "PENDING", createdAt: "2026-02-15" },
    { id: "b5", reference: "FW-E4R8WX", userId: "u5", venueEventId: "ve4", partySize: 8, specialRequests: "Private suite, premium hookah package", status: "CONFIRMED", createdAt: "2026-02-13" },
    { id: "b6", reference: "FW-F6T1YZ", userId: "u1", venueEventId: "ve5", partySize: 4, specialRequests: "", status: "CONFIRMED", createdAt: "2026-02-18" },
    { id: "b7", reference: "FW-G2U4AB", userId: "u3", venueEventId: "ve7", partySize: 10, specialRequests: "Brazilian fans group, we'll bring flags!", status: "CONFIRMED", createdAt: "2026-02-19" },
    { id: "b8", reference: "FW-H8V7CD", userId: "u2", venueEventId: "ve8", partySize: 3, specialRequests: "Sunday roast combo for all 3", status: "CANCELLED_BY_USER", createdAt: "2026-02-14" },
];

// ─── Helper Functions ────────────────────────────
export function getTeam(id: string): Team | undefined {
    return ALL_TEAMS.find((t) => t.id === id);
}

export function getLeague(id: string): League | undefined {
    return LEAGUES.find((l) => l.id === id);
}

export function getVenue(idOrSlug: string): Venue | undefined {
    return VENUES.find((v) => v.id === idOrSlug || v.slug === idOrSlug);
}

export function getMatch(id: string): Match | undefined {
    return MATCHES.find((m) => m.id === id);
}

export function getVenueEvents(matchId: string): (VenueEvent & { venue: Venue })[] {
    return VENUE_EVENTS
        .filter((ve) => ve.matchId === matchId)
        .map((ve) => ({ ...ve, venue: VENUES.find((v) => v.id === ve.venueId)! }))
        .filter((ve) => ve.venue);
}

export function getVenueReviews(venueId: string): Review[] {
    return REVIEWS.filter((r) => r.venueId === venueId);
}

export function getVenuePosts(venueId: string): Post[] {
    return POSTS.filter((p) => p.venueId === venueId);
}

export function getVenueMatchEvents(venueId: string): (VenueEvent & { match: Match })[] {
    return VENUE_EVENTS
        .filter((ve) => ve.venueId === venueId)
        .map((ve) => ({ ...ve, match: MATCHES.find((m) => m.id === ve.matchId)! }))
        .filter((ve) => ve.match);
}

// ─── Admin Stats ─────────────────────────────────
export const ADMIN_STATS = {
    totalUsers: 1247,
    totalVenues: 8,
    totalBookings: 23450,
    totalMatches: 15,
    bookingsToday: 142,
    bookingsThisWeek: 876,
    activeEvents: 8,
    revenue: 45230,
    growthUsers: 18.5,
    growthBookings: 34.2,
    growthVenues: 12.0,
    topLeagues: [
        { name: "Global Finals", bookings: 12400 },
        { name: "MLS", bookings: 5200 },
        { name: "EPL", bookings: 3800 },
        { name: "Liga MX", bookings: 2050 },
    ],
    recentActivity: [
        { type: "booking", message: "Mike T. booked 4 spots at The Pitch House for USA vs England", time: "2 min ago" },
        { type: "venue", message: "Smoke & Score VIP updated their tournament menu", time: "15 min ago" },
        { type: "user", message: "New venue registration: Samba House Houston", time: "1 hr ago" },
        { type: "booking", message: "Roberto M. cancelled booking FW-H8V7CD at The Den", time: "2 hr ago" },
        { type: "system", message: "Match sync completed: 15 matches updated from Football-Data.org", time: "6 hr ago" },
        { type: "booking", message: "Jessica L. booked 2 spots at Match Day Lounge for USA vs England", time: "8 hr ago" },
    ],
};
