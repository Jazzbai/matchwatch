import { type League } from "./data";

export function isWorldCupLeague(league?: Pick<League, "name" | "shortName" | "externalId"> | null) {
    if (!league) return false;

    const name = `${league.name || ""} ${league.shortName || ""}`.toLowerCase();
    return league.externalId === "WC"
        || name.includes("world cup")
        || name.includes("global finals");
}

export function isNationalTeamCompetition(league?: Pick<League, "name" | "shortName" | "externalId"> | null) {
    if (!league) return false;
    if (isWorldCupLeague(league)) return true;

    const name = `${league.name || ""} ${league.shortName || ""} ${league.externalId || ""}`.toLowerCase();

    return name.includes("nations league")
        || name.includes("qualifier")
        || name.includes("qualifying")
        || name.includes("euro")
        || name.includes("copa am")
        || name.includes("gold cup")
        || name.includes("africa cup of nations")
        || name.includes("afcon")
        || name.includes("friendlies")
        || name.includes("international");
}
