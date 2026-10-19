import catalog from '../data/stream-video-catalog.json';
import type { RecentGame } from './recent-games';
import type { RecapResult } from './game-recaps';
export function snapshotRecap(game: RecentGame, kind: string): RecapResult | null {
  if (Date.now() - Date.parse(catalog.checkedAt) > 7 * 86400000) return null;
  const entry = catalog.entries.find((item) => item.gameId === game.id && item.gameDate === game.date && item.kind === kind);
  if (!entry) return null;
  return { status: 'matched', video: entry.video, checkedAt: catalog.checkedAt };
}
export function snapshotGames(sport: string) {
  const now = Date.now(); const from = now - 7 * 86400000;
  const games = (catalog.games as RecentGame[]).filter((game) => (sport === 'All' || game.sport === sport) && Date.parse(game.date) >= from && Date.parse(game.date) <= now);
  if (!games.length) return null;
  return { games, from: new Date(from).toISOString(), to: new Date(now).toISOString(), coverage: [...new Set(games.map((g) => g.league))], failedRequests: 1, snapshotAt: catalog.checkedAt };
}
