import { eventCatalog, eventLabel } from './catalog';
import { alignOfficialEvent, matchClock } from './match-stats';
import { measureSocialWindow } from './social-signals';
import type { CandidateMoment, HighlightPreferences, MatchInput, SocialData, UnifiedEvent } from './types';

// Diagram step 5: combine video events, official match events and X reactions
// into one enriched record per moment.

/** Clip padding when the video review could not confirm boundaries (5 s before, 10 s after). */
export const PADDING = { before: 5, after: 10 };

export function fuseEvents(candidates: CandidateMoment[], input: MatchInput, preferences: HighlightPreferences, social: SocialData, duration: number): UnifiedEvent[] {
  return candidates.map(candidate => {
    const review = candidate.review ?? null;
    const type = review?.eventType ?? candidate.type;
    const official = alignOfficialEvent({ type, start: candidate.start, end: candidate.end }, input.events, input.anchors, preferences.sport);
    const players = unique([official?.player, ...(review?.players ?? [])]);
    const team = official?.team ?? review?.team ?? null;
    const clip = review?.boundariesVerified
      ? { start: review.suggestedStart, end: review.suggestedEnd, fromModel: true }
      : { start: Math.max(0, candidate.start - (preferences.beforeSeconds ?? PADDING.before)), end: Math.min(duration, candidate.end + (preferences.afterSeconds ?? PADDING.after)), fromModel: false };
    const entities = unique([team, ...players, input.homeTeam, input.awayTeam, preferences.favoriteTeam, ...preferences.starPlayers]);
    return {
      eventId: candidate.id,
      type,
      label: official?.player ? `${eventLabel(type)} · ${official.player}` : eventLabel(type),
      matchId: input.matchId,
      video: { start: candidate.start, end: candidate.end },
      clip,
      matchTime: matchClock(candidate.start, input.anchors, preferences.sport),
      team,
      players,
      officialEventId: official?.id ?? null,
      social: social.status === 'available' && input.videoStartUtc
        ? measureSocialWindow(candidate, social.posts, { videoStartUtc: input.videoStartUtc, reactionDelaySeconds: input.reactionDelaySeconds, keywords: eventCatalog[type].keywords, entities })
        : null,
      review,
      ...(candidate.transcription ? { transcription: candidate.transcription } : {}),
    };
  });
}

function unique(values: (string | null | undefined)[]) {
  const seen = new Set<string>();
  return values.filter((value): value is string => {
    const key = value?.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(value => value.trim());
}
