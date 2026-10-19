// Run from the web app directory: npm run refresh:recaps
// Loads the server-only key without writing it into the public catalog.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require('@next/env').loadEnvConfig(process.cwd());
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  module._compile(output.outputText, filename);
};
const { recentGames } = require('../src/lib/recent-games.ts');
const { gameRecap } = require('../src/lib/game-recaps.ts');
async function main() {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) throw new Error('Set YOUTUBE_API_KEY in .env.local before refreshing.');
  const feed = await recentGames('All');
  if (feed.failedRequests) throw new Error('Some scoreboard requests failed; keeping the previous catalog. Retry later.');
  const entries = [];
  let cursor = 0;
  let unavailable = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (cursor < feed.games.length) {
      const game = feed.games[cursor++];
      const result = await gameRecap(game, 'recaps', key);
      if (result.status === 'unavailable') unavailable++;
      if (result.status === 'matched') entries.push({ gameId: game.id, gameDate: game.date, kind: 'recaps', video: result.video });
    }
  }));
  if (unavailable || !entries.length) throw new Error('Video verification was incomplete; keeping the previous catalog. Retry later.');
  entries.sort((a, b) => a.gameId.localeCompare(b.gameId));
  const catalog = { schemaVersion: 1, audience: 'US', checkedAt: new Date().toISOString(), from: feed.from, to: feed.to, coverage: feed.coverage, games: feed.games, entries };
  const destination = path.join(__dirname, '../src/data/stream-video-catalog.json');
  fs.writeFileSync(destination, JSON.stringify(catalog, null, 2) + '\n');
  console.log(JSON.stringify({ games: feed.games.length, recapLinks: entries.length, sports: Object.fromEntries([...new Set(feed.games.map(g => g.sport))].map(s => [s, { games: feed.games.filter(g => g.sport === s).length, recaps: entries.filter(e => feed.games.find(g => g.id === e.gameId)?.sport === s).length }])) }, null, 2));
}
main().catch(() => { console.error('Catalog refresh failed. Check provider connectivity and the server-only YouTube key; the existing catalog was preserved.'); process.exitCode = 1; });
