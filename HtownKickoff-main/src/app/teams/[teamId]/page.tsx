"use client";

import React from "react";
import { ThemeProvider, AppShell } from "../../../components/AppShell";
import Link from "next/link";
import { useData } from "../../../lib/data-provider";
import { use } from "react";
import { CircleDot, ShieldOff } from "lucide-react";

export default function TeamPage({ params }: { params: Promise<{ teamId: string }> }) {
    const { teamId } = use(params);
    const { teams: ALL_TEAMS, matches: MATCHES, getTeam, getLeague } = useData();
    const team = ALL_TEAMS.find((t: any) => t.id === teamId);

    if (!team) {
        return (
            <ThemeProvider>
                <AppShell>
                    <div style={{ padding: "80px 20px", textAlign: "center" }}>
                        <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
                            <ShieldOff size={56} style={{ color: "var(--text-muted)" }} />
                        </div>
                        <h1 className="font-display text-h1" style={{ color: "var(--text-primary)" }}>TEAM NOT FOUND</h1>
                        <p className="text-body" style={{ color: "var(--text-muted)", margin: "8px 0 24px" }}>This team doesn't exist in our system.</p>
                        <Link href="/matches" className="btn-primary" style={{ textDecoration: "none" }}>← Back to Matches</Link>
                    </div>
                </AppShell>
            </ThemeProvider>
        );
    }

    const league = getLeague(team.leagueId);
    const teamMatches = MATCHES.filter((m) => m.homeTeamId === team.id || m.awayTeamId === team.id);
    const wins = teamMatches.filter((m) => {
        if (m.status !== "FINISHED") return false;
        if (m.homeTeamId === team.id && (m.homeScore ?? 0) > (m.awayScore ?? 0)) return true;
        if (m.awayTeamId === team.id && (m.awayScore ?? 0) > (m.homeScore ?? 0)) return true;
        return false;
    }).length;
    const draws = teamMatches.filter((m) => m.status === "FINISHED" && m.homeScore === m.awayScore).length;
    const losses = teamMatches.filter((m) => m.status === "FINISHED").length - wins - draws;

    return (
        <ThemeProvider>
            <AppShell>
                {/* Team Hero */}
                <section style={{
                    padding: "48px 20px 36px",
                    background: `linear-gradient(135deg, ${team.color}22, var(--bg-primary))`,
                    textAlign: "center",
                    position: "relative",
                }}>
                    <div style={{ position: "absolute", top: "-30px", left: "50%", transform: "translateX(-50%)", width: "300px", height: "300px", borderRadius: "50%", background: team.color, opacity: 0.06, filter: "blur(80px)" }} />
                    <div style={{ position: "relative", zIndex: 2 }}>
                        <div style={{ fontSize: "5rem", marginBottom: "12px", filter: "drop-shadow(0 6px 20px rgba(0,0,0,0.3))" }} className="animate-fade-up">
                            {team.crest}
                        </div>
                        <h1 className="font-display text-display animate-fade-up stagger-1" style={{ color: "var(--text-primary)", marginBottom: "4px" }}>
                            {team.name.toUpperCase()}
                        </h1>
                        <div className="animate-fade-up stagger-2" style={{ display: "flex", justifyContent: "center", gap: "12px", alignItems: "center", marginBottom: "16px" }}>
                            {league && (
                                <span className="badge badge-accent" style={{ fontSize: "0.85rem", padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: "6px" }}>{league.image ? <img src={league.image} alt="" style={{ width: "22px", height: "22px", objectFit: "contain" }} /> : league.logo} {league.shortName}</span>
                            )}
                            <span className="text-xs" style={{ color: "var(--text-muted)" }}>{team.country}</span>
                        </div>

                        {/* Quick Stats */}
                        <div className="animate-fade-up stagger-3" style={{ display: "flex", justifyContent: "center", gap: "24px" }}>
                            {[
                                { label: "Matches", value: teamMatches.length.toString() },
                                { label: "W", value: wins.toString() },
                                { label: "D", value: draws.toString() },
                                { label: "L", value: losses.toString() },
                            ].map((s, i) => (
                                <div key={i} style={{ textAlign: "center" }}>
                                    <div className="font-mono" style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--accent-primary)" }}>{s.value}</div>
                                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>{s.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Team Matches */}
                <section style={{ padding: "24px 20px" }}>
                    <div className="section-label" style={{ marginBottom: "16px" }}>FIXTURES & RESULTS</div>
                    {teamMatches.length === 0 ? (
                        <div className="card-flat" style={{ padding: "40px 20px", textAlign: "center" }}>
                            <p className="text-sm" style={{ color: "var(--text-muted)" }}>No matches scheduled for this team yet.</p>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {teamMatches.map((m, i) => {
                                const home = getTeam(m.homeTeamId)!, away = getTeam(m.awayTeamId)!;
                                const lg = getLeague(m.leagueId);
                                const d = new Date(m.matchDateUTC);
                                const isLive = m.status === "IN_PLAY" || m.status === "PAUSED";
                                const isFinished = m.status === "FINISHED";
                                return (
                                    <Link
                                        key={m.id}
                                        href={`/matches/${m.id}`}
                                        className={`card-flat animate-fade-up stagger-${Math.min(i + 1, 6)}`}
                                        style={{ padding: "14px 16px", textDecoration: "none", color: "inherit", display: "flex", alignItems: "center", justifyContent: "space-between" }}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                            <span style={{ fontSize: "1.4rem" }}>{home.crest}</span>
                                            <div>
                                                <div className="text-sm font-body" style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                                                    {home.shortName} vs {away.shortName}
                                                </div>
                                                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                                                    {lg?.logo} {lg?.shortName} · {m.stage}
                                                </div>
                                            </div>
                                            <span style={{ fontSize: "1.4rem" }}>{away.crest}</span>
                                        </div>
                                        <div style={{ textAlign: "right" }}>
                                            {(isLive || isFinished) && m.homeScore !== null ? (
                                                <span className="font-mono text-sm" style={{ fontWeight: 700, color: isLive ? "var(--live-pulse)" : "var(--text-primary)" }}>
                                                    {m.homeScore} - {m.awayScore}
                                                </span>
                                            ) : (
                                                <span className="font-mono text-xs" style={{ color: "var(--accent-primary)" }}>
                                                    {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                                </span>
                                            )}
                                            {isLive && (
                                                <div className="text-xs" style={{ color: "var(--live-pulse)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "5px" }}>
                                                    <CircleDot size={11} />
                                                    LIVE
                                                </div>
                                            )}
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* Related Teams in Same League */}
                {league && (
                    <section style={{ padding: "0 20px 40px" }}>
                        <div className="section-label" style={{ marginBottom: "12px" }}>MORE TEAMS IN {league.shortName.toUpperCase()}</div>
                        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                            {ALL_TEAMS.filter((t) => t.leagueId === team.leagueId && t.id !== team.id).slice(0, 8).map((t) => (
                                <Link
                                    key={t.id}
                                    href={`/teams/${t.id}`}
                                    className="card-flat"
                                    style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: "8px", textDecoration: "none", color: "inherit" }}
                                >
                                    <span style={{ fontSize: "1.3rem" }}>{t.crest}</span>
                                    <span className="text-sm font-body" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{t.shortName}</span>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}
            </AppShell>
        </ThemeProvider>
    );
}
