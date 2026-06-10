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
