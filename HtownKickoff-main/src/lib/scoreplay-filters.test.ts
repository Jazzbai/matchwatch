import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scorePlayDateRange } from './scoreplay-filters';
import { ScorePlayClient } from './scoreplay';

test('year and date filters intersect in UTC and include the full final day', () => {
  assert.deepEqual(scorePlayDateRange({ year: '2024', from: '2023-12-01', to: '2024-02-29' }), { start_date: Date.UTC(2024, 0, 1) / 1000, end_date: Date.UTC(2024, 2, 1) / 1000 - 1 });
  for (const filters of [{ from: '2025-02-29' }, { from: '2024-12-01', to: '2024-01-01' }, { year: '2024', from: '2025-01-01' }, { year: 'bad' }]) assert.throws(() => scorePlayDateRange(filters));
});

test('league, match, season, year and page reach the provider as combined filters', async () => {
  const bodies: Record<string, unknown>[] = [];
  const client = new ScorePlayClient('private-key', async (url, init) => {
    const path = String(url);
    if (path.includes('/event/search')) {
      const body = JSON.parse(String(init?.body));
      return Response.json(body.parent_id === 10 ? [{ ID: 20, name: 'Match' }] : body.parent_id === 20 ? [{ ID: 30, name: 'Full game' }] : []);
    }
    if (path.endsWith('/seasons/40')) return Response.json({ id: 40, name: '2025-26' });
    if (path.includes('/tag/search')) return Response.json({ tags: [{ ID: 50, name: '2025-26', type: 'season' }, { ID: 51, name: 'Other', type: 'season' }] });
    assert.ok(path.endsWith('/media/search?page=2&per_page=12'));
    bodies.push(JSON.parse(String(init?.body)));
    return Response.json({ media: [], count: 58, total_pages: 5 });
  });
  const result = await client.searchPage('broadcast', { leagueId: '10', matchId: '20', seasonId: '40', year: '2026', order: 'oldest' }, 2);
  assert.deepEqual(bodies[0], { media_type: 'video', name: 'broadcast', event_ids: [20, 30], any_tag_options: [50], start_date: Date.UTC(2026, 0, 1) / 1000, end_date: Date.UTC(2027, 0, 1) / 1000 - 1, order_by: 'upload_date', order_type: 'asc' });
  assert.equal(result.count, 58); assert.equal(result.totalPages, 5); assert.equal(result.page, 2);
});

test('a season with no matching associations never silently searches the whole library', async () => {
  const client = new ScorePlayClient('key', async url => {
    const path = String(url);
    assert.ok(!path.includes('/media/search'));
    if (path.includes('/seasons/')) return Response.json({ name: 'Empty season' });
    if (path.includes('/tag/search')) return Response.json({ tags: [] });
    return Response.json([]);
  });
  assert.deepEqual(await client.searchPage('', { seasonId: '40' }), { media: [], count: 0, page: 1, totalPages: 0 });
});

test('matches outside the chosen league and invalid filter inputs are rejected', async () => {
  const client = new ScorePlayClient('key', async () => Response.json([]));
  await assert.rejects(() => client.search('', { leagueId: '10', matchId: '99' }), /outside the selected league/);
  for (const filters of [{ leagueId: '../10' }, { year: 'invalid' }, { order: 'unknown' }]) await assert.rejects(() => client.search('', filters));
  await assert.rejects(() => client.search('', {}, 101));
});

test('collection options include later provider pages rather than silently dropping them', async () => {
  const client = new ScorePlayClient('key', async (url, init) => {
    if (String(url).includes('/seasons')) return Response.json({ items: [] });
    const body = JSON.parse(String(init?.body));
    return Response.json(body.page === 1 ? Array.from({ length: 100 }, (_, i) => ({ ID: i + 1, name: `League ${i}` })) : [{ ID: 999, name: 'Later league' }]);
  });
  const options = await client.filterOptions();
  assert.equal(options.leagues.length, 101); assert.equal(options.leagues.at(-1)?.id, '999');
});
