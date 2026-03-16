"use client";

import React from "react";
import { BadgeCheck, MapPin, Sparkles, Star } from "lucide-react";

/* ═══════════════════════════════════════════════════
   VENUE CARD — Inline-styled card for venue listings.
   Used in: browse venues grid, match detail venue
   list, featured venues carousel, and followed venues.
   ═══════════════════════════════════════════════════ */

export interface VenueCardProps {
    name: string;
    coverImage: string;
    city: string;
    address: string;
    rating: number;
    reviewCount: number;
    amenities: string[];
    cuisineTags: string[];
    priceRange: "BUDGET" | "MID" | "UPSCALE" | "LUXURY";
    distance?: string;
    spotsRemaining?: number | null;
    isVerified?: boolean;
    isFeatured?: boolean;
    nextEvent?: string;
    onClick?: () => void;
    onBookNow?: () => void;
}

const PRICE_LABELS: Record<string, string> = {
    BUDGET: "$",
    MID: "$$",
    UPSCALE: "$$$",
    LUXURY: "$$$$",
};

function StarRating({ rating, count }: { rating: number; count: number }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ display: "flex", gap: 1 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                        key={star}
                        size={12}
                        strokeWidth={2.5}
                        style={{
                            color: star <= Math.round(rating) ? "#fbbf24" : "var(--muted-foreground)",
                            fill: star <= Math.round(rating) ? "#fbbf24" : "transparent",
                            opacity: star <= Math.round(rating) ? 1 : 0.3,
                        }}
                    />
                ))}
            </div>
            <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "var(--foreground)" }}>
                {rating.toFixed(1)}
            </span>
            <span style={{ fontSize: 10, color: "var(--muted-foreground)", fontWeight: 500 }}>
                ({count})
            </span>
        </div>
    );
}

