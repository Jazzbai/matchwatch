import { buildTeamIdentityCandidates } from './teamIdentity';

export type PlayerContextTeam = {
    id: string;
    name: string;
    slug: string;
    shortName?: string | null;
    crestUrl?: string | null;
    aliases?: string[] | null;
    leagueId?: string | null;
    externalId?: string | null;
    heroImageUrl?: string | null;
    shortDescription?: string | null;
    description?: string | null;
};

export type PlayerContextRosterMembership = {
    team: PlayerContextTeam;
    position?: string | null;
    shirtNumber?: string | null;
    isCaptain?: boolean;
    sortOrder?: number | null;
};

type ResolvePlayerContextInput = {
    currentLeagueId?: string | null;
    availableTeams?: PlayerContextTeam[];
    rosterMemberships?: PlayerContextRosterMembership[];
    shortDescription?: string | null;
    description?: string | null;
    aliases?: string[] | null;
};

export function buildPlayerProfileText(input: Pick<ResolvePlayerContextInput, 'shortDescription' | 'description' | 'aliases'>) {
    return [input.shortDescription, input.description, ...(input.aliases || [])]
        .map((value) => (value || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join(' ');
}

function normalizeSearchText(value: string) {
    return value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

export function inferPlayerRoleFromText(text: string | null | undefined) {
    const normalized = (text || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return null;

    const patterns = [
        /plays as (?:an? )?([^.,;]+?) for/i,
        /plays for [^.]+? as (?:an? )?([^.,;]+?)(?:[.,;]|$)/i,
        /is an? ([^.,;]+?) for/i,
        /is an? ([^.,;]+?) with/i,
    ];

    for (const pattern of patterns) {
        const match = normalized.match(pattern);
        if (!match?.[1]) continue;
        const role = match[1].replace(/\s+/g, ' ').trim();
        if (role) return role.charAt(0).toUpperCase() + role.slice(1);
    }

    return null;
}

export function inferCurrentTeamFromText(
    text: string | null | undefined,
    teams: PlayerContextTeam[],
) {
    const normalizedText = normalizeSearchText(text || '');
    if (!normalizedText) return null;

    let best: { team: PlayerContextTeam; score: number } | null = null;

    for (const team of teams) {
        const candidates = buildTeamIdentityCandidates(team);
        let score = -1;

        for (const candidate of candidates) {
            if (!candidate) continue;
            const pattern = new RegExp(`(^|\\s)${candidate.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}(\\s|$)`, 'i');
            if (!pattern.test(normalizedText)) continue;

            const candidateScore = candidate.length * 10
                + (candidate === normalizeSearchText(team.name) ? 5 : 0)
                + (candidate === normalizeSearchText(team.shortName || '') ? 2 : 0);
            score = Math.max(score, candidateScore);
        }

        if (score < 0) continue;
        if (!best || score > best.score) best = { team, score };
    }

    return best?.team || null;
}

function chooseRosterMembership(
    memberships: PlayerContextRosterMembership[],
    currentLeagueId?: string | null,
) {
    return [...memberships].sort((left, right) => {
        const leftLeagueScore = left.team.leagueId && currentLeagueId && left.team.leagueId === currentLeagueId ? 1 : 0;
        const rightLeagueScore = right.team.leagueId && currentLeagueId && right.team.leagueId === currentLeagueId ? 1 : 0;
        if (rightLeagueScore !== leftLeagueScore) return rightLeagueScore - leftLeagueScore;

        const leftCaptainScore = left.isCaptain ? 1 : 0;
        const rightCaptainScore = right.isCaptain ? 1 : 0;
        if (rightCaptainScore !== leftCaptainScore) return rightCaptainScore - leftCaptainScore;

        const leftSortOrder = left.sortOrder ?? Number.MAX_SAFE_INTEGER;
        const rightSortOrder = right.sortOrder ?? Number.MAX_SAFE_INTEGER;
        if (leftSortOrder !== rightSortOrder) return leftSortOrder - rightSortOrder;

        return left.team.name.localeCompare(right.team.name);
    })[0] || null;
}

export function resolvePlayerContext(input: ResolvePlayerContextInput) {
    const memberships = input.rosterMemberships || [];
    const explicitMembership = chooseRosterMembership(memberships, input.currentLeagueId);
    const profileText = buildPlayerProfileText(input);

    const currentTeam = explicitMembership?.team
        || inferCurrentTeamFromText(profileText, input.availableTeams || []);
    const role = explicitMembership?.position || inferPlayerRoleFromText(profileText);

    return {
        currentTeam,
        role,
        shirtNumber: explicitMembership?.shirtNumber || null,
        isCaptain: explicitMembership?.isCaptain || false,
        source: explicitMembership ? 'roster' as const : (currentTeam || role ? 'inferred' as const : null),
    };
}
