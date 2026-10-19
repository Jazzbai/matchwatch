import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRecentCompleted, recentGames, type RecentGame } from './recent-games';
import { matchesGame, gameRecap, availableInUS } from './game-recaps';
const game: RecentGame = { id: 'nba-test', sport: 'Basketball', league: 'NBA', date: '2026-10-17T02:30:00Z', home: 'Los Angeles Lakers', away: 'Denver Nuggets', homeTerms: ['Los Angeles Lakers', 'Lakers'], awayTerms: ['Denver Nuggets', 'Nuggets'], homeLogo: '', awayLogo: '', homeScore: '100', awayScore: '98', sourceUrl: 'https://www.espn.com/' };
test('US viewing excludes blocked countries and restrictive allowed lists', () => {
  assert.equal(availableInUS({ blocked: ['US', 'CA'] }), false);
  assert.equal(availableInUS({ allowed: ['GB', 'IE'] }), false);
  assert.equal(availableInUS({ allowed: [] }), false);
  assert.equal(availableInUS({ allowed: ['US', 'CA'] }), true);
  assert.equal(availableInUS({ blocked: [] }), true);
  assert.equal(availableInUS(), true);
});

test('rolling window excludes scheduled games, future dates, and games older than seven days', () => {
  const now = Date.parse('2026-10-19T12:00:00Z');
  assert.equal(isRecentCompleted('2026-10-18T12:00:00Z', true, now), true);
  assert.equal(isRecentCompleted('2026-10-18T12:00:00Z', false, now), false);
  assert.equal(isRecentCompleted('2026-10-11T12:00:00Z', true, now), false);
  assert.equal(isRecentCompleted('2026-10-20T12:00:00Z', true, now), false);
});
test('video matching accepts actual local game date and rejects other dates or teams', () => {
  const title = 'NUGGETS at LAKERS | FULL GAME HIGHLIGHTS | October 16, 2026';
  assert.equal(matchesGame(game, title, '', '2026-10-17T05:40:00Z', 'recaps'), true);
  assert.equal(matchesGame(game, title.replace('16,', '15,'), '', '2026-10-17T05:40:00Z', 'recaps'), false);
  assert.equal(matchesGame(game, title.replace('NUGGETS', 'CELTICS'), '', '2026-10-17T05:40:00Z', 'recaps'), false);
  assert.equal(matchesGame(game, title + ' simulation', '', '2026-10-17T05:40:00Z', 'recaps'), false);
  assert.equal(matchesGame(game, title, '', '2026-10-17T05:40:00Z', 'past'), false);
});
test('daily scoreboard responses are deduplicated without introducing demo fixtures', async () => {
  const mock = (async () => new Response(JSON.stringify({ events: [{ id: '123', date: '2026-10-18T12:00Z', status: { type: { completed: true } }, competitions: [{ competitors: [{ homeAway: 'home', score: '2', team: { displayName: 'Team Home' } }, { homeAway: 'away', score: '1', team: { displayName: 'Team Away' } }] }] }] }))) as typeof fetch;
  const data = await recentGames('Football', Date.parse('2026-10-19T12:00Z'), mock);
  assert.equal(data.games.length, 1);
  assert.equal(data.games[0].home, 'Team Home');
  assert.equal(data.failedRequests, 0);
});
test('undated official footage needs a unique matchup and close upload time', () => {
  const unique = { ...game, uniquePairing: true };
  assert.equal(matchesGame(unique, 'Nuggets at Lakers game highlights', '', '2026-10-17T05:40:00Z', 'recaps'), true);
  assert.equal(matchesGame({ ...game, uniquePairing: false }, 'Nuggets at Lakers game highlights', '', '2026-10-17T05:40:00Z', 'recaps'), false);
  assert.equal(matchesGame(unique, 'Nuggets at Lakers game highlights 2025', '', '2026-10-17T05:40:00Z', 'recaps'), false);
  assert.equal(matchesGame(unique, 'Nuggets at Lakers game highlights', '', '2026-10-20T05:40:00Z', 'recaps'), false);
  assert.equal(matchesGame(unique, 'Nuggets at Lakers game highlights October 15, 2026', '', '2026-10-17T05:40:00Z', 'recaps'), false);
});
test('correct names and date from an untrusted channel still do not produce a watch link', async () => {
  const mock = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    assert.equal(url.pathname.endsWith('/search'), false);
    if (url.pathname.endsWith('/channels')) return new Response(JSON.stringify({ items: [{ id: 'trusted-publisher', contentDetails: { relatedPlaylists: { uploads: 'test-uploads' } } }] }));
    return new Response(JSON.stringify({ items: [{ contentDetails: { videoId: 'abcdefghijk', videoPublishedAt: '2026-10-17T05:00Z' }, snippet: { title: 'Lakers Nuggets highlights October 16, 2026', description: '', publishedAt: '2026-10-17T05:00Z', channelTitle: 'Pixel simulation', channelId: 'untrusted-publisher' } }] }));
  }) as typeof fetch;
  const result = await gameRecap({ ...game, id: 'untrusted-test' }, 'recaps', 'test-key', mock);
  assert.equal(result.status, 'not_found');
  assert.equal(result.video, undefined);
});
