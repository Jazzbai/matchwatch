import { eventCatalog } from './catalog';
import type { AnalyzedEvent, Evidence, EvidenceSource, FactorKey, Factors, HighlightPreferences, Sport, UnifiedEvent } from './types';

// Diagram step 6: six viral-potential signals per event, each 0–1 or null.
// A signal is null only when no evidence exists; a measured absence is a real zero.

type Part = { value: number | null | undefined; source: EvidenceSource; note: string };

const excitedCommentary = /\b(what a|unbelievable|incredible|oh my|wow|stunning|sensational|magnificent|he's done it|i don't (quite )?believe|absolutely|scenes|get in)\b|!/gi;
const profanity = /\b(fuck\w*|shit\w*|cunt\w*|bastard\w*|wank\w*|bollocks)\b/i;
const lateGameMinute: Record<Sport, number> = { Soccer: 80, Basketball: 42 };

export function analyzeEvent(event: UnifiedEvent, preferences: HighlightPreferences): AnalyzedEvent {
  const evidence: Evidence[] = [];
  const combine = (factor: FactorKey, parts: Part[]) => {
    const known = parts.filter((part): part is Part & { value: number } => typeof part.value === 'number' && Number.isFinite(part.value));
    for (const part of known) evidence.push({ factor, source: part.source, value: clamp(part.value), note: part.note });
    return known.length ? clamp(known.reduce((sum, part) => sum + part.value, 0) / known.length) : null;
  };
  const factors: Factors = {
    sports: combine('sports', sportsImportance(event, preferences.sport)),
    social: combine('social', socialTrend(event)),
    emotion: combine('emotion', emotionalIntensity(event)),
    controversy: combine('controversy', controversySurprise(event)),
    audience: combine('audience', audienceRelevance(event, preferences)),
    quality: combine('quality', qualityAndDiversity(event)),
  };
  return { ...event, factors, evidence };
}

/** S · event type, game context and observed importance. */
function sportsImportance(event: UnifiedEvent, sport: Sport): Part[] {
  const minute = event.matchTime ? Number(event.matchTime.split(':')[0]) : null;
  const late = minute !== null && minute >= lateGameMinute[sport];
  const prior = eventCatalog[event.type].importance + (late ? 0.1 : 0);
  return [
    { value: prior, source: event.officialEventId ? 'official_stats' : 'heuristic',
      note: `${eventCatalog[event.type].label} event-type importance${late ? ', late in the match' : ''}${event.officialEventId ? ' (confirmed by official stats)' : ''}.` },
    { value: event.review?.importance, source: 'video_model', note: 'Sporting importance observed in the footage.' },
  ];
}

/** T · post-volume spike (z-score), engagement and event-specific keywords on X. */
function socialTrend(event: UnifiedEvent): Part[] {
  const social = event.social;
  if (!social) return [];
  if (!social.posts) return [{ value: 0, source: 'x_measured', note: 'No matching X posts in this moment’s reaction window.' }];
  const parts: Part[] = [
    { value: social.engagementShare + (social.influencerPosts ? 0.1 : 0), source: 'x_measured',
      note: `${social.posts} posts, ${Math.round(social.engagementShare * 100)}% of the busiest window’s engagement${social.influencerPosts ? `, ${social.influencerPosts} from large accounts` : ''}.` },
    { value: social.keywordShare, source: 'x_measured', note: `${Math.round(social.keywordShare * 100)}% of posts mention this event, its players or teams.` },
  ];
  if (social.zScore !== null) parts.unshift({ value: social.zScore / 3, source: 'x_measured', note: `Post-volume spike z = ${social.zScore.toFixed(1)} against the match baseline.` });
  return parts;
}

/** E · player and crowd reactions, celebrations, commentator energy. */
function emotionalIntensity(event: UnifiedEvent): Part[] {
  const review = event.review, social = event.social;
  const commentary = event.transcription ? Math.min(1, (event.transcription.match(excitedCommentary)?.length ?? 0) / 2) : null;
  const polar = social ? social.positive + social.negative : 0;
  return [
    { value: review?.emotionalIntensity.score, source: 'video_model', note: review?.emotionalIntensity.evidence || 'Emotion observed in the footage.' },
    { value: review?.excitement, source: 'video_model', note: 'Excitement of the action, commentary and crowd.' },
    { value: commentary, source: 'video_search', note: 'Excited phrases in the commentary transcript.' },
    { value: social && social.posts >= 3 ? polar / social.posts : null, source: 'x_measured', note: `${polar} emotionally charged posts.` },
  ];
}

/** C · referee decisions, unexpected turns and fan debate. */
function controversySurprise(event: UnifiedEvent): Part[] {
  const review = event.review, social = event.social;
  const decision = event.officialEventId && ['red_card', 'penalty'].includes(event.type) ? 0.8 : event.officialEventId && event.type === 'yellow_card' ? 0.5 : null;
  const polar = social ? social.positive + social.negative : 0;
  return [
    { value: review?.controversySurprise.score, source: 'video_model', note: review?.controversySurprise.evidence || 'Surprise or dispute observed in the footage.' },
    { value: decision, source: 'official_stats', note: 'Officially recorded referee decision.' },
    { value: social && polar >= 4 ? (2 * Math.min(social.positive, social.negative)) / polar : null, source: 'x_measured', note: 'Split positive/negative reactions on X (lexical estimate).' },
  ];
}

/** A · favourite team, star players and how often X mentions them. */
function audienceRelevance(event: UnifiedEvent, preferences: HighlightPreferences): Part[] {
  const matches = (a: string, b: string) => a.toLowerCase().includes(b.toLowerCase()) || b.toLowerCase().includes(a.toLowerCase());
  const favorite = preferences.favoriteTeam;
  const stars = preferences.starPlayers;
  return [
    { value: favorite && event.team ? (matches(event.team, favorite) ? 1 : 0.2) : null, source: 'audience_profile', note: `Team ${event.team} vs favourite ${favorite}.` },
    { value: stars.length && event.players.length ? (event.players.some(player => stars.some(star => matches(player, star))) ? 1 : 0.2) : null, source: 'audience_profile', note: `Players: ${event.players.join(', ')}.` },
    { value: event.social?.posts ? Math.min(1, event.social.mentions.length / 2) : null, source: 'x_measured', note: `Mentioned on X: ${event.social?.mentions.join(', ') || 'none'}.` },
  ];
}

/** Q · clear, stable footage with good start/end points; replays score lower. */
function qualityAndDiversity(event: UnifiedEvent): Part[] {
  const review = event.review;
  if (!review) return [];
  return [
    { value: review.watchability, source: 'video_model', note: 'Footage clarity and stability.' },
    { value: review.boundariesVerified ? 1 : 0.5, source: 'video_model', note: review.boundariesVerified ? 'Clean start and end points confirmed.' : 'Default padding used for the clip boundaries.' },
    { value: review.isReplay ? 0.3 : null, source: 'video_model', note: 'Replay footage repeats an earlier action.' },
  ];
}

/** Clip-level compliance check used by the rights gate. */
export function containsProfanity(text?: string) {
  return !!text && profanity.test(text);
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));
