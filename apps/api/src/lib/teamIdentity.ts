type TeamIdentityFields = {
    name?: string | null;
    shortName?: string | null;
    aliases?: string[] | null;
    externalId?: string | null;
    crestUrl?: string | null;
    heroImageUrl?: string | null;
    shortDescription?: string | null;
    description?: string | null;
};

const GENERIC_TEAM_TOKENS = new Set(['fc', 'afc', 'cf', 'sc', 'ac', 'cfc']);

function stripGenericTeamTokens(tokens: string[]) {
    let start = 0;
    let end = tokens.length;

    while (start < end && GENERIC_TEAM_TOKENS.has(tokens[start])) {
        start += 1;
    }
    while (end > start && GENERIC_TEAM_TOKENS.has(tokens[end - 1])) {
        end -= 1;
    }

    return tokens.slice(start, end);
}

export function normalizeTeamIdentity(value: string | null | undefined) {
    const normalized = (value || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

    if (!normalized) return '';

    const stripped = stripGenericTeamTokens(normalized.split(/\s+/g).filter(Boolean)).join(' ').trim();
    return stripped || normalized;
}

export function buildTeamIdentityCandidates(team: TeamIdentityFields) {
    const candidates = new Set<string>();
    for (const value of [team.name, team.shortName, ...(team.aliases || [])]) {
        const normalized = normalizeTeamIdentity(value);
        if (normalized) candidates.add(normalized);
    }
    return candidates;
}

export function scoreTeamIdentityRecord(team: TeamIdentityFields) {
    let score = 0;
    if (team.externalId) score += 8;
    if (team.crestUrl) score += 5;
    if (team.heroImageUrl) score += 3;
    if (team.shortDescription) score += 2;
    if (team.description) score += 2;
    if (team.aliases && team.aliases.length > 0) score += 1;
    return score;
}

export function choosePreferredTeamRecord<T extends TeamIdentityFields>(rows: T[]) {
    return [...rows].sort((left, right) => {
        const scoreDiff = scoreTeamIdentityRecord(right) - scoreTeamIdentityRecord(left);
        if (scoreDiff !== 0) return scoreDiff;
        const leftName = left.name || '';
        const rightName = right.name || '';
        const lengthDiff = rightName.length - leftName.length;
        if (lengthDiff !== 0) return lengthDiff;
        return leftName.localeCompare(rightName);
    })[0] || null;
}
