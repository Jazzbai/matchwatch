"use client";

import React, { useRef, useState } from "react";
import { Flame, MapPin } from "lucide-react";

export interface MatchCardProps {
    eventFormat?: "HEAD_TO_HEAD" | "SINGLE_EVENT";
    eventTitle?: string;
    eventSubtitle?: string;
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
    eventFormat = "HEAD_TO_HEAD",
    eventTitle,
    eventSubtitle,
    homeTeam,
    awayTeam,
    homeCrest,
    awayCrest,
    homeImage,
    awayImage,
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
}: MatchCardProps) {
    const isLive = status === "LIVE";
    const isFinished = status === "FINISHED";
    const isSingleEvent = eventFormat === "SINGLE_EVENT";

    const cardRef = useRef<HTMLDivElement>(null);
    const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });
    const [isHovered, setIsHovered] = useState(false);
    const [isPressed, setIsPressed] = useState(false);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = cardRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setGlare({ x, y, opacity: 0.18 });
    };

    const handleMouseLeave = () => {
        setGlare({ x: 50, y: 50, opacity: 0 });
        setIsHovered(false);
        setIsPressed(false);
    };
    const cardTransform = isPressed ? "translateY(-2px)" : isHovered ? "translateY(-4px)" : "translateY(0)";
    const cardShadow = isHovered
        ? "0 12px 40px rgba(0,0,0,0.15), 0 0 0 1px color-mix(in oklch, var(--primary) 30%, transparent)"
        : "none";

    return (
        <div
            ref={cardRef}
            onClick={onClick}
            onMouseMove={handleMouseMove}
            role="button"
            tabIndex={0}
            aria-label={isSingleEvent ? eventTitle || league : `${homeTeam} vs ${awayTeam}`}
            style={{
                position: "relative",
                overflow: "hidden",
                borderRadius: 20,
                border: "1px solid var(--border)",
                backgroundColor: "var(--card)",
                cursor: "pointer",
                transition: "transform 0.3s, box-shadow 0.3s",
                minWidth: 280,
                transform: cardTransform,
                boxShadow: cardShadow,
                ...style,
            }}
            onMouseEnter={() => {
                setIsHovered(true);
            }}
            onMouseDown={() => {
                setIsPressed(true);
            }}
            onMouseUp={() => {
                setIsPressed(false);
            }}
            onMouseLeave={() => {
                handleMouseLeave();
            }}
            onBlur={() => {
                setIsHovered(false);
                setIsPressed(false);
            }}
            onFocus={() => {}}
        >
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 20,
                    pointerEvents: "none",
                    zIndex: 10,
                    background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,${glare.opacity}), transparent 60%)`,
                    transition: "background 0.15s ease",
                }}
            />

            <div
                style={{
                    height: 3,
                    width: "100%",
                    background: isLive
                        ? "#f59e0b"
                        : "linear-gradient(90deg, var(--primary), oklch(0.75 0.18 145))",
                }}
            />

            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 16px 0",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {leagueImage ? (
                        <img src={leagueImage} alt="" style={{ width: 20, height: 20, objectFit: "contain" }} />
                    ) : (
                        <span style={{ fontSize: 18 }}>{leagueLogo}</span>
                    )}
                    <span
                        style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "var(--muted-foreground)",
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                        }}
                    >
                        {league}
                    </span>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {isLive && (
                        <span
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                padding: "3px 8px",
                                borderRadius: 6,
                                backgroundColor: "rgba(245,158,11,0.12)",
                                color: "#f59e0b",
                                fontSize: 10,
                                fontWeight: 800,
                                letterSpacing: "0.1em",
                                textTransform: "uppercase",
                            }}
                        >
                            <span
                                style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: "50%",
                                    backgroundColor: "#f59e0b",
                                    animation: "pulse 2s infinite",
                                }}
                            />
                            LIVE
                        </span>
                    )}
                    {isFinished && (
                        <span
                            style={{
                                display: "inline-flex",
                                padding: "3px 8px",
                                borderRadius: 6,
                                backgroundColor: "var(--secondary)",
                                color: "var(--secondary-foreground)",
                                border: "1px solid var(--border)",
                                fontSize: 10,
                                fontWeight: 800,
                                letterSpacing: "0.1em",
                                textTransform: "uppercase",
                            }}
                        >
                            FT
                        </span>
                    )}
                    {isHot && (
                        <span
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3,
                                padding: "3px 8px",
                                borderRadius: 6,
                                backgroundColor: "rgba(239,68,68,0.12)",
                                color: "#ef4444",
                                fontSize: 10,
                                fontWeight: 800,
                                letterSpacing: "0.1em",
                                textTransform: "uppercase",
                            }}
                        >
                            <Flame size={11} strokeWidth={2.5} />
                            HOT
                        </span>
                    )}
                </div>
            </div>

            {matchDay && (
                <div
                    style={{
                        padding: "4px 16px 0",
                        fontSize: 11,
                        fontFamily: "monospace",
                        color: "var(--muted-foreground)",
                        fontWeight: 500,
                    }}
                >
                    {matchDay}
                </div>
            )}

            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 16,
                    padding: "24px 16px 20px",
                }}
            >
                {isSingleEvent ? (
                    <div
                        style={{
                            display: "grid",
                            gap: 10,
                            justifyItems: "center",
                            textAlign: "center",
                            minHeight: 116,
                        }}
                    >
                        <div
                            style={{
                                fontSize: 24,
                                fontWeight: 900,
                                color: "var(--foreground)",
                                lineHeight: 1.1,
                            }}
                        >
                            {eventTitle || league}
                        </div>
                        {eventSubtitle ? (
                            <div
                                style={{
                                    fontSize: 12,
                                    color: "var(--muted-foreground)",
                                    fontWeight: 700,
                                    letterSpacing: "0.08em",
                                    textTransform: "uppercase",
                                }}
                            >
                                {eventSubtitle}
                            </div>
                        ) : null}
                        <span
                            style={{
                                fontSize: 11,
                                fontFamily: "monospace",
                                fontWeight: 700,
                                color: "var(--primary)",
                                backgroundColor:
                                    "color-mix(in oklch, var(--primary) 10%, transparent)",
                                padding: "4px 10px",
                                borderRadius: 8,
                                marginTop: 2,
                            }}
                        >
                            {kickoff}
                        </span>
                    </div>
                ) : (
                    <>
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 10,
                                flex: 1,
                            }}
                        >
                            <div
                                style={{
                                    width: 56,
                                    height: 56,
                                    borderRadius: 16,
                                    backgroundColor:
                                        "color-mix(in oklch, var(--secondary) 50%, transparent)",
                                    border: "1px solid var(--border)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 28,
                                    transition: "transform 0.3s",
                                }}
                            >
                                {homeImage ? (
                                    <img
                                        src={homeImage}
                                        alt={homeTeam}
                                        style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: 12,
                                            objectFit: "contain",
                                        }}
                                    />
                                ) : (
                                    homeCrest
                                )}
                            </div>
                            <span
                                style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: "var(--foreground)",
                                    textAlign: "center",
                                    maxWidth: 90,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {homeTeam}
                            </span>
                        </div>

                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 4,
                                minWidth: 70,
                            }}
                        >
                            {isLive || isFinished ? (
                                <div
                                    style={{
                                        fontFamily: "monospace",
                                        fontSize: 28,
                                        fontWeight: 800,
                                        letterSpacing: "0.05em",
                                        color: isLive ? "#f59e0b" : "var(--foreground)",
                                        textShadow: isLive
                                            ? "0 0 12px rgba(245,158,11,0.4)"
                                            : "none",
                                    }}
                                >
                                    {homeScore} - {awayScore}
                                </div>
                            ) : (
                                <div
                                    style={{
                                        fontWeight: 900,
                                        fontSize: 16,
                                        color:
                                            "color-mix(in oklch, var(--muted-foreground) 50%, transparent)",
                                        letterSpacing: "0.2em",
                                        fontStyle: "italic",
                                    }}
                                >
                                    VS
                                </div>
                            )}
                            {!isLive && !isFinished && (
                                <span
                                    style={{
                                        fontSize: 11,
                                        fontFamily: "monospace",
                                        fontWeight: 700,
                                        color: "var(--primary)",
                                        backgroundColor:
                                            "color-mix(in oklch, var(--primary) 10%, transparent)",
                                        padding: "4px 10px",
                                        borderRadius: 8,
                                        marginTop: 2,
                                    }}
                                >
                                    {kickoff}
                                </span>
                            )}
                        </div>

                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 10,
                                flex: 1,
                            }}
                        >
                            <div
                                style={{
                                    width: 56,
                                    height: 56,
                                    borderRadius: 16,
                                    backgroundColor:
                                        "color-mix(in oklch, var(--secondary) 50%, transparent)",
                                    border: "1px solid var(--border)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 28,
                                    transition: "transform 0.3s",
                                }}
                            >
                                {awayImage ? (
                                    <img
                                        src={awayImage}
                                        alt={awayTeam}
                                        style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: 12,
                                            objectFit: "contain",
                                        }}
                                    />
                                ) : (
                                    awayCrest
                                )}
                            </div>
                            <span
                                style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: "var(--foreground)",
                                    textAlign: "center",
                                    maxWidth: 90,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {awayTeam}
                            </span>
                        </div>
                    </>
                )}
            </div>

            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    borderTop: "1px solid var(--border)",
                    backgroundColor: "color-mix(in oklch, var(--secondary) 30%, transparent)",
                    transition: "background-color 0.2s",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <MapPin size={13} style={{ color: "var(--muted-foreground)" }} />
                    <span
                        style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: "var(--muted-foreground)",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                        }}
                    >
                        <strong style={{ color: "var(--primary)", fontWeight: 800, fontSize: 12 }}>
                            {venueCount}
                        </strong>{" "}
                        {venueCount === 1 ? "venue" : "venues"} hosting
                    </span>
                </div>
                <span
                    style={{
                        fontSize: 11,
                        color: "var(--primary)",
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                    }}
                >
                    View
                </span>
            </div>
        </div>
    );
}
