/**
 * Status state machine + eligibility filter helpers for venue predictions.
 * Pure functions — no DB, no IO. Imported by the dashboard routes.
 */

export type PredictionCampaignStatus = 'DRAFT' | 'OPEN' | 'LOCKED' | 'SETTLED' | 'DRAWN';
export type PredictionPrizeEligibility = 'CORRECT_WINNER' | 'EXACT_SCORE' | 'ANY_ENTRY';
export type PredictionWinnerPick = 'HOME' | 'AWAY' | 'DRAW';

const ALLOWED_TRANSITIONS: Record<PredictionCampaignStatus, PredictionCampaignStatus[]> = {
    DRAFT: ['OPEN'],
    OPEN: ['LOCKED'],
    LOCKED: ['OPEN', 'SETTLED'],
    SETTLED: ['LOCKED', 'DRAWN'],
    DRAWN: [],
};

export function canTransition(from: PredictionCampaignStatus, to: PredictionCampaignStatus) {
    return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isCampaignAcceptingEntries(
    status: PredictionCampaignStatus,
    opensAt: Date,
    closesAt: Date,
    now: Date = new Date(),
) {
    if (status !== 'OPEN') return false;
    if (now < opensAt) return false;
    if (now >= closesAt) return false;
    return true;
}

export function computeActualWinner(homeScore: number, awayScore: number): PredictionWinnerPick {
    if (homeScore > awayScore) return 'HOME';
    if (awayScore > homeScore) return 'AWAY';
    return 'DRAW';
}

export function pointsForEntry(
    isCorrectWinner: boolean,
    isExactScore: boolean,
    pointsCorrectWinner: number,
    pointsExactScore: number,
) {
    if (isExactScore) return pointsExactScore;
    if (isCorrectWinner) return pointsCorrectWinner;
    return 0;
}

/**
 * Knockout stage detection. Football-Data.org and friends report
 * stage strings like 'GROUP_STAGE', 'LAST_16', 'QUARTER_FINALS',
 * 'SEMI_FINALS', 'FINAL', 'THIRD_PLACE', 'PLAYOFFS'. Anything that
 * involves elimination ends in a single winner — no draws possible.
 */
export function isKnockoutStage(stage: string | null | undefined): boolean {
    if (!stage) return false;
    return /(LAST_|ROUND_OF_|QUARTER|SEMI|FINAL|KNOCKOUT|PLAYOFF|THIRD_PLACE)/i.test(stage);
}

/**
 * Cross-field validation: the predicted score (if given) must be
 * consistent with the predicted winner. We accept missing scores —
 * those just don't qualify for the exact-score prize.
 *
 * For knockout matches the convention is: HOME/AWAY pick allows an
 * equal scoreline (the predictor implicitly says it'll be decided on
 * penalties after a tied regulation/ET). DRAW is not a valid pick at
 * all in a knockout — the submit route also rejects DRAW for knockouts
 * before this runs.
 */
export function validateScoreConsistency(
    pick: PredictionWinnerPick,
    homeScore: number | null | undefined,
    awayScore: number | null | undefined,
    isKnockout: boolean,
): { ok: true } | { ok: false; reason: string } {
    if (homeScore == null || awayScore == null) return { ok: true };
    if (pick === 'DRAW') {
        if (isKnockout) return { ok: false, reason: 'Knockout matches cannot end in a draw — pick a winner instead.' };
        if (homeScore !== awayScore) return { ok: false, reason: 'Draw prediction needs equal scores.' };
        return { ok: true };
    }
    if (pick === 'HOME') {
        if (isKnockout) {
            return homeScore >= awayScore ? { ok: true } : { ok: false, reason: 'If home wins, home score cannot be lower than away.' };
        }
        return homeScore > awayScore ? { ok: true } : { ok: false, reason: 'If home wins, home score must be greater than away.' };
    }
    // AWAY
    if (isKnockout) {
        return awayScore >= homeScore ? { ok: true } : { ok: false, reason: 'If away wins, away score cannot be lower than home.' };
    }
    return awayScore > homeScore ? { ok: true } : { ok: false, reason: 'If away wins, away score must be greater than home.' };
}
