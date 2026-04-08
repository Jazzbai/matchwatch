"use client";

import type { League, Match, Team } from "./data";

type TeamLike = Pick<Team, "name" | "shortName" | "image" | "crest"> | undefined;
type LeagueLike = Pick<League, "name" | "shortName" | "image" | "logo"> | undefined;

function trimOrUndefined(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}

export function isSingleEventMatch(match?: Pick<Match, "eventFormat"> | null) {
    return match?.eventFormat === "SINGLE_EVENT";
}

export function getPreferredTeamName(matchTeamName?: string | null, team?: TeamLike) {
    return trimOrUndefined(matchTeamName) || trimOrUndefined(team?.name) || trimOrUndefined(team?.shortName) || "Team";
}

export function getSingleEventTitle(match?: Pick<Match, "eventTitle"> | null, league?: LeagueLike) {
    return trimOrUndefined(match?.eventTitle) || trimOrUndefined(league?.name) || trimOrUndefined(league?.shortName) || "Event";
}

export function getSingleEventSubtitle(match?: (Pick<Match, "eventSubtitle"> & { venueName?: string | null }) | null, league?: LeagueLike) {
    return trimOrUndefined(match?.eventSubtitle) || trimOrUndefined(match?.venueName) || trimOrUndefined(league?.name);
}

export function getMatchDisplay(match: Pick<Match, "eventFormat" | "eventTitle" | "eventSubtitle" | "homeTeamName" | "awayTeamName"> & { venueName?: string | null }, options?: { homeTeam?: TeamLike; awayTeam?: TeamLike; league?: LeagueLike }) {
    const homeName = getPreferredTeamName(match.homeTeamName, options?.homeTeam);
    const awayName = getPreferredTeamName(match.awayTeamName, options?.awayTeam);
    const singleEvent = isSingleEventMatch(match);
    const title = singleEvent ? getSingleEventTitle(match, options?.league) : homeName;
    const subtitle = singleEvent ? getSingleEventSubtitle(match, options?.league) : awayName;

    return {
        isSingleEvent: singleEvent,
        title,
        subtitle,
        homeName,
        awayName,
        label: singleEvent ? `${title}${subtitle ? ` · ${subtitle}` : ""}` : `${homeName} vs ${awayName}`,
    };
}

export function getLeagueVisual(league?: LeagueLike) {
    return {
        image: trimOrUndefined(league?.image),
        logo: trimOrUndefined(league?.logo) || trimOrUndefined(league?.shortName) || trimOrUndefined(league?.name) || "LG",
    };
}
