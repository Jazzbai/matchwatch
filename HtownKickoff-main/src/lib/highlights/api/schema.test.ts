import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { KeyMomentsOutput } from '../output';
import { ApiRequestError, parseProcessRequest, standardizeResult } from './schema';

test('accepts a ScorePlay ID and optional webhook, applying pipeline defaults', () => {
  const request = parseProcessRequest({ video_id: '130851978', webhook_url: 'https://hooks.example.com/matchwatch' });
  assert.equal(request.videoId, '130851978');
  assert.equal(request.webhookUrl, 'https://hooks.example.com/matchwatch');
  assert.equal(request.preferences.sport, 'Soccer');
  assert.equal(request.preferences.targetSeconds, 60);
  assert.ok(request.preferences.queries.length > 0);
  assert.equal(parseProcessRequest({ video_id: 130851978 }).webhookUrl, null);
});

test('maps options onto the existing preference validator', () => {
  const request = parseProcessRequest({ video_id: '1', options: { sport: 'Basketball', target_seconds: 30, max_moments: 3, priority: 'emotion', favorite_team: 'Knicks', star_players: ['Brunson'], home_team: 'Knicks' } });
  assert.equal(request.preferences.sport, 'Basketball');
  assert.equal(request.preferences.maxMoments, 3);
  assert.equal(request.preferences.favoriteTeam, 'Knicks');
  assert.equal(request.match.homeTeam, 'Knicks');
});

test('rejects invalid video IDs, options and unsafe webhook URLs', () => {
  const invalid: unknown[] = [
    null, [], {}, { video_id: 'abc' }, { video_id: '0' }, { video_id: '1; drop' },
    { video_id: '1', options: { sport: 'Cricket' } }, { video_id: '1', options: { priority: 'random' } }, { video_id: '1', options: { target_seconds: 9999 } },
    { video_id: '1', webhook_url: 'http://hooks.example.com' }, { video_id: '1', webhook_url: 'https://127.0.0.1/hook' },
    { video_id: '1', webhook_url: 'https://10.0.0.5/hook' }, { video_id: '1', webhook_url: 'https://localhost/hook' },
    { video_id: '1', webhook_url: 'https://user:pass@hooks.example.com' }, { video_id: '1', webhook_url: 'https://hooks.example.com:8080' },
    { video_id: '1', webhook_url: 'https://[::1]/hook' }, { video_id: '1', webhook_url: 'not a url' },
  ];
  for (const body of invalid) assert.throws(() => parseProcessRequest(body), ApiRequestError, JSON.stringify(body));
});

test('standardizes the pipeline output without inventing fields', () => {
  const output = {
    title: 'Spurs v United', total_duration_seconds: 20, rights_status: 'permitted', publication: 'ready', social_data_status: 'not_requested',
    source: { duration_seconds: 510 },
    selected_moments: [{ rank: 1, start_time_seconds: 396, end_time_seconds: 407, event_type: 'goal', label: 'Goal', viral_score: 68.31, confidence: 0.5, reason: 'Late equaliser.', match_time: null, team: 'Spurs', players: ['Solanke'], scores: { sports_importance: 0.9 }, missing_signals: ['social_trend_spike'] }],
    ranking: [{}, {}],
  } as unknown as KeyMomentsOutput;
  const result = standardizeResult(output);
  assert.deepEqual(result.highlights[0], {
    rank: 1, start_time: 396, end_time: 407, event_type: 'goal', label: 'Goal', viral_score: 0.6831, confidence: 0.5, description: 'Late equaliser.',
    match_time: null, team: 'Spurs', players: ['Solanke'], scores: { sports_importance: 0.9 }, missing_signals: ['social_trend_spike'],
  });
  assert.equal(result.ranked_moments, 2);
  assert.equal(result.key_moments, output);
});
