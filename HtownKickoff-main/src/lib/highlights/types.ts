// Domain types for the trend-aware highlight engine. Each section mirrors one
// box of the workflow diagram (docs/trend-aware-highlights.md).

export type Sport = 'Soccer' | 'Basketball';

export const pipelineSteps = [
  'Match video', 'Match statistics', 'X social data', 'Video understanding', 'Event fusion',
  'Viral potential analysis', 'Viral score engine', 'Rank all moments', 'Select top moments', 'Key moments output',
] as const;
export type StepState = 'pending' | 'working' | 'ready' | 'error';
export type StepStatus = { step: number; name: string; state: StepState; message: string; updatedAt: string };
export type Job = { id: string; title: string; createdAt: string; updatedAt: string; steps: StepStatus[] };

export const eventTypes = [
  'goal', 'penalty', 'red_card', 'big_chance', 'save', 'shot', 'yellow_card', 'foul',
  'celebration', 'crowd_reaction', 'player_reaction', 'substitution',
  'dunk', 'three_pointer', 'block', 'assist', 'other',
] as const;
export type EventType = typeof eventTypes[number];

/** The six viral-potential signals: S, T, E, C, A and Q. */
export const factorKeys = ['sports', 'social', 'emotion', 'controversy', 'audience', 'quality'] as const;
export type FactorKey = typeof factorKeys[number];
/** Each factor is normalized to 0–1; null means the signal is genuinely unavailable. */
export type Factors = Record<FactorKey, number | null>;
export type Weights = Record<FactorKey, number>;

/** Where a piece of evidence came from, so measured data is never confused with model inference. */
export type EvidenceSource = 'official_stats' | 'x_measured' | 'video_model' | 'video_search' | 'audience_profile' | 'heuristic';
export type Evidence = { factor: FactorKey; source: EvidenceSource; value: number; note: string };

// 1 · Match video
export type SourceKind = 'library' | 'upload' | 'hls';
export type MatchSource = {
  kind: SourceKind;
  name: string;
  /** TwelveLabs indexed asset (search) and raw asset (analysis, playback). */
  indexedAssetId?: string;
  assetId?: string;
  scoreplay?: { mediaId: string; eventId?: string };
  playbackUrl?: string;
  hlsUrl?: string;
  captureSeconds?: number;
  /** UTC wall-clock time of video second zero, when the stream reports it. */
  programDateTime?: string;
  duration: number;
};

export type HighlightPreferences = {
  sport: Sport;
  /** Total highlight length budget in seconds. */
  targetSeconds: number;
  maxMoments: number;
  minGapSeconds: number;
  beforeSeconds?: number;
  afterSeconds?: number;
  weights: Weights;
  queries: { type: EventType; text: string }[];
  favoriteTeam?: string;
  starPlayers: string[];
};

// 2 · Match statistics
export type MatchEvent = {
  id: string;
  /** Match clock, e.g. minute 90 + 4 minutes of stoppage, second 30. */
  minute: number;
  second?: number;
  stoppage?: number;
  period: 1 | 2 | 3 | 4;
  type: EventType;
  team?: string;
  player?: string;
};
/** Video second at which each period kicks off; maps match time to video time. */
export type ClockAnchor = { period: 1 | 2 | 3 | 4; videoSeconds: number };

// 3 · X social data
export type SocialPost = {
  id: string;
  postedAt: string;
  text: string;
  likes: number;
  replies: number;
  reposts: number;
  authorFollowers?: number;
};
export type SocialQuery = { text: string; start: string; end: string };
export type SocialData =
  | { status: 'available'; query: SocialQuery; posts: SocialPost[]; truncated: boolean }
  | { status: 'unavailable' | 'not_requested'; reason: string; posts: [] };

export type MatchInput = {
  matchId: string;
  title: string;
  homeTeam?: string;
  awayTeam?: string;
  /** UTC time of video second zero; needed to align X posts with video moments. */
  videoStartUtc?: string;
  /** Typical delay between an on-field event and fan posts. */
  reactionDelaySeconds: number;
  events: MatchEvent[];
  anchors: ClockAnchor[];
  social: { enabled: boolean; query?: string };
  rightsDeclared: boolean;
};

// 4 · Video understanding
export type VideoReview = {
  eventType: EventType;
  description: string;
  team: string | null;
  players: string[];
  importance: number | null;
  excitement: number | null;
  emotionalIntensity: { score: number | null; evidence: string };
  controversySurprise: { score: number | null; evidence: string };
  watchability: number | null;
  isReplay: boolean;
  duplicateOf: string | null;
  suggestedStart: number;
  suggestedEnd: number;
  /** False when the model's clip boundaries were unsafe and the searched interval was kept. */
  boundariesVerified: boolean;
  needsReview: boolean;
  reason: string;
};
export type CandidateMoment = {
  id: string;
  type: EventType;
  query: string;
  start: number;
  end: number;
  searchRank: number;
  transcription?: string;
  review?: VideoReview;
};

// 5 · Event fusion
export type SocialWindow = {
  posts: number;
  engagement: number;
  /** Post-volume z-score against the match baseline; null without enough baseline windows. */
  zScore: number | null;
  /** Share of the busiest window's engagement, 0–1. */
  engagementShare: number;
  keywordShare: number;
  positive: number;
  negative: number;
  influencerPosts: number;
  mentions: string[];
  postIds: string[];
};
export type UnifiedEvent = {
  eventId: string;
  type: EventType;
  label: string;
  matchId: string;
  video: { start: number; end: number };
  clip: { start: number; end: number; fromModel: boolean };
  matchTime: string | null;
  team: string | null;
  players: string[];
  officialEventId: string | null;
  social: SocialWindow | null;
  review: VideoReview | null;
  transcription?: string;
};

// 6 · Viral potential analysis
export type AnalyzedEvent = UnifiedEvent & { factors: Factors; evidence: Evidence[] };

// 7 · Viral score engine
export type ScoredEvent = AnalyzedEvent & {
  /** 0–1 weighted score, renormalized over the available signals. */
  viralScore: number | null;
  effectiveWeights: Weights;
  contributions: Weights;
  /** Share of configured weight backed by evidence, 0–1. Not a calibrated probability. */
  confidence: number;
  missingSignals: FactorKey[];
};

// 8 · Rank all moments
export type RankedEvent = ScoredEvent & { rank: number; duplicateOf: string | null };

// 9 · Select top moments
export type RightsStatus = 'permitted' | 'pending_verification' | 'restricted';
export type SkipReason = { eventId: string; reason: string };
export type Selection = {
  rights: { status: RightsStatus; reason: string };
  /** Playback order (chronological). */
  selected: RankedEvent[];
  skipped: SkipReason[];
  totalSeconds: number;
};
