"use client";

import React from "react";
import { Flame, MapPin } from "lucide-react";

/* ═══════════════════════════════════════════════════
   MATCH CARD — Horizontal carousel card for upcoming
   matches. Shows team crests, kickoff time, league,
   and number of hosting venues.
   ═══════════════════════════════════════════════════ */

export interface MatchCardProps {
    homeTeam: string;
    awayTeam: string;
    homeCrest: string;
    awayCrest: string;
    homeImage?: string;
    awayImage?: string;
    matchImage?: string;
    kickoff: string;
    league: string;
    leagueLogo: string;
    leagueImage?: string;
    venueCount: number;
    status: "SCHEDULED" | "LIVE" | "FINISHED";
    homeScore?: number;
    awayScore?: number;
    matchDay?: string;
    isHot?: boolean;
    onClick?: () => void;
    style?: React.CSSProperties;
    className?: string;
}

export function MatchCard({
    homeTeam,
    awayTeam,
    homeCrest,
    awayCrest,
    homeImage,
    awayImage,
    matchImage,
    kickoff,
    league,
    leagueLogo,
    leagueImage,
    venueCount,
    status,
    homeScore,
    awayScore,
    matchDay,
    isHot,
    onClick,
    style,
    className = "",
}: MatchCardProps) {
    const isLive = status === "LIVE";
    const isFinished = status === "FINISHED";

    return (
        <article
            className={`card ${className}`}
            onClick={onClick}
            role="button"
            tabIndex={0}
            aria-label={`${homeTeam} vs ${awayTeam}`}
            style={{
                width: "100%",
                padding: "0",
                cursor: "pointer",
                overflow: "hidden",
                position: "relative",
                ...style,
            }}
        >
            {/* Top Accent Line */}
            <div
                style={{
                    height: "3px",
                    background: isLive
                        ? "var(--live-pulse)"
                        : "var(--gradient-accent)",
                    transition: "all 0.3s ease",
                }}
            />

            {/* Header: League + Status Badges */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px 0",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                    }}
                >
                    {leagueImage ? <img src={leagueImage} alt="" style={{ width: "32px", height: "32px", objectFit: "contain" }} /> : <span style={{ fontSize: "1.6rem" }}>{leagueLogo}</span>}
                    <span
                        className="text-sm font-body"
                        style={{ color: "var(--text-muted)", fontWeight: 600 }}
                    >
                        {league}
                    </span>
                </div>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    {isLive && (
                        <span className="badge badge-live">
                            <span className="live-dot" />
                            LIVE
                        </span>
                    )}
                    {isFinished && (
                        <span
                            className="badge"
                            style={{
                                background: "var(--bg-elevated)",
                                color: "var(--text-muted)",
                                border: "1px solid var(--border)",
                            }}
                        >
                            FT
                        </span>
                    )}
                    {isHot && (
                        <span className="badge badge-hot" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <Flame size={11} />
                            HOT
                        </span>
                    )}
                </div>
            </div>

            {matchDay && (
                <div
                    className="text-xs font-mono"
                    style={{
                        padding: "4px 16px 0",
                        color: "var(--text-muted)",
                    }}
                >
                    {matchDay}
                </div>
            )}

            {/* Teams + Score */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "16px",
                    padding: "16px 16px 12px",
                }}
            >
                {/* Home Team */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "8px",
                        flex: 1,
                    }}
                >
                    <div
                        style={{
                            width: "52px",
                            height: "52px",
                            borderRadius: "14px",
                            background: "var(--bg-elevated)",
                            border: "1px solid var(--border)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "1.6rem",
                            transition: "all 0.2s ease",
                        }}
                    >
                        {homeImage ? (
                            <img src={homeImage} alt={homeTeam} style={{ width: "36px", height: "36px", borderRadius: "8px", objectFit: "contain" }} />
                        ) : (
                            homeCrest
                        )}
                    </div>
                    <span
                        className="text-xs font-body"
                        style={{
                            fontWeight: 600,
                            color: "var(--text-primary)",
                            textAlign: "center",
                            maxWidth: "80px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {homeTeam}
                    </span>
                </div>

                {/* Score / VS */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "2px",
                        minWidth: "60px",
                    }}
                >
                    {isLive || isFinished ? (
                        <div
                            className="font-mono"
                            style={{
                                fontSize: "1.6rem",
                                fontWeight: 600,
                                color: isLive
                                    ? "var(--live-pulse)"
                                    : "var(--text-primary)",
                                letterSpacing: "0.05em",
                            }}
                        >
                            {homeScore} – {awayScore}
                        </div>
                    ) : (
                        <div
                            className="font-display"
                            style={{
                                fontSize: "1.1rem",
                                color: "var(--text-muted)",
                                letterSpacing: "0.1em",
                            }}
                        >
                            VS
                        </div>
                    )}
                    {!isLive && !isFinished && (
                        <span
                            className="text-xs font-mono"
                            style={{
                                color: "var(--accent-primary)",
                                fontWeight: 600,
                            }}
                        >
                            {kickoff}
                        </span>
                    )}
                </div>

                {/* Away Team */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "8px",
                        flex: 1,
                    }}
                >
                    <div
                        style={{
                            width: "52px",
                            height: "52px",
                            borderRadius: "14px",
                            background: "var(--bg-elevated)",
                            border: "1px solid var(--border)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "1.6rem",
                            transition: "all 0.2s ease",
                        }}
                    >
                        {awayImage ? (
                            <img src={awayImage} alt={awayTeam} style={{ width: "36px", height: "36px", borderRadius: "8px", objectFit: "contain" }} />
                        ) : (
                            awayCrest
                        )}
                    </div>
                    <span
                        className="text-xs font-body"
                        style={{
                            fontWeight: 600,
                            color: "var(--text-primary)",
                            textAlign: "center",
                            maxWidth: "80px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {awayTeam}
                    </span>
                </div>
            </div>

            {/* Footer: Venue Count */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 16px",
                    borderTop: "1px solid var(--border)",
                    background: "var(--bg-surface)",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                    }}
                >
                    <MapPin size={12} />
                    <span
                        className="text-xs font-body"
                        style={{ color: "var(--text-secondary)", fontWeight: 500 }}
                    >
                        <strong style={{ color: "var(--accent-primary)" }}>
                            {venueCount}
                        </strong>{" "}
                        {venueCount === 1 ? "venue" : "venues"} hosting
                    </span>
                </div>
                <span
                    style={{
                        fontSize: "0.75rem",
                        color: "var(--accent-primary)",
                        fontWeight: 600,
                    }}
                >
                    View →
                </span>
            </div>
        </article>
    );
}
