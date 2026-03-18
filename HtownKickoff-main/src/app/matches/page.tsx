"use client";

import React from "react";
import Link from "next/link";
import { CalendarDays, CircleDot, Globe, Timer, Trophy } from "lucide-react";
import { AppShell } from "../../components/AppShell";
import { MatchCard } from "../../components/MatchCard";
import { useData } from "../../lib/data-provider";
import { formatLocalDateFilterLabel, formatMatchKickoffLocal, getLocalDateKey } from "../../lib/datetime";

function asTimestamp(value: string) {
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function toMatchRowKey(match: {
  id: string;
  leagueId: string;
  homeTeamId: string;
  awayTeamId: string;
  matchDateUTC: string;
}) {
  return `${match.id}:${match.leagueId}:${match.homeTeamId}:${match.awayTeamId}:${getLocalDateKey(match.matchDateUTC)}`;
}

export default function MatchesPage() {
  const [activeStatus, setActiveStatus] = React.useState<"all" | "live" | "upcoming" | "finished">("upcoming");
  const [onlyWithHosting, setOnlyWithHosting] = React.useState(false);
  const [selectedLeagueId, setSelectedLeagueId] = React.useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = React.useState<string | null>(null);
  const [selectedDateKey, setSelectedDateKey] = React.useState<string | null>(null);
  const [selectedTeamIds, setSelectedTeamIds] = React.useState<string[]>([]);
  const { matches: MATCHES, leagues, teams, venueEvents, getTeam, getLeague } = useData();

  const baseMatches = React.useMemo(() => {
    const threshold = Date.now() - 2 * 60 * 60 * 1000;
    return MATCHES.filter((match) => {
      const ts = asTimestamp(match.matchDateUTC);
      const isLive = match.status === "IN_PLAY" || match.status === "PAUSED";
      const isFinished = match.status === "FINISHED";
      const isUpcoming = (match.status === "SCHEDULED" || match.status === "TIMED") && ts >= threshold;
      return isLive || isUpcoming || isFinished;
    });
  }, [MATCHES]);

  const uniqueBaseMatches = React.useMemo(() => {
    const seen = new Set<string>();
    const rows: typeof baseMatches = [];
    for (const match of baseMatches) {
      const key = toMatchRowKey(match);
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(match);
    }
    return rows;
  }, [baseMatches]);

  const availableTeams = React.useMemo(() => {
    const ids = new Set<string>();
    for (const match of uniqueBaseMatches) {
      ids.add(match.homeTeamId);
      ids.add(match.awayTeamId);
    }
    return teams.filter((team) => ids.has(team.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [uniqueBaseMatches, teams]);

  const availableLeagues = React.useMemo(() => {
    const leagueIdsInDataset = new Set(uniqueBaseMatches.map((m) => m.leagueId));
    return leagues
      .filter((league) => leagueIdsInDataset.has(league.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [uniqueBaseMatches, leagues]);

  const availableCountries = React.useMemo(() => {
    const leagueIdsInDataset = new Set(uniqueBaseMatches.map((m) => m.leagueId));
    const countries = new Set<string>();
    for (const league of leagues) {
      if (!leagueIdsInDataset.has(league.id)) continue;
      if (!league.country) continue;
      countries.add(league.country);
    }
    return Array.from(countries).sort((a, b) => a.localeCompare(b));
  }, [uniqueBaseMatches, leagues]);

  const hostingMatchIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const venueEvent of venueEvents) {
      if (venueEvent.isActive === false) continue;
      ids.add(String(venueEvent.matchId).trim().toLowerCase());
    }
    return ids;
  }, [venueEvents]);

  const rowsBeforeDate = React.useMemo(() => {
    return uniqueBaseMatches.filter((match) => {
      const matchIdKey = String(match.id).trim().toLowerCase();
      const hostingAllowed = !onlyWithHosting || hostingMatchIds.has(matchIdKey);
      const leagueAllowed = !selectedLeagueId || match.leagueId === selectedLeagueId;
      const league = getLeague(match.leagueId);
      const countryAllowed = !selectedCountry || league?.country === selectedCountry;
      const teamAllowed =
        selectedTeamIds.length === 0 ||
        selectedTeamIds.includes(match.homeTeamId) ||
        selectedTeamIds.includes(match.awayTeamId);

      const statusAllowed =
        activeStatus === "all" ||
        (activeStatus === "live" && (match.status === "IN_PLAY" || match.status === "PAUSED")) ||
        (activeStatus === "upcoming" && (match.status === "SCHEDULED" || match.status === "TIMED")) ||
        (activeStatus === "finished" && match.status === "FINISHED");

      return hostingAllowed && leagueAllowed && countryAllowed && teamAllowed && statusAllowed;
    });
  }, [uniqueBaseMatches, onlyWithHosting, hostingMatchIds, selectedLeagueId, selectedCountry, selectedTeamIds, activeStatus, getLeague]);

  const availableDateFilters = React.useMemo(() => {
    const dateMap = new Map<string, string>();
    for (const match of rowsBeforeDate) {
      const key = getLocalDateKey(match.matchDateUTC);
      if (!key) continue;
      if (!dateMap.has(key)) {
        dateMap.set(key, formatLocalDateFilterLabel(key));
      }
    }
    return Array.from(dateMap.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.value.localeCompare(b.value));
  }, [rowsBeforeDate]);

  React.useEffect(() => {
    if (!selectedLeagueId) return;
    if (!availableLeagues.some((league) => league.id === selectedLeagueId)) {
      setSelectedLeagueId(null);
    }
  }, [selectedLeagueId, availableLeagues]);

  React.useEffect(() => {
    if (!selectedCountry) return;
    if (!availableCountries.includes(selectedCountry)) {
      setSelectedCountry(null);
    }
  }, [selectedCountry, availableCountries]);

  React.useEffect(() => {
    if (!selectedDateKey) return;
    if (!availableDateFilters.some((item) => item.value === selectedDateKey)) {
      setSelectedDateKey(null);
    }
  }, [selectedDateKey, availableDateFilters]);

  React.useEffect(() => {
    setSelectedTeamIds((prev) => prev.filter((teamId) => availableTeams.some((team) => team.id === teamId)));
  }, [availableTeams]);

  const filtered = React.useMemo(() => {
      const rows = rowsBeforeDate.filter((match) => {
      if (!selectedDateKey) return true;
      return getLocalDateKey(match.matchDateUTC) === selectedDateKey;
    });

    return rows.sort((a, b) => {
      const aLive = a.status === "IN_PLAY" || a.status === "PAUSED";
      const bLive = b.status === "IN_PLAY" || b.status === "PAUSED";
      if (aLive && !bLive) return -1;
      if (!aLive && bLive) return 1;

      const aFinished = a.status === "FINISHED";
      const bFinished = b.status === "FINISHED";
      const ta = asTimestamp(a.matchDateUTC);
      const tb = asTimestamp(b.matchDateUTC);
      if (aFinished && bFinished) return tb - ta;
      return ta - tb;
    });
  }, [rowsBeforeDate, selectedDateKey]);

  const liveCount = MATCHES.filter((m) => m.status === "IN_PLAY" || m.status === "PAUSED").length;
  const statusTabs = [
    { id: "all", label: "All" },
    { id: "live", label: "Live" },
    { id: "upcoming", label: "Upcoming" },
    { id: "finished", label: "Results" },
  ];

  return (
      <AppShell>
        <section style={{ maxWidth: 1400, margin: "0 auto", padding: "0 24px 24px", position: "relative", overflow: "hidden" }}>
          {/* Subtle gradient background */}
          <div style={{ position: "absolute", top: -100, right: -100, width: 400, height: 400, borderRadius: "50%", background: "color-mix(in oklch, var(--primary) 8%, transparent)", filter: "blur(80px)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: -50, left: -100, width: 300, height: 300, borderRadius: "50%", background: "color-mix(in oklch, oklch(0.6 0.15 250) 8%, transparent)", filter: "blur(80px)", pointerEvents: "none" }} />
          
          <div style={{ position: "relative", zIndex: 10 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 99, backgroundColor: "var(--secondary)", fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--secondary-foreground)", marginBottom: 16, border: "1px solid var(--border)" }}>
              <Trophy size={14} style={{ color: "var(--primary)" }} />
              Browse
            </div>
            <h1 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: 48, fontWeight: 900, color: "var(--foreground)", marginBottom: 8, letterSpacing: "-0.02em", lineHeight: 1 }}>
              Matches
            </h1>
            <p style={{ fontSize: 15, color: "var(--muted-foreground)", marginBottom: 24, maxWidth: 520, lineHeight: 1.6, fontWeight: 500 }}>
              Browse live matches, upcoming fixtures, and recent results with inline league, region, date, and team filters.
            </p>

            {liveCount > 0 && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "10px 20px", borderRadius: 99, backgroundColor: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", marginBottom: 24 }}>
                <span style={{ position: "relative", width: 10, height: 10 }}>
                  <span style={{ position: "absolute", inset: 0, borderRadius: "50%", backgroundColor: "#f59e0b", animation: "ping 1.5s cubic-bezier(0,0,0.2,1) infinite", opacity: 0.5 }} />
                  <span style={{ position: "relative", display: "block", width: 10, height: 10, borderRadius: "50%", backgroundColor: "#f59e0b" }} />
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#f59e0b", letterSpacing: "0.02em" }}>
                  {liveCount} match{liveCount > 1 ? "es" : ""} live now
                </span>
              </div>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
              <label style={{
                display: "flex", alignItems: "center", gap: 8, padding: "0 16px", height: 36, borderRadius: 8,
                border: onlyWithHosting ? "1px solid var(--primary)" : "1px solid var(--border)",
                backgroundColor: onlyWithHosting ? "color-mix(in oklch, var(--primary) 5%, transparent)" : "var(--card)",
                color: onlyWithHosting ? "var(--primary)" : "var(--muted-foreground)",
                fontWeight: 600, fontSize: 13, cursor: "pointer", transition: "all 0.2s",
              }}>
                <input
                  type="checkbox"
                  checked={onlyWithHosting}
                  onChange={(e) => setOnlyWithHosting(e.target.checked)}
                  style={{ width: 16, height: 16, borderRadius: 4, accentColor: "var(--primary)", cursor: "pointer" }}
                />
                Only with hosting venues
              </label>
            </div>
          </div>
        </section>

        {/* ─── Unified Filter Panel ─── */}
        <section style={{ maxWidth: 1400, margin: "0 auto", padding: "0 24px 24px" }}>
          <div style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
            
            {/* Status Tabs Row */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, padding: 4, backgroundColor: "var(--secondary)", borderRadius: 14, border: "1px solid var(--border)", width: "fit-content", overflowX: "auto" }} className="custom-scrollbar">
              {statusTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveStatus(tab.id as typeof activeStatus)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "10px 20px", borderRadius: 10, border: "none",
                    fontSize: 13, fontWeight: 700, cursor: "pointer",
                    fontFamily: "inherit", whiteSpace: "nowrap",
                    transition: "all 0.2s",
                    backgroundColor: activeStatus === tab.id ? "var(--background)" : "transparent",
                    color: activeStatus === tab.id ? "var(--foreground)" : "var(--muted-foreground)",
                    boxShadow: activeStatus === tab.id ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  }}
                >
                  {tab.id === "live" && <CircleDot size={14} style={{ color: activeStatus === "live" ? "#f59e0b" : "inherit" }} />}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div style={{ height: 1, backgroundColor: "var(--border)" }} />

            {/* League Filter Row */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em", flexShrink: 0, minWidth: 60 }}>League</span>
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }} className="no-scrollbar">
                <button
                  onClick={() => setSelectedLeagueId(null)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "7px 14px", borderRadius: 99,
                    fontSize: 12, fontWeight: 700, cursor: "pointer",
                    fontFamily: "inherit", whiteSpace: "nowrap",
                    border: selectedLeagueId === null ? "1px solid var(--primary)" : "1px solid var(--border)",
                    backgroundColor: selectedLeagueId === null ? "color-mix(in oklch, var(--primary) 12%, transparent)" : "transparent",
                    color: selectedLeagueId === null ? "var(--primary)" : "var(--muted-foreground)",
                    transition: "all 0.2s",
                  }}
                >
                  <Globe size={13} /> All
                </button>
                {availableLeagues.map((league) => {
                  const sel = selectedLeagueId === league.id;
                  return (
                    <button
                      key={league.id}
                      onClick={() => setSelectedLeagueId((prev) => (prev === league.id ? null : league.id))}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "7px 14px", borderRadius: 99,
                        fontSize: 12, fontWeight: 700, cursor: "pointer",
                        fontFamily: "inherit", whiteSpace: "nowrap",
                        border: sel ? "1px solid var(--primary)" : "1px solid var(--border)",
                        backgroundColor: sel ? "color-mix(in oklch, var(--primary) 12%, transparent)" : "transparent",
                        color: sel ? "var(--primary)" : "var(--muted-foreground)",
                        transition: "all 0.2s",
                      }}
                    >
                      {league.image ? <img src={league.image} alt={league.shortName} style={{ width: 16, height: 16, objectFit: "contain" }} /> : null}
                      {league.shortName}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Country Filter Row */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em", flexShrink: 0, minWidth: 60 }}>Region</span>
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }} className="no-scrollbar">
                <button
                  onClick={() => setSelectedCountry(null)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "7px 14px", borderRadius: 99,
                    fontSize: 12, fontWeight: 700, cursor: "pointer",
                    fontFamily: "inherit", whiteSpace: "nowrap",
                    border: selectedCountry === null ? "1px solid var(--primary)" : "1px solid var(--border)",
                    backgroundColor: selectedCountry === null ? "color-mix(in oklch, var(--primary) 12%, transparent)" : "transparent",
                    color: selectedCountry === null ? "var(--primary)" : "var(--muted-foreground)",
                    transition: "all 0.2s",
                  }}
                >
                  <Globe size={13} /> All
                </button>
                {availableCountries.map((country) => {
                  const sel = selectedCountry === country;
                  return (
                    <button
                      key={country}
                      onClick={() => setSelectedCountry((prev) => (prev === country ? null : country))}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "7px 14px", borderRadius: 99,
                        fontSize: 12, fontWeight: 700, cursor: "pointer",
                        fontFamily: "inherit", whiteSpace: "nowrap",
                        border: sel ? "1px solid var(--primary)" : "1px solid var(--border)",
                        backgroundColor: sel ? "color-mix(in oklch, var(--primary) 12%, transparent)" : "transparent",
                        color: sel ? "var(--primary)" : "var(--muted-foreground)",
                        transition: "all 0.2s",
                      }}
                    >
                      {country}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date Filter Row */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em", flexShrink: 0, minWidth: 60 }}>Date</span>
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }} className="no-scrollbar">
                <button
                  onClick={() => setSelectedDateKey(null)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "7px 14px", borderRadius: 99,
                    fontSize: 12, fontWeight: 700, cursor: "pointer",
                    fontFamily: "inherit", whiteSpace: "nowrap",
                    border: selectedDateKey === null ? "1px solid var(--primary)" : "1px solid var(--border)",
                    backgroundColor: selectedDateKey === null ? "color-mix(in oklch, var(--primary) 12%, transparent)" : "transparent",
                    color: selectedDateKey === null ? "var(--primary)" : "var(--muted-foreground)",
                    transition: "all 0.2s",
                  }}
                >
                  <CalendarDays size={13} /> All
                </button>
                {availableDateFilters.map((item) => {
                  const sel = selectedDateKey === item.value;
                  return (
                    <button
                      key={item.value}
                      onClick={() => setSelectedDateKey((prev) => (prev === item.value ? null : item.value))}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "7px 14px", borderRadius: 99,
                        fontSize: 12, fontWeight: 700, cursor: "pointer",
                        fontFamily: "inherit", whiteSpace: "nowrap",
                        border: sel ? "1px solid var(--primary)" : "1px solid var(--border)",
                        backgroundColor: sel ? "color-mix(in oklch, var(--primary) 12%, transparent)" : "transparent",
                        color: sel ? "var(--primary)" : "var(--muted-foreground)",
                        transition: "all 0.2s",
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em", flexShrink: 0, minWidth: 60 }}>Team</span>
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }} className="no-scrollbar">
                <button
                  onClick={() => setSelectedTeamIds([])}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "7px 14px", borderRadius: 99,
                    fontSize: 12, fontWeight: 700, cursor: "pointer",
                    fontFamily: "inherit", whiteSpace: "nowrap",
                    border: selectedTeamIds.length === 0 ? "1px solid var(--primary)" : "1px solid var(--border)",
                    backgroundColor: selectedTeamIds.length === 0 ? "color-mix(in oklch, var(--primary) 12%, transparent)" : "transparent",
                    color: selectedTeamIds.length === 0 ? "var(--primary)" : "var(--muted-foreground)",
                    transition: "all 0.2s",
                  }}
                >
                  All
                </button>
                {availableTeams.map((team) => {
                  const selected = selectedTeamIds.includes(team.id);
                  return (
                    <button
                      key={team.id}
                      onClick={() => {
                        setSelectedTeamIds((prev) =>
                          selected ? prev.filter((id) => id !== team.id) : [...prev, team.id],
                        );
                      }}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "7px 14px", borderRadius: 99,
                        fontSize: 12, fontWeight: 700, cursor: "pointer",
                        fontFamily: "inherit", whiteSpace: "nowrap",
                        border: selected ? "1px solid var(--primary)" : "1px solid var(--border)",
                        backgroundColor: selected ? "color-mix(in oklch, var(--primary) 12%, transparent)" : "transparent",
                        color: selected ? "var(--primary)" : "var(--muted-foreground)",
                        transition: "all 0.2s",
                      }}
                    >
                      {team.shortName}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        </section>

        <section style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 24px 96px" }}>
          {filtered.length === 0 ? (
            <div className="text-center py-20 px-5 bg-card border border-border/50 rounded-2xl shadow-sm mt-4">
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center">
                  <Timer size={36} className="text-muted-foreground" />
                </div>
              </div>
              <h3 className="font-display text-2xl font-bold text-foreground mb-3">
                No Matches Found
              </h3>
              <p className="text-base text-muted-foreground max-w-sm mx-auto">
                Try changing your filters, selecting a different date, or turning off "Only with hosting venues."
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filtered.map((match, i) => {
                const home = getTeam(match.homeTeamId);
                const away = getTeam(match.awayTeamId);
                const league = getLeague(match.leagueId);
                if (!home || !away || !league) return null;
                const kickoffLabel =
                  match.status === "IN_PLAY" ? "LIVE" :
                  match.status === "PAUSED" ? "HT" :
                  match.status === "FINISHED" ? "FT" :
                  formatMatchKickoffLocal(match.matchDateUTC);

                return (
                  <Link
                    href={`/matches/${match.id}`}
                    key={toMatchRowKey(match)}
                    className={`animate-fade-up block h-full`}
                    style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
                  >
                    <MatchCard
                      className="h-full"
                      homeTeam={home.shortName}
                      awayTeam={away.shortName}
                      homeCrest={home.crest}
                      awayCrest={away.crest}
                      homeImage={home.image}
                      awayImage={away.image}
                      kickoff={kickoffLabel}
                      league={league.name}
                      leagueLogo={league.logo}
                      leagueImage={league.image}
                      venueCount={match.venueCount}
                      status={match.status === "IN_PLAY" || match.status === "PAUSED" ? "LIVE" : match.status === "FINISHED" ? "FINISHED" : "SCHEDULED"}
                      homeScore={match.homeScore ?? undefined}
                      awayScore={match.awayScore ?? undefined}
                      matchDay={match.matchDay}
                      isHot={match.isHot}
                    />
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </AppShell>
  );
}
