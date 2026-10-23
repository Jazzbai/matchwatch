import assert from 'node:assert/strict';
import { test } from 'node:test';
import { preferences, review, unified } from './test-fixtures';
import { analyzeEvent } from './viral-analysis';

test('video-only evidence fills S, E, C and Q while T and A stay unknown', () => {
  const { factors, evidence } = analyzeEvent(unified('g', 100, 112), preferences());
  // S = mean(goal prior 1.0, observed importance 0.9)
  assert.ok(Math.abs(factors.sports! - 0.95) < 1e-9);
  assert.ok(Math.abs(factors.emotion! - 0.8) < 1e-9);
  assert.equal(factors.controversy, 0.2);
  assert.ok(Math.abs(factors.quality! - 0.95) < 1e-9);
  assert.equal(factors.social, null);
  assert.equal(factors.audience, null);
  assert.ok(evidence.every(item => item.value >= 0 && item.value <= 1));
  assert.ok(evidence.some(item => item.source === 'heuristic' && item.factor === 'sports'));
});

test('official stats, late-game context and the audience profile add evidence', () => {
  const event = unified('r', 100, 112, { type: 'red_card', officialEventId: 'stat-1', matchTime: '85:10', team: 'Spurs', players: ['Romero'], review: review({ eventType: 'red_card', importance: 0.8, controversySurprise: { score: 0.6, evidence: 'Players protest.' } }) });
  const { factors, evidence } = analyzeEvent(event, preferences({ favoriteTeam: 'spurs', starPlayers: ['Son'] }));
  assert.ok(Math.abs(factors.sports! - (1.0 + 0.8) / 2) < 1e-9, 'red card prior 0.9 + late bonus 0.1, averaged with 0.8');
  assert.ok(Math.abs(factors.controversy! - 0.7) < 1e-9, 'mean of observed 0.6 and the official red-card decision 0.8');
  assert.ok(Math.abs(factors.audience! - 0.6) < 1e-9, 'favourite team 1, no star player 0.2');
  assert.ok(evidence.some(item => item.source === 'official_stats'));
});

test('a window with no posts is a measured zero for the social trend', () => {
  const event = unified('q', 100, 110, { social: { posts: 0, engagement: 0, zScore: null, engagementShare: 0, keywordShare: 0, positive: 0, negative: 0, influencerPosts: 0, mentions: [], postIds: [] } });
  assert.equal(analyzeEvent(event, preferences()).factors.social, 0);
});

test('commentary excitement and replays are reflected in E and Q', () => {
  const event = unified('c', 100, 110, { transcription: 'Oh my word, what a goal!', review: review({ isReplay: true, emotionalIntensity: { score: null, evidence: '' }, excitement: null }) });
  const { factors } = analyzeEvent(event, preferences());
  assert.equal(factors.emotion, 1);
  assert.ok(factors.quality! < 0.8);
});
