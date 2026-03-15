"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Search, Star, MessageSquare, Type } from "lucide-react";
import { ThemeProvider, AppShell } from "../../components/AppShell";
import { VenueCard } from "../../components/VenueCard";
import { AMENITY_LABELS } from "../../lib/data";
import { useData, type PriceRange } from "../../lib/data-provider";

export default function VenuesPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [activePrice, setActivePrice] = useState<PriceRange | "all">("all");
    const [activeAmenity, setActiveAmenity] = useState("all");
    const [sortBy, setSortBy] = useState<"rating" | "reviews" | "name">("rating");
    const { venues: VENUES } = useData();

    const filtered = VENUES
        .filter((v) => {
            const searchOK =
                searchQuery === "" ||
                v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                v.cuisineTags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
                v.addressLine1.toLowerCase().includes(searchQuery.toLowerCase());
            const priceOK = activePrice === "all" || v.priceRange === activePrice;
            const amenityOK = activeAmenity === "all" || v.amenities.includes(activeAmenity);
            return searchOK && priceOK && amenityOK && v.isActive;
        })
        .sort((a, b) => {
            if (sortBy === "rating") return b.rating - a.rating;
            if (sortBy === "reviews") return b.reviewCount - a.reviewCount;
            return a.name.localeCompare(b.name);
        });

    return (
        <ThemeProvider>
            <AppShell>
                {/* Page Header */}
                <section style={{ padding: "32px 20px 0" }}>
                    <div className="section-label" style={{ marginBottom: "6px" }}>EXPLORE</div>
                    <h1 className="font-display text-display" style={{ color: "var(--text-primary)", marginBottom: "6px" }}>VENUES</h1>
                    <p className="text-body" style={{ color: "var(--text-secondary)", marginBottom: "20px", maxWidth: "480px" }}>
                        Discover Houston&apos;s best bars, lounges, and restaurants hosting major match watch parties and daily sports viewing.
                    </p>

                    {/* Search Bar */}
                    <div style={{ position: "relative", maxWidth: "480px", marginBottom: "20px" }}>
                        <input
                            type="text"
                            placeholder="Search venues, cuisine, or neighborhoods..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: "100%", padding: "14px 18px 14px 44px", borderRadius: "14px",
                                border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)",
                                fontFamily: "'DM Sans', sans-serif", fontSize: "0.9rem", outline: "none", transition: "all 0.2s ease",
                            }}
                            onFocus={(e) => { e.target.style.borderColor = "var(--accent-primary)"; e.target.style.boxShadow = "0 0 0 3px var(--accent-primary-dim)"; }}
                            onBlur={(e) => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
                        />
                        <Search style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", width: "18px", height: "18px", opacity: 0.5 }} />
                    </div>
                </section>

                {/* Filter Bar */}
                <section style={{ padding: "0 20px 8px" }}>
                    {/* Price filter pills */}
                    <div style={{ marginBottom: "10px" }}>
                        <span className="text-xs" style={{ color: "var(--text-muted)", marginRight: "8px", fontWeight: 600 }}>PRICE:</span>
                        <div style={{ display: "inline-flex", gap: "6px", flexWrap: "wrap" }}>
                            {(["all", "BUDGET", "MID", "UPSCALE", "LUXURY"] as const).map((p) => (
                                <button
                                    key={p}
                                    className={`pill ${activePrice === p ? "active" : ""}`}
                                    onClick={() => setActivePrice(p)}
                                    style={{ padding: "6px 14px" }}
                                >
                                    {p === "all" ? "All" : p === "BUDGET" ? "$" : p === "MID" ? "$$" : p === "UPSCALE" ? "$$$" : "$$$$"}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Amenity filter pills */}
                    <div className="carousel-track no-scrollbar" style={{ padding: "0 0 8px" }}>
                        <button
                            className={`pill ${activeAmenity === "all" ? "active" : ""}`}
                            onClick={() => setActiveAmenity("all")}
                            style={{ padding: "6px 14px" }}
                        >
                            All Amenities
                        </button>
                        {Object.entries(AMENITY_LABELS).map(([key, { label }]) => (
                            <button
                                key={key}
                                className={`pill ${activeAmenity === key ? "active" : ""}`}
                                onClick={() => setActiveAmenity(key)}
                                style={{ padding: "6px 14px" }}
                            >
                                <span>{label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Sort + Count */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "8px" }}>
                        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{filtered.length} venue{filtered.length !== 1 ? "s" : ""} found</span>
                        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                            <span className="text-xs" style={{ color: "var(--text-muted)", marginRight: "4px" }}>Sort:</span>
                            {(["rating", "reviews", "name"] as const).map((s) => (
                                <button
                                    key={s}
                                    className="text-xs"
                                    onClick={() => setSortBy(s)}
                                    style={{
                                        padding: "4px 10px", borderRadius: "6px", border: "1px solid var(--border)", cursor: "pointer",
                                        background: sortBy === s ? "var(--accent-primary)" : "transparent",
                                        color: sortBy === s ? "var(--text-inverse)" : "var(--text-secondary)",
                                        fontFamily: "'DM Sans', sans-serif", fontWeight: 500, transition: "all 0.2s",
                                    }}
                                >
                                    {s === "rating" ? (
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                            <Star size={12} /> Rating
                                        </span>
                                    ) : s === "reviews" ? (
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                            <MessageSquare size={12} /> Reviews
                                        </span>
                                    ) : (
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                            <Type size={12} /> Name
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Venue Grid */}
                <section style={{ padding: "16px 20px 40px" }}>
                    {filtered.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "60px 20px" }}>
                            <h3 className="font-display text-h2" style={{ color: "var(--text-primary)", marginBottom: "8px" }}>NO VENUES FOUND</h3>
                            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Try adjusting your search or filters.</p>
                        </div>
                    ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
                            {filtered.map((v, i) => (
                                <div key={v.id} className={`animate-fade-up stagger-${Math.min(i + 1, 6)}`}>
                                    <Link href={`/venues/${v.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
                                        <VenueCard
                                            name={v.name}
                                            coverImage={v.coverImageUrl || "/venue-hero.webp"}
                                            city={v.city}
                                            address={v.addressLine1}
                                            rating={v.rating}
                                            reviewCount={v.reviewCount}
                                            amenities={v.amenities}
                                            cuisineTags={v.cuisineTags}
                                            priceRange={v.priceRange}
                                            isVerified={v.isVerified}
                                            isFeatured={v.isFeatured}
                                            spotsRemaining={null}
                                            nextEvent={`${v.upcomingEventsCount} upcoming events`}
                                        />
                                    </Link>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* CTA Banner */}
                <section style={{ padding: "36px 20px", background: "var(--bg-surface)", borderTop: "1px solid var(--border)" }}>
                    <div style={{ maxWidth: "600px", margin: "0 auto", textAlign: "center" }}>
                        <div className="section-label" style={{ marginBottom: "8px" }}>OWN A VENUE?</div>
                        <h2 className="font-display text-h1" style={{ color: "var(--text-primary)", marginBottom: "8px" }}>LIST YOUR VENUE FOR FREE</h2>
                        <p className="text-body" style={{ color: "var(--text-secondary)", marginBottom: "20px" }}>
                            Join {VENUES.filter(v => v.isActive).length}+ venues on MatchWatch. Get discovered by thousands of fans looking for the perfect watch-party spot.
                        </p>
                        <Link href="/for-venues" className="btn-primary" style={{ padding: "14px 32px", textDecoration: "none" }}>Register Your Venue</Link>
                    </div>
                </section>
            </AppShell>
        </ThemeProvider>
    );
}
