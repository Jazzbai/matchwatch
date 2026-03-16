"use client";

import React, { useState } from "react";
import { List, Map, Navigation } from "lucide-react";
import { VenueCard, VenueCardProps } from "./VenueCard";

/* ═══════════════════════════════════════════════════
   MAP / LIST TOGGLE VIEW
   Interactive toggle between a map view (mock) and
   a scrollable venue card list. Used on Match Detail
   and Browse Venues pages.
   ═══════════════════════════════════════════════════ */

interface MapListToggleProps {
    venues: VenueCardProps[];
    onVenueClick?: (index: number) => void;
    onBookNow?: (index: number) => void;
}

function MockMapView({ venues }: { venues: VenueCardProps[] }) {
    return (
        <div
            className="map-container animate-fade-in"
            style={{
                height: "400px",
                background: "var(--secondary)",
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            {/* Grid pattern simulating map */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    background: `
            linear-gradient(var(--border) 1px, transparent 1px),
            linear-gradient(90deg, var(--border) 1px, transparent 1px)
          `,
                    backgroundSize: "50px 50px",
                    opacity: 0.4,
                }}
            />

            {/* Simulated Houston roads */}
            <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
                <div style={{
                    position: "absolute", top: "45%", left: 0, right: 0,
                    height: "3px", background: "var(--muted-foreground)", opacity: 0.2,
                    transform: "rotate(-5deg)"
                }} />
                <div style={{
                    position: "absolute", top: 0, bottom: 0, left: "35%",
                    width: "3px", background: "var(--muted-foreground)", opacity: 0.2,
                    transform: "rotate(3deg)"
                }} />
                <div style={{
                    position: "absolute", top: "20%", left: "10%", right: "30%",
                    height: "2px", background: "var(--muted-foreground)", opacity: 0.15,
                    transform: "rotate(15deg)"
                }} />
                <div style={{
                    position: "absolute", top: 0, bottom: 0, left: "65%",
                    width: "2px", background: "var(--muted-foreground)", opacity: 0.15,
                    transform: "rotate(-8deg)"
                }} />
            </div>

            {/* Venue Pins */}
            {venues.map((v, i) => {
                const positions = [
                    { top: "25%", left: "30%" },
                    { top: "40%", left: "55%" },
                    { top: "60%", left: "25%" },
                    { top: "35%", left: "72%" },
                    { top: "70%", left: "60%" },
                    { top: "20%", left: "50%" },
                ];
                const pos = positions[i % positions.length];
                return (
                    <div
                        key={i}
                        className="animate-scale-in"
                        style={{
                            position: "absolute",
                            ...pos,
                            animationDelay: `${i * 0.08}s`,
                            zIndex: 5,
                            cursor: "pointer",
                        }}
                        title={v.name}
                    >
                        {/* Pin */}
                        <div
                            style={{
                                width: "40px",
                                height: "40px",
                                borderRadius: "50% 50% 50% 0",
                                transform: "rotate(-45deg)",
                                background: v.isFeatured
                                    ? "var(--accent-hot)"
                                    : "var(--primary)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                boxShadow: `0 3px 12px ${v.isFeatured
                                        ? "rgba(251,191,36,0.3)"
                                        : "rgba(34,197,94,0.3)"
                                    }`,
                                border: "2px solid var(--card)",
                                transition: "transform 0.2s ease",
                            }}
                        >
                            <span
                                style={{
                                    transform: "rotate(45deg)",
                                    fontSize: "0.85rem",
                                    fontWeight: 700,
                                    color: "var(--primary-foreground)",
                                }}
                            >
                                {i + 1}
                            </span>
                        </div>
                        {/* Label */}
                        <div
                            className="text-xs font-body"
                            style={{
                                position: "absolute",
                                top: "calc(100% + 4px)",
                                left: "50%",
                                transform: "translateX(-50%)",
                                whiteSpace: "nowrap",
                                background: "var(--card)",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                border: "1px solid var(--border)",
                                color: "var(--foreground)",
                                fontWeight: 600,
                                fontSize: "0.6rem",
                            }}
                        >
                            {v.name.length > 14 ? v.name.slice(0, 14) + "…" : v.name}
                        </div>
                    </div>
                );
            })}

            {/* User Location Dot */}
            <div
                style={{
                    position: "absolute",
                    top: "48%",
                    left: "45%",
                    zIndex: 10,
                }}
            >
                <div
                    style={{
                        width: "14px",
                        height: "14px",
                        borderRadius: "50%",
                        background: "var(--accent-secondary)",
                        border: "3px solid var(--card)",
                        boxShadow: "0 0 0 4px rgba(59,130,246,0.3)",
                    }}
                />
            </div>

            {/* Map Controls */}
            <div
                style={{
                    position: "absolute",
                    bottom: "16px",
                    right: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    zIndex: 10,
                }}
            >
                <button
                    className="btn-ghost"
                    style={{
                        width: "36px",
                        height: "36px",
                        padding: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1rem",
                    }}
                >
                    +
                </button>
                <button
                    className="btn-ghost"
                    style={{
                        width: "36px",
                        height: "36px",
                        padding: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1rem",
                    }}
                >
                    −
                </button>
            </div>

            {/* Mapbox Placeholder Text */}
            <div
                style={{
                    position: "absolute",
                    bottom: "16px",
                    left: "16px",
                    zIndex: 10,
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                }}
            >
                <span
                    className="text-xs"
                    style={{ color: "var(--muted-foreground)", opacity: 0.5, display: "inline-flex", alignItems: "center", gap: "4px" }}
                >
                    <Navigation size={12} />
                    Mapbox GL JS
                </span>
            </div>
        </div>
    );
}

export function MapListToggle({
    venues,
    onVenueClick,
    onBookNow,
}: MapListToggleProps) {
    const [view, setView] = useState<"list" | "map">("list");

    return (
        <div>
            {/* Sticky Toggle Bar */}
            <div
                className="glass-panel"
                style={{
                    position: "sticky",
                    top: "56px",
                    zIndex: 30,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 20px",
                    borderBottom: "1px solid var(--border)",
                }}
            >
                <span
                    className="text-sm font-body"
                    style={{ color: "var(--muted-foreground)", fontWeight: 500 }}
                >
                    {venues.length} venues nearby
                </span>
                <div className="toggle-track">
                    <button
                        className={`toggle-option ${view === "list" ? "active" : ""}`}
                        onClick={() => setView("list")}
                        style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                        <List size={14} />
                        List
                    </button>
                    <button
                        className={`toggle-option ${view === "map" ? "active" : ""}`}
                        onClick={() => setView("map")}
                        style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                        <Map size={14} />
                        Map
                    </button>
                </div>
            </div>

            {/* View Content */}
            {view === "map" ? (
                <div style={{ padding: "16px 20px" }}>
                    <MockMapView venues={venues} />
                </div>
            ) : (
                <div
                    style={{
                        padding: "16px 20px",
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                        gap: "16px",
                    }}
                >
                    {venues.map((v, i) => (
                        <div
                            key={i}
                            className="animate-fade-up"
                            style={{ animationDelay: `${i * 0.06}s` }}
                        >
                            <VenueCard
                                {...v}
                                onClick={() => onVenueClick?.(i)}
                                onBookNow={() => onBookNow?.(i)}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
