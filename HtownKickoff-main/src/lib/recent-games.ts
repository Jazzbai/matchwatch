import { youtubeSports, type YoutubeSport } from './stream-youtube';
export type RecentGame = { id: string; sport: YoutubeSport; league: string; date: string; home: string; away: string; homeTerms: string[]; awayTerms: string[]; homeLogo: string; awayLogo: string; homeScore: string; awayScore: string; sourceUrl: string; uniquePairing?: boolean };
const competitions: Record<YoutubeSport, Array<[string, string, string]>> = {
  Soccer: [['soccer', 'eng.1', 'Premier League'], ['soccer', 'esp.1', 'La Liga'], ['soccer', 'ger.1', 'Bundesliga'], ['soccer', 'ita.1', 'Serie A'], ['soccer', 'fra.1', 'Ligue 1'], ['soccer', 'usa.1', 'MLS'], ['soccer', 'mex.1', 'Liga MX'], ['soccer', 'uefa.champions', 'Champions League']],
  Basketball: [['basketball', 'nba', 'NBA'], ['basketball', 'wnba', 'WNBA']],
  Baseball: [['baseball', 'mlb', 'MLB']],
  Football: [['football', 'nfl', 'NFL']],
};
type Scoreboard = { events?: Array<{ id: string; date: string; links?: Array<{ href: string }>; status?: { type?: { completed?: boolean } }; competitions?: Array<{ status?: { type?: { completed?: boolean } }; competitors?: Array<{ homeAway: string; score?: string; team?: { displayName?: string; shortDisplayName?: string; name?: string; logo?: string } }> }> }> };
type Feed = { games: RecentGame[]; from: string; to: string; coverage: string[]; failedRequests: number };
const saved = new Map<string, { until: number; feed: Feed }>();
const pending = new Map<string, Promise<Feed>>();
export function isRecentCompleted(date: string, completed: boolean, now: number) { const time = Date.parse(date); return completed && Number.isFinite(time) && time >= now - 7 * 86400000 && time <= now; }

export async function recentGames(sport: YoutubeSport | 'All', now = Date.now(), fetcher: typeof fetch = fetch): Promise<Feed> {
  const cacheKey = `${sport}:${new Date(now).toISOString().slice(0, 13)}`;
  const hit = saved.get(cacheKey); if (hit && hit.until > now) return hit.feed;
  const running = pending.get(cacheKey); if (running) return running;
  const task = (async () => {
    const selected = sport === 'All' ? [...youtubeSports] : [sport];
    const days = Array.from({ length: 8 }, (_, i) => new Date(now - i * 86400000).toISOString().slice(0, 10).replaceAll('-', ''));
    const jobs = selected.flatMap((s) => competitions[s].flatMap(([path, code, label]) => days.map((day) => ({ sport: s, path, code, label, day }))));
    const games = new Map<string, RecentGame>(); let failedRequests = 0; let index = 0;
    await Promise.all(Array.from({ length: 8 }, async () => {
      while (index < jobs.length) {
        const job = jobs[index++];
        try {
          const response = await fetcher(`https://site.api.espn.com/apis/site/v2/sports/${job.path}/${job.code}/scoreboard?dates=${job.day}&limit=1000`, { signal: AbortSignal.timeout(12000), cache: 'no-store' });
          if (!response.ok) throw new Error('SCOREBOARD_UNAVAILABLE');
          const board = await response.json() as Scoreboard;
          if (!Array.isArray(board.events)) throw new Error('INVALID_SCOREBOARD');
          for (const event of board.events) {
            const contest = event.competitions?.[0];
            if (!isRecentCompleted(event.date, Boolean(event.status?.type?.completed || contest?.status?.type?.completed), now)) continue;
            const home = contest?.competitors?.find((c) => c.homeAway === 'home'); const away = contest?.competitors?.find((c) => c.homeAway === 'away');
            if (!home?.team?.displayName || !away?.team?.displayName) continue;
            const terms = (team: NonNullable<typeof home.team>) => [team.displayName, team.shortDisplayName, team.name].filter((s): s is string => Boolean(s && s.length >= 4));
            const id = `${job.code}-${event.id}`;
            games.set(id, { id, sport: job.sport, league: job.label, date: event.date, home: home.team.displayName, away: away.team.displayName,
              homeTerms: terms(home.team), awayTerms: terms(away.team), homeLogo: home.team.logo || '', awayLogo: away.team.logo || '', homeScore: home.score || '0', awayScore: away.score || '0',
              sourceUrl: event.links?.find((l) => /^https:\/\/www\.espn\.com\//.test(l.href))?.href || 'https://www.espn.com/scores/' });
          }
        } catch { failedRequests++; }
      }
    }));
    if (failedRequests === jobs.length) throw new Error('RESULTS_UNAVAILABLE');
    const pairing = (g: RecentGame) => `${g.sport}:${[g.home, g.away].sort().join('|')}`;
    const counts = new Map<string, number>(); for (const g of games.values()) counts.set(pairing(g), (counts.get(pairing(g)) || 0) + 1);
    const ordered = [...games.values()].map((g) => ({ ...g, uniquePairing: counts.get(pairing(g)) === 1 })).sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    const feed: Feed = { games: ordered, from: new Date(now - 7 * 86400000).toISOString(), to: new Date(now).toISOString(), coverage: selected.flatMap((s) => competitions[s].map((c) => c[2])), failedRequests };
    if (saved.size > 48) saved.clear(); saved.set(cacheKey, { feed, until: now + 600000 }); return feed;
  })();
  pending.set(cacheKey, task); try { return await task; } finally { pending.delete(cacheKey); }
}
