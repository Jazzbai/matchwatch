"use client";

import React from "react";
import { BadgeCheck, MapPin, Sparkles, Star } from "lucide-react";

/* ═══════════════════════════════════════════════════
   VENUE CARD — Reusable card for venue listings.
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
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <div style={{ display: "flex", gap: "1px" }}>
                {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                        key={star}
                        size={11}
                        strokeWidth={2}
                        style={{
                            color: star <= Math.round(rating) ? "var(--accent-primary)" : "var(--text-muted)",
                            fill: star <= Math.round(rating) ? "var(--accent-primary)" : "transparent",
                        }}
                    />
                ))}
            </div>
            <span
                className="font-mono text-xs"
                style={{ color: "var(--accent-hot)", fontWeight: 600 }}
            >
                {rating.toFixed(1)}
            </span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
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
        <article
            className="card"
            onClick={onClick}
            role="button"
            tabIndex={0}
            aria-label={`${name} in ${city}`}
            style={{
                width: "100%",
                maxWidth: "360px",
                cursor: "pointer",
                overflow: "hidden",
                position: "relative",
            }}
        >
            {/* Cover Image */}
            <div
                style={{
                    position: "relative",
                    height: "160px",
                    background: `url('${coverImage}') center/cover no-repeat`,
                    backgroundColor: "var(--bg-elevated)",
                }}
            >
                {/* Gradient overlay */}
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        background:
                            "linear-gradient(180deg, transparent 40%, var(--bg-card) 100%)",
                    }}
                />

                {/* Badges overlay */}
                <div
                    style={{
                        position: "absolute",
                        top: "10px",
                        left: "10px",
                        display: "flex",
                        gap: "6px",
                    }}
                >
                    {isFeatured && (
                        <span
                            className="badge"
                            style={{
                                background: "rgba(251, 191, 36, 0.2)",
                                backdropFilter: "blur(8px)",
                                color: "var(--accent-hot)",
                                border: "1px solid var(--accent-hot)",
                            }}
                        >
                            <Sparkles size={12} style={{ marginRight: "4px", display: "inline" }} />
                            Featured
                        </span>
                    )}
                    {isVerified && (
                        <span
                            className="badge"
                            style={{
                                background: "rgba(34, 197, 94, 0.2)",
                                backdropFilter: "blur(8px)",
                                color: "#22C55E",
                                border: "1px solid #22C55E",
                            }}
                        >
                            <BadgeCheck size={12} style={{ marginRight: "4px", display: "inline" }} />
                            Verified
                        </span>
                    )}
                </div>

                {/* Distance badge */}
                {distance && (
                    <div
                        style={{
                            position: "absolute",
                            top: "10px",
                            right: "10px",
                        }}
                    >
                        <span
                            className="badge"
                            style={{
                                background: "rgba(10, 10, 11, 0.7)",
                                backdropFilter: "blur(8px)",
                                color: "#FAFAF9",
                                border: "1px solid rgba(255,255,255,0.1)",
                            }}
                        >
                            <MapPin size={12} style={{ marginRight: "4px", display: "inline" }} />
                            {distance}
                        </span>
                    </div>
                )}

                {/* Price range in corner */}
                <div
                    style={{
                        position: "absolute",
                        bottom: "10px",
                        right: "10px",
                    }}
                >
                    <span
                        className="font-mono text-xs"
                        style={{
                            color: "var(--accent-primary)",
                            fontWeight: 600,
                            background: "rgba(10, 10, 11, 0.6)",
                            padding: "3px 8px",
                            borderRadius: "6px",
                            backdropFilter: "blur(4px)",
                        }}
                    >
                        {PRICE_LABELS[priceRange]}
                    </span>
                </div>
            </div>

            {/* Content */}
            <div style={{ padding: "14px 16px" }}>
                {/* Title row */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        marginBottom: "6px",
                    }}
                >
                    <h3
                        className="font-body"
                        style={{
                            fontSize: "1rem",
                            fontWeight: 700,
                            color: "var(--text-primary)",
                            lineHeight: 1.2,
                            maxWidth: "200px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {name}
                    </h3>
                    <StarRating rating={rating} count={reviewCount} />
                </div>

                {/* Address */}
                <p
                    className="text-xs"
                    style={{
                        color: "var(--text-muted)",
                        marginBottom: "10px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {address}, {city}
                </p>

                {/* Amenity chips */}
                <div
                    style={{
                        display: "flex",
                        gap: "6px",
                        flexWrap: "wrap",
                        marginBottom: "10px",
                    }}
                >
                    {amenities.slice(0, 5).map((a) => (
                        <span
                            key={a}
                            className="text-xs"
                            title={a.replace(/_/g, " ")}
                            style={{
                                padding: "3px 8px",
                                borderRadius: "999px",
                                border: "1px solid var(--border)",
                                color: "var(--text-secondary)",
                                background: "var(--bg-elevated)",
                                textTransform: "capitalize",
                            }}
                        >
                            {a.replace(/_/g, " ").toLowerCase()}
                        </span>
                    ))}
                    {amenities.length > 5 && (
                        <span
                            className="text-xs"
                            style={{
                                padding: "3px 8px",
                                borderRadius: "999px",
                                border: "1px solid var(--border)",
                                color: "var(--text-muted)",
                                background: "var(--bg-elevated)",
                            }}
                        >
                            +{amenities.length - 5}
                        </span>
                    )}
                </div>

                {/* Cuisine tags */}
                <div
                    className="no-scrollbar"
                    style={{
                        display: "flex",
                        gap: "5px",
                        overflowX: "auto",
                        marginBottom: "12px",
                    }}
                >
                    {cuisineTags.slice(0, 3).map((tag) => (
                        <span
                            key={tag}
                            className="text-xs"
                            style={{
                                padding: "3px 8px",
                                borderRadius: "6px",
                                background: "var(--bg-elevated)",
                                color: "var(--text-secondary)",
                                border: "1px solid var(--border)",
                                whiteSpace: "nowrap",
                                fontWeight: 500,
                            }}
                        >
                            {tag}
                        </span>
                    ))}
                </div>

                {/* Footer: Spots + Book buttons */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingTop: "10px",
                        borderTop: "1px solid var(--border)",
                    }}
                >
                    {spotsRemaining != null ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <div
                                style={{
                                    width: "8px",
                                    height: "8px",
                                    borderRadius: "50%",
                                    background:
                                        spotsRemaining > 10
                                            ? "var(--accent-primary)"
                                            : spotsRemaining > 0
                                                ? "var(--accent-hot)"
                                                : "var(--accent-danger)",
                                }}
                            />
                            <span className="text-xs" style={{ color: "var(--text-secondary)", fontWeight: 500 }}>
                                {spotsRemaining > 0
                                    ? `${spotsRemaining} spots left`
                                    : "Full — Join waitlist"}
                            </span>
                        </div>
                    ) : nextEvent ? (
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                            Next: {nextEvent}
                        </span>
                    ) : (
                        <span />
                    )}
                    <button
                        className="btn-primary"
                        onClick={(e) => {
                            e.stopPropagation();
                            onBookNow?.();
                        }}
                        style={{
                            padding: "8px 18px",
                            fontSize: "0.75rem",
                            borderRadius: "8px",
                        }}
                    >
                        Book Now
                    </button>
                </div>
            </div>
        </article>
    );
}
