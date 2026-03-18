"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Search, Star, MessageSquare, Type, Coins, CircleDollarSign, Gem, Crown } from "lucide-react";
import { AppShell } from "../../components/AppShell";
import { VenueCard } from "../../components/VenueCard";
import { AMENITY_LABELS } from "../../lib/data";
import { useData, type PriceRange } from "../../lib/data-provider";

const PRICE_OPTIONS: { value: PriceRange | "all"; label: string; icon: React.ReactNode }[] = [
    { value: "all", label: "All", icon: null },
    { value: "BUDGET", label: "Budget", icon: <Coins size={14} /> },
    { value: "MID", label: "Mid-range", icon: <CircleDollarSign size={14} /> },
    { value: "UPSCALE", label: "Upscale", icon: <Gem size={14} /> },
    { value: "LUXURY", label: "Luxury", icon: <Crown size={14} /> },
];

export default function VenuesPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [activePrice, setActivePrice] = useState<PriceRange | "all">("all");
    const [activeCity, setActiveCity] = useState("all");
    const [activeAmenity, setActiveAmenity] = useState("all");
    const [sortBy, setSortBy] = useState<"rating" | "reviews" | "name">("rating");
    const { venues: VENUES } = useData();

    const availableCities = Array.from(
        new Set(
            VENUES
                .filter((v) => v.isActive && v.city)
                .map((v) => v.city.trim())
                .filter(Boolean),
        ),
    ).sort((a, b) => a.localeCompare(b));

    const filtered = VENUES
        .filter((v) => {
            const searchOK =
                searchQuery === "" ||
                v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                v.cuisineTags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
                v.addressLine1.toLowerCase().includes(searchQuery.toLowerCase()) ||
                v.city.toLowerCase().includes(searchQuery.toLowerCase());
            const priceOK = activePrice === "all" || v.priceRange === activePrice;
            const cityOK = activeCity === "all" || v.city === activeCity;
            const amenityOK = activeAmenity === "all" || v.amenities.includes(activeAmenity);
            return searchOK && priceOK && cityOK && amenityOK && v.isActive;
        })
        .sort((a, b) => {
            if (sortBy === "rating") return b.rating - a.rating;
            if (sortBy === "reviews") return b.reviewCount - a.reviewCount;
            return a.name.localeCompare(b.name);
        });





    return (
        <AppShell>
            {/* Page Header */}
            <section style={{ maxWidth: 1400, margin: "0 auto", padding: "0 24px 20px" }}>
                <div style={{ marginBottom: 6, fontSize: 12, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--primary)" }}>EXPLORE</div>
                <h1 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: 36, fontWeight: 900, color: "var(--foreground)", marginBottom: 8, letterSpacing: "-0.02em" }}>Venues</h1>
                <p style={{ fontSize: 15, color: "var(--muted-foreground)", maxWidth: 480, lineHeight: 1.6, fontWeight: 500 }}>
                    Discover Houston&apos;s best bars, lounges, and restaurants hosting major match watch parties and daily sports viewing.
                </p>
            </section>

            {/* Unified Filter Panel */}
            <section style={{ maxWidth: 1400, margin: "0 auto", padding: "0 24px 20px" }}>
                <div style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
                    
                    {/* Search inside the panel */}
                    <div style={{ position: "relative", maxWidth: 420 }}>
                        <input
                            type="text"
                            placeholder="Search venues, cuisine, or neighborhoods..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: "100%", padding: "12px 16px 12px 40px", borderRadius: 12,
                                border: "1px solid var(--border)", backgroundColor: "var(--secondary)", color: "var(--foreground)",
                                fontFamily: "inherit", fontSize: 13, fontWeight: 500, outline: "none", transition: "all 0.2s ease",
                            }}
                        />
                        <Search style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "var(--muted-foreground)" }} />
                    </div>

                    {/* Divider */}
                    <div style={{ height: 1, backgroundColor: "var(--border)" }} />

                    {/* City Filter Row */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em", flexShrink: 0, minWidth: 60 }}>City</span>
                        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }} className="no-scrollbar">
                            <button
                                onClick={() => setActiveCity("all")}
                                style={{
                                    display: "inline-flex", alignItems: "center", gap: 6,
                                    padding: "7px 14px", borderRadius: 99,
                                    fontSize: 12, fontWeight: 700, cursor: "pointer",
                                    fontFamily: "inherit", whiteSpace: "nowrap",
                                    border: activeCity === "all" ? "1px solid var(--primary)" : "1px solid var(--border)",
                                    backgroundColor: activeCity === "all" ? "color-mix(in oklch, var(--primary) 12%, transparent)" : "transparent",
                                    color: activeCity === "all" ? "var(--primary)" : "var(--muted-foreground)",
                                    transition: "all 0.2s",
                                }}
                            >
                                All
                            </button>
                            {availableCities.map((city) => {
                                const sel = activeCity === city;
                                return (
                                    <button
                                        key={city}
                                        onClick={() => setActiveCity(city)}
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
                                        {city}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Price Filter Row */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em", flexShrink: 0, minWidth: 60 }}>Price</span>
                        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }} className="no-scrollbar">
                            {PRICE_OPTIONS.map((p) => {
                                const sel = activePrice === p.value;
                                return (
                                    <button
                                        key={p.value}
                                        onClick={() => setActivePrice(p.value)}
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
                                        {p.icon} {p.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Amenity Filter Row */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em", flexShrink: 0, minWidth: 60 }}>Amenity</span>
                        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }} className="no-scrollbar">
                            <button
                                onClick={() => setActiveAmenity("all")}
                                style={{
                                    display: "inline-flex", alignItems: "center", gap: 6,
                                    padding: "7px 14px", borderRadius: 99,
                                    fontSize: 12, fontWeight: 700, cursor: "pointer",
                                    fontFamily: "inherit", whiteSpace: "nowrap",
                                    border: activeAmenity === "all" ? "1px solid var(--primary)" : "1px solid var(--border)",
                                    backgroundColor: activeAmenity === "all" ? "color-mix(in oklch, var(--primary) 12%, transparent)" : "transparent",
                                    color: activeAmenity === "all" ? "var(--primary)" : "var(--muted-foreground)",
                                    transition: "all 0.2s",
                                }}
                            >
                                All
                            </button>
                            {Object.entries(AMENITY_LABELS).map(([key, { label }]) => {
                                const sel = activeAmenity === key;
                                return (
                                    <button
                                        key={key}
                                        onClick={() => setActiveAmenity(key)}
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
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Divider */}
                    <div style={{ height: 1, backgroundColor: "var(--border)" }} />

                    {/* Sort + Count Row */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 13, color: "var(--muted-foreground)", fontWeight: 600 }}>
                            {filtered.length} venue{filtered.length !== 1 ? "s" : ""} found
                        </span>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em", marginRight: 4 }}>Sort</span>
                            {(["rating", "reviews", "name"] as const).map((s) => {
                                const sel = sortBy === s;
                                return (
                                    <button
                                        key={s}
                                        onClick={() => setSortBy(s)}
                                        style={{
                                            display: "inline-flex", alignItems: "center", gap: 4,
                                            padding: "6px 12px", borderRadius: 8,
                                            fontSize: 12, fontWeight: 700, cursor: "pointer",
                                            fontFamily: "inherit",
                                            border: sel ? "1px solid var(--primary)" : "1px solid var(--border)",
                                            backgroundColor: sel ? "var(--primary)" : "transparent",
                                            color: sel ? "var(--primary-foreground)" : "var(--muted-foreground)",
                                            transition: "all 0.2s",
                                        }}
                                    >
                                        {s === "rating" ? <><Star size={12} /> Rating</> : s === "reviews" ? <><MessageSquare size={12} /> Reviews</> : <><Type size={12} /> Name</>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </section>

            {/* Venue Grid */}
            <section style={{ maxWidth: 1400, margin: "0 auto", padding: "20px 24px 48px" }}>
                {filtered.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "80px 20px", borderRadius: 24, border: "1px dashed var(--border)", backgroundColor: "color-mix(in oklch, var(--secondary) 30%, transparent)" }}>
                        <h3 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: 20, fontWeight: 800, color: "var(--foreground)", marginBottom: 8 }}>NO VENUES FOUND</h3>
                        <p style={{ fontSize: 14, color: "var(--muted-foreground)" }}>Try adjusting your search or filters.</p>
                    </div>
                ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
                        {filtered.map((v) => (
                            <div key={v.id}>
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
            <section style={{ padding: "48px 24px", backgroundColor: "var(--secondary)", borderTop: "1px solid var(--border)" }}>
                <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--primary)", marginBottom: 8 }}>OWN A VENUE?</div>
                    <h2 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: 28, fontWeight: 900, color: "var(--foreground)", marginBottom: 12 }}>LIST YOUR VENUE FOR FREE</h2>
                    <p style={{ fontSize: 15, color: "var(--muted-foreground)", marginBottom: 24, lineHeight: 1.6 }}>
                        Join {VENUES.filter(v => v.isActive).length}+ venues on MatchWatch. Get discovered by thousands of fans looking for the perfect watch-party spot.
                    </p>
                    <Link
                        href="/for-venues"
                        style={{
                            display: "inline-flex", alignItems: "center", gap: 8,
                            padding: "14px 32px", borderRadius: 99, fontWeight: 700, fontSize: 14,
                            backgroundColor: "var(--primary)", color: "var(--primary-foreground)",
                            textDecoration: "none", transition: "all 0.2s",
                        }}
                    >
                        Register Your Venue
                    </Link>
                </div>
            </section>
        </AppShell>
    );
}
