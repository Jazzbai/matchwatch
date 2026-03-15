"use client";

import React from "react";
import Link from "next/link";
import { CalendarDays, CircleDot, Filter, Globe, History, Timer, X } from "lucide-react";
import { ThemeProvider, AppShell } from "../../components/AppShell";
import { MatchCard } from "../../components/MatchCard";
import { useData } from "../../lib/data-provider";

function asTimestamp(value: string) {
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function toUtcDateKey(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function ordinal(day: number) {
  if (day % 100 >= 11 && day % 100 <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

function formatDateFilterLabel(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) return dateKey;
  const month = date.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
  return `${month} ${ordinal(date.getUTCDate())}`;
}

function toMatchRowKey(match: {
  id: string;
  leagueId: string;
  homeTeamId: string;
  awayTeamId: string;
  matchDateUTC: string;
}) {
  return `${match.id}:${match.leagueId}:${match.homeTeamId}:${match.awayTeamId}:${toUtcDateKey(match.matchDateUTC)}`;
}

export default function MatchesPage() {
  const [activeStatus, setActiveStatus] = React.useState<"all" | "live" | "upcoming" | "finished">("upcoming");
  const [includePast, setIncludePast] = React.useState(false);
  const [onlyWithHosting, setOnlyWithHosting] = React.useState(false);
  const [showFilterModal, setShowFilterModal] = React.useState(false);
  const [selectedLeagueId, setSelectedLeagueId] = React.useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = React.useState<string | null>(null);
  const [selectedDateKey, setSelectedDateKey] = React.useState<string | null>(null);
  const [selectedTeamIds, setSelectedTeamIds] = React.useState<string[]>([]);
  const { matches: MATCHES, leagues, teams, venueEvents, getTeam, getLeague } = useData();

  React.useEffect(() => {
    if (!includePast && activeStatus === "finished") {
      setActiveStatus("upcoming");
    }
  }, [includePast, activeStatus]);

  const baseMatches = React.useMemo(() => {
    const threshold = Date.now() - 2 * 60 * 60 * 1000;
    return MATCHES.filter((match) => {
      if (includePast) return true;
      const ts = asTimestamp(match.matchDateUTC);
      const isLive = match.status === "IN_PLAY" || match.status === "PAUSED";
      const isUpcoming = (match.status === "SCHEDULED" || match.status === "TIMED") && ts >= threshold;
      return isLive || isUpcoming;
    });
  }, [MATCHES, includePast]);

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
      const key = toUtcDateKey(match.matchDateUTC);
      if (!key) continue;
      if (!dateMap.has(key)) {
        dateMap.set(key, formatDateFilterLabel(key));
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

  const filtered = React.useMemo(() => {
    const rows = rowsBeforeDate.filter((match) => {
      if (!selectedDateKey) return true;
      return toUtcDateKey(match.matchDateUTC) === selectedDateKey;
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
  const activeFilterCount =
    (selectedLeagueId ? 1 : 0) +
    (selectedCountry ? 1 : 0) +
    (selectedDateKey ? 1 : 0) +
    selectedTeamIds.length;

  const statusTabs = includePast
    ? [
        { id: "all", label: "All" },
        { id: "live", label: "Live" },
        { id: "upcoming", label: "Upcoming" },
        { id: "finished", label: "Results" },
      ]
    : [
        { id: "all", label: "All" },
        { id: "live", label: "Live" },
        { id: "upcoming", label: "Upcoming" },
      ];

  return (
    <ThemeProvider>
      <AppShell>
        <section style={{ padding: "32px 20px 0" }}>
          <div className="section-label" style={{ marginBottom: "6px" }}>Browse</div>
          <h1 className="font-display text-display" style={{ color: "var(--text-primary)", marginBottom: "6px" }}>
            Matches
          </h1>
          <p className="text-body" style={{ color: "var(--text-secondary)", marginBottom: "24px", maxWidth: "560px" }}>
            Upcoming fixtures first, with league and team filters. Past matches stay hidden unless you enable history mode.
          </p>

          {liveCount > 0 && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                borderRadius: "999px",
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                marginBottom: "16px",
              }}
            >
              <span className="live-dot" />
              <span className="text-sm font-body" style={{ color: "var(--live-pulse)", fontWeight: 600 }}>
                {liveCount} match{liveCount > 1 ? "es" : ""} live now
              </span>
            </div>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "18px" }}>
            <button
              className="btn-ghost"
              style={{ padding: "8px 14px" }}
              onClick={() => setShowFilterModal(true)}
            >
              <Filter size={14} />
              Filters
              {activeFilterCount > 0 && (
                <span className="badge" style={{ marginLeft: 4 }}>
                  {activeFilterCount}
                </span>
              )}
            </button>
            <button
              className="btn-ghost"
              style={{
                padding: "8px 14px",
                borderColor: includePast ? "var(--accent-primary)" : "var(--border)",
                color: includePast ? "var(--accent-primary)" : "var(--text-secondary)",
              }}
              onClick={() => setIncludePast((prev) => !prev)}
            >
              <History size={14} />
              {includePast ? "History On" : "Show History"}
            </button>
            <label
              className="btn-ghost"
              style={{
                padding: "8px 12px",
                borderColor: onlyWithHosting ? "var(--accent-primary)" : "var(--border)",
                color: onlyWithHosting ? "var(--accent-primary)" : "var(--text-secondary)",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={onlyWithHosting}
                onChange={(e) => setOnlyWithHosting(e.target.checked)}
                style={{ accentColor: "var(--accent-primary)" }}
              />
              Only with hosting venues
            </label>
          </div>
        </section>

        <section style={{ padding: "0 20px 12px" }}>
          <div className="toggle-track" style={{ display: "inline-flex" }}>
            {statusTabs.map((tab) => (
              <button
                key={tab.id}
                className={`toggle-option ${activeStatus === tab.id ? "active" : ""}`}
                onClick={() => setActiveStatus(tab.id as typeof activeStatus)}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                {tab.id === "live" && <CircleDot size={12} />}
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        <section style={{ paddingBottom: "8px" }}>
          <div className="carousel-track no-scrollbar" style={{ padding: "0 20px 8px" }}>
            <button
              className={`pill ${selectedLeagueId === null ? "active" : ""}`}
              onClick={() => setSelectedLeagueId(null)}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <Globe size={14} />
              <span>All Leagues</span>
            </button>
            {availableLeagues.map((league) => (
              <button
                key={league.id}
                className={`pill ${selectedLeagueId === league.id ? "active" : ""}`}
                onClick={() => setSelectedLeagueId((prev) => (prev === league.id ? null : league.id))}
              >
                {league.image ? <img src={league.image} alt={league.shortName} /> : <span style={{ fontSize: "1.4rem" }}>{league.logo}</span>}<span>{league.shortName}</span>
              </button>
            ))}
          </div>
        </section>

        <section style={{ paddingBottom: "8px" }}>
          <div className="carousel-track no-scrollbar" style={{ padding: "0 20px 8px" }}>
            <button
              className={`pill ${selectedCountry === null ? "active" : ""}`}
              onClick={() => setSelectedCountry(null)}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <Globe size={14} />
              <span>All Countries</span>
            </button>
            {availableCountries.map((country) => (
              <button
                key={country}
                className={`pill ${selectedCountry === country ? "active" : ""}`}
                onClick={() => setSelectedCountry((prev) => (prev === country ? null : country))}
              >
                <span>{country}</span>
              </button>
            ))}
          </div>
        </section>

        <section style={{ paddingBottom: "8px" }}>
          <div className="carousel-track no-scrollbar" style={{ padding: "0 20px 8px" }}>
            <button
              className={`pill ${selectedDateKey === null ? "active" : ""}`}
              onClick={() => setSelectedDateKey(null)}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <CalendarDays size={14} />
              <span>All Dates</span>
            </button>
            {availableDateFilters.map((item) => (
              <button
                key={item.value}
                className={`pill ${selectedDateKey === item.value ? "active" : ""}`}
                onClick={() => setSelectedDateKey((prev) => (prev === item.value ? null : item.value))}
              >
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section style={{ padding: "8px 20px 40px" }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}>
                <Timer size={44} style={{ color: "var(--text-muted)" }} />
              </div>
              <h3 className="font-display text-h2" style={{ color: "var(--text-primary)", marginBottom: "8px" }}>
                No Matches Found
              </h3>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Try changing filters or turning off "Only with hosting venues."
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
              {filtered.map((match, i) => {
                const home = getTeam(match.homeTeamId);
                const away = getTeam(match.awayTeamId);
                const league = getLeague(match.leagueId);
                if (!home || !away || !league) return null;
                const date = new Date(match.matchDateUTC);
                const kickoffLabel =
                  match.status === "IN_PLAY" ? "LIVE" :
                  match.status === "PAUSED" ? "HT" :
                  match.status === "FINISHED" ? "FT" :
                  date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " · " +
                  date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

                return (
                  <Link
                    href={`/matches/${match.id}`}
                    key={toMatchRowKey(match)}
                    style={{ textDecoration: "none", color: "inherit" }}
                    className={`animate-fade-up stagger-${Math.min(i + 1, 6)}`}
                  >
                    <MatchCard
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

        {showFilterModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-3xl rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-2xl text-[var(--text-primary)]">Filter Matches</h2>
                <button className="btn-ghost" onClick={() => setShowFilterModal(false)}>
                  <X size={14} />
                  Close
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">Leagues</p>
                  <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
                    {availableLeagues.map((league) => {
                      const selected = selectedLeagueId === league.id;
                      return (
                        <button
                          key={league.id}
                          className={`rounded-full border px-3 py-1 text-xs ${selected ? "border-[var(--accent-primary)] bg-[var(--accent-primary-dim)] text-[var(--accent-primary)]" : "border-[var(--border)] text-[var(--text-secondary)]"}`}
                          onClick={() => setSelectedLeagueId((prev) => (prev === league.id ? null : league.id))}
                        >
                          {league.shortName}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">Countries</p>
                  <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
                    {availableCountries.map((country) => {
                      const selected = selectedCountry === country;
                      return (
                        <button
                          key={country}
                          className={`rounded-full border px-3 py-1 text-xs ${selected ? "border-[var(--accent-primary)] bg-[var(--accent-primary-dim)] text-[var(--accent-primary)]" : "border-[var(--border)] text-[var(--text-secondary)]"}`}
                          onClick={() => setSelectedCountry((prev) => (prev === country ? null : country))}
                        >
                          {country}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">Dates</p>
                  <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
                    {availableDateFilters.map((item) => {
                      const selected = selectedDateKey === item.value;
                      return (
                        <button
                          key={item.value}
                          className={`rounded-full border px-3 py-1 text-xs ${selected ? "border-[var(--accent-primary)] bg-[var(--accent-primary-dim)] text-[var(--accent-primary)]" : "border-[var(--border)] text-[var(--text-secondary)]"}`}
                          onClick={() => setSelectedDateKey((prev) => (prev === item.value ? null : item.value))}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">Teams (from current dataset)</p>
                  <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
                    {availableTeams.map((team) => {
                      const selected = selectedTeamIds.includes(team.id);
                      return (
                        <button
                          key={team.id}
                          className={`rounded-full border px-3 py-1 text-xs ${selected ? "border-[var(--accent-primary)] bg-[var(--accent-primary-dim)] text-[var(--accent-primary)]" : "border-[var(--border)] text-[var(--text-secondary)]"}`}
                          onClick={() => {
                            setSelectedTeamIds((prev) =>
                              selected ? prev.filter((id) => id !== team.id) : [...prev, team.id],
                            );
                          }}
                        >
                          {team.shortName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <button
                  className="btn-ghost"
                  onClick={() => {
                    setSelectedLeagueId(null);
                    setSelectedCountry(null);
                    setSelectedDateKey(null);
                    setSelectedTeamIds([]);
                  }}
                >
                  Reset Filters
                </button>
                <button className="btn-primary" onClick={() => setShowFilterModal(false)}>
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        )}
      </AppShell>
    </ThemeProvider>
  );
}