export function VenueCard({
    name,
    coverImage,
    city,
    address,
    rating,
    reviewCount,
    amenities,
    cuisineTags,
    priceRange,
    distance,
    spotsRemaining,
    isVerified,
    isFeatured,
    nextEvent,
    onClick,
    onBookNow,
}: VenueCardProps) {
    return (
        <div
            onClick={onClick}
            role="button"
            tabIndex={0}
            aria-label={`${name} in ${city}`}
            style={{
                width: "100%",
                maxWidth: 380,
                borderRadius: 20,
                border: "1px solid var(--border)",
                backgroundColor: "var(--card)",
                overflow: "hidden",
                cursor: "pointer",
                transition: "transform 0.3s, box-shadow 0.3s",
                display: "flex",
                flexDirection: "column",
                height: "100%",
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow = "0 12px 40px rgba(0,0,0,0.12), 0 0 0 1px color-mix(in oklch, var(--primary) 25%, transparent)";
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
            }}
        >
            {/* Cover Image */}
            <div style={{ position: "relative", height: 180, width: "100%", overflow: "hidden" }}>
                <img
                    src={coverImage}
                    alt={name}
                    style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.5s" }}
                    onError={(e) => { (e.target as HTMLImageElement).src = "/venue-hero.webp"; }}
                />
                {/* Gradient overlay */}
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, var(--card) 0%, rgba(0,0,0,0.05) 50%, transparent 100%)", zIndex: 1 }} />

                {/* Badges overlay */}
                <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 6, zIndex: 2 }}>
                    {isFeatured && (
                        <span style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            padding: "4px 10px", borderRadius: 99,
                            backgroundColor: "rgba(245,158,11,0.2)", color: "#f59e0b",
                            border: "1px solid rgba(245,158,11,0.4)",
                            backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
                            fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase",
                        }}>
                            <Sparkles size={11} />
                            Featured
                        </span>
                    )}
                    {isVerified && (
                        <span style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            padding: "4px 10px", borderRadius: 99,
                            backgroundColor: "rgba(16,185,129,0.2)", color: "#10b981",
                            border: "1px solid rgba(16,185,129,0.4)",
                            backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
                            fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase",
                        }}>
                            <BadgeCheck size={11} />
                            Verified
                        </span>
                    )}
                </div>

                {/* Distance badge */}
                {distance && (
                    <div style={{ position: "absolute", top: 12, right: 12, zIndex: 2 }}>
                        <span style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            padding: "4px 10px", borderRadius: 99,
                            backgroundColor: "rgba(0,0,0,0.6)", color: "#fff",
                            backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
                            fontSize: 10, fontWeight: 700,
                        }}>
                            <MapPin size={11} />
                            {distance}
                        </span>
                    </div>
                )}

                {/* Price range */}
                <div style={{ position: "absolute", bottom: 12, right: 12, zIndex: 2 }}>
                    <span style={{
                        fontFamily: "monospace", fontSize: 12, fontWeight: 800,
                        color: "var(--primary)",
                        backgroundColor: "color-mix(in oklch, var(--card) 85%, transparent)",
                        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
                        padding: "4px 10px", borderRadius: 8,
                        border: "1px solid var(--border)",
                    }}>
                        {PRICE_LABELS[priceRange]}
                    </span>
                </div>
            </div>

            {/* Content */}
            <div style={{ padding: 16, display: "flex", flexDirection: "column", flex: 1 }}>
                {/* Title row */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4, gap: 8 }}>
                    <h3 style={{
                        fontSize: 15, fontWeight: 700, color: "var(--foreground)",
                        lineHeight: 1.3,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        transition: "color 0.2s",
                    }}>
                        {name}
                    </h3>
                    <div style={{ flexShrink: 0 }}>
                        <StarRating rating={rating} count={reviewCount} />
                    </div>
                </div>

                {/* Address */}
                <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {address}, {city}
                </p>

                {/* Amenity chips */}
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10, marginTop: "auto" }}>
                    {amenities.slice(0, 4).map((a) => (
                        <span
                            key={a}
                            title={a.replace(/_/g, " ")}
                            style={{
                                fontSize: 10, fontWeight: 600,
                                color: "var(--secondary-foreground)",
                                backgroundColor: "var(--secondary)",
                                padding: "3px 8px", borderRadius: 99,
                                textTransform: "capitalize",
                            }}
                        >
                            {a.replace(/_/g, " ").toLowerCase()}
                        </span>
                    ))}
                    {amenities.length > 4 && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: "var(--muted-foreground)", backgroundColor: "color-mix(in oklch, var(--secondary) 50%, transparent)", padding: "3px 8px", borderRadius: 99 }}>
                            +{amenities.length - 4}
                        </span>
                    )}
                </div>

                {/* Cuisine tags */}
                <div style={{ display: "flex", gap: 5, overflow: "hidden", paddingBottom: 2 }}>
                    {cuisineTags.slice(0, 3).map((tag) => (
                        <span
                            key={tag}
                            style={{
                                fontSize: 10, fontWeight: 500,
                                color: "var(--muted-foreground)",
                                border: "1px solid var(--border)",
                                backgroundColor: "var(--background)",
                                padding: "3px 8px", borderRadius: 6,
                                whiteSpace: "nowrap",
                            }}
                        >
                            {tag}
                        </span>
                    ))}
                </div>
            </div>

            {/* Footer */}
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 16px",
                borderTop: "1px solid var(--border)",
                marginTop: "auto",
            }}>
                {spotsRemaining != null ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{
                            width: 8, height: 8, borderRadius: "50%",
                            backgroundColor: spotsRemaining > 10 ? "var(--primary)" : spotsRemaining > 0 ? "#f59e0b" : "#ef4444",
                        }} />
                        <span style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                            {spotsRemaining > 0 ? (
                                <><strong style={{ color: "var(--foreground)" }}>{spotsRemaining}</strong> spots left</>
                            ) : "Full — Join waitlist"}
                        </span>
                    </div>
                ) : nextEvent ? (
                    <span style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 600 }}>
                        Next: {nextEvent}
                    </span>
                ) : (
                    <span />
                )}

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onBookNow?.();
                    }}
                    style={{
                        padding: "8px 16px", borderRadius: 10, border: "none",
                        backgroundColor: "var(--primary)", color: "var(--primary-foreground)",
                        fontSize: 12, fontWeight: 700, cursor: "pointer",
                        fontFamily: "inherit",
                        transition: "all 0.2s",
                        boxShadow: "0 2px 8px color-mix(in oklch, var(--primary) 30%, transparent)",
                    }}
                >
                    Book Now
                </button>
            </div>
        </div>
    );
}
