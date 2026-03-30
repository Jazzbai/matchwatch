"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LocateFixed, MapPin, Search, X } from "lucide-react";
import { AppShell } from "../../components/AppShell";
import { MapListToggle } from "../../components/MapListToggle";
import { PaginationControls } from "../../components/PaginationControls";
import { AMENITY_LABELS } from "../../lib/data";
import { useData, type PriceRange, type Venue } from "../../lib/data-provider";
import { paginateItems, parsePageParam } from "../../lib/pagination";

const PRICE_OPTIONS: Array<{ value: PriceRange; label: string }> = [
    { value: "BUDGET", label: "Budget" },
    { value: "MID", label: "Mid-range" },
    { value: "UPSCALE", label: "Upscale" },
    { value: "LUXURY", label: "Luxury" },
];
const PAGE_SIZE_OPTIONS = [12, 24, 48] as const;
const LOCATION_PROMPT_STORAGE_KEY = "venues-location-prompt-v1";

type SortOption = "rating" | "reviews" | "name";
type BrowserPermissionState = "idle" | "requesting" | "dismissed" | "applied" | "unsupported" | "error";

function parsePageSizeParam(value: string | null | undefined) {
    if (!value) return 12;
    const parsed = Number.parseInt(value, 10);
    return PAGE_SIZE_OPTIONS.includes(parsed as (typeof PAGE_SIZE_OPTIONS)[number]) ? parsed : 12;
}

function toggleSelection(values: string[], value: string) {
    return values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value];
}

function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
    const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
}

function nearestVenueByCoordinates(venues: Venue[], latitude: number, longitude: number) {
    const candidates = venues.filter((venue) => Number.isFinite(venue.lat) && Number.isFinite(venue.lng) && venue.isActive);
    if (candidates.length === 0) return null;

    return candidates.reduce((closest, venue) => {
        const venueDistance = haversineDistanceKm(latitude, longitude, venue.lat, venue.lng);
        if (!closest) return { venue, distance: venueDistance };
        return venueDistance < closest.distance ? { venue, distance: venueDistance } : closest;
    }, null as { venue: Venue; distance: number } | null)?.venue ?? null;
}

function FilterCheckbox({
    checked,
    label,
    onChange,
    disabled = false,
}: {
    checked: boolean;
    label: string;
    onChange: () => void;
    disabled?: boolean;
}) {
    return (
        <label
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                width: "100%",
                borderRadius: 14,
                border: checked ? "1px solid var(--primary)" : "1px solid var(--border)",
                backgroundColor: checked ? "color-mix(in oklch, var(--primary) 12%, transparent)" : "var(--secondary)",
                color: checked ? "var(--foreground)" : "var(--muted-foreground)",
                fontSize: 13,
                fontWeight: 600,
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.55 : 1,
                minHeight: 44,
                userSelect: "none",
            }}
        >
            <input
                type="checkbox"
                checked={checked}
                onChange={onChange}
                disabled={disabled}
                style={{ width: 16, height: 16, accentColor: "var(--primary)", flexShrink: 0 }}
            />
            <span>{label}</span>
        </label>
    );
}

function FilterSection({
    title,
    hint,
    onClear,
    isMobile,
    children,
}: {
    title: string;
    hint?: string;
    onClear?: () => void;
    isMobile: boolean;
    children: React.ReactNode;
}) {
    return (
        <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "grid", gap: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{title}</span>
                    {hint ? <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{hint}</span> : null}
                </div>
                {onClear ? (
                    <button
                        type="button"
                        onClick={onClear}
                        style={{ border: "1px solid var(--border)", background: "transparent", color: "var(--muted-foreground)", borderRadius: 999, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                    >
                        Clear
                    </button>
                ) : null}
            </div>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(180px, 1fr))" }}>{children}</div>
        </div>
    );
}

function VenuesPageContent() {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { venues: VENUES } = useData();

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedPrices, setSelectedPrices] = useState<PriceRange[]>([]);
    const [selectedStates, setSelectedStates] = useState<string[]>([]);
    const [selectedCities, setSelectedCities] = useState<string[]>([]);
    const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
    const [sortBy, setSortBy] = useState<SortOption>("rating");
    const [locationPromptVisible, setLocationPromptVisible] = useState(false);
    const [locationPermissionState, setLocationPermissionState] = useState<BrowserPermissionState>("idle");
    const [locationMessage, setLocationMessage] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(false);

    const requestedPage = parsePageParam(searchParams.get("page"));
    const pageSize = parsePageSizeParam(searchParams.get("pageSize"));
    const syncArchivePageRef = useRef<(nextPage: number, nextPageSize?: number) => void>(() => {});
    const hasInitializedPageReset = useRef(false);

    const activeVenues = useMemo(() => VENUES.filter((venue) => venue.isActive), [VENUES]);
    const stateOptions = useMemo(
        () => Array.from(new Set(activeVenues.map((venue) => venue.state.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
        [activeVenues],
    );
    const cityOptions = useMemo(() => {
        const narrowedVenues = selectedStates.length > 0
            ? activeVenues.filter((venue) => selectedStates.includes(venue.state.trim()))
            : activeVenues;
        return Array.from(new Set(narrowedVenues.map((venue) => venue.city.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    }, [activeVenues, selectedStates]);
    const amenityOptions = useMemo(
        () => Object.entries(AMENITY_LABELS)
            .filter(([key]) => activeVenues.some((venue) => venue.amenities.includes(key)))
            .sort((a, b) => a[1].label.localeCompare(b[1].label)),
        [activeVenues],
    );

    syncArchivePageRef.current = (nextPage: number, nextPageSize?: number) => {
        const params = new URLSearchParams(searchParams.toString());
        const resolvedPageSize = nextPageSize ?? pageSize;
        if (nextPage <= 1) {
            params.delete("page");
        } else {
            params.set("page", String(nextPage));
        }
        if (resolvedPageSize === 12) {
            params.delete("pageSize");
        } else {
            params.set("pageSize", String(resolvedPageSize));
        }
        const nextQuery = params.toString();
        router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    };

    useEffect(() => {
        setSelectedCities((current) => current.filter((city) => cityOptions.includes(city)));
    }, [cityOptions]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const media = window.matchMedia("(max-width: 767px)");
        const update = () => setIsMobile(media.matches);
        update();
        media.addEventListener("change", update);
        return () => media.removeEventListener("change", update);
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const storedPreference = window.localStorage.getItem(LOCATION_PROMPT_STORAGE_KEY);
        if (!storedPreference) {
            setLocationPromptVisible(true);
            return;
        }

        if (storedPreference === "dismissed") {
            setLocationPermissionState("dismissed");
        } else if (storedPreference === "applied") {
            setLocationPermissionState("applied");
        }
    }, []);

    const filtered = useMemo(() => activeVenues
        .filter((venue) => {
            const searchTerm = searchQuery.trim().toLowerCase();
            const searchOK = !searchTerm
                || venue.name.toLowerCase().includes(searchTerm)
                || venue.cuisineTags.some((tag) => tag.toLowerCase().includes(searchTerm))
                || venue.addressLine1.toLowerCase().includes(searchTerm)
                || venue.city.toLowerCase().includes(searchTerm)
                || venue.state.toLowerCase().includes(searchTerm);
            const priceOK = selectedPrices.length === 0 || selectedPrices.includes(venue.priceRange);
            const stateOK = selectedStates.length === 0 || selectedStates.includes(venue.state);
            const cityOK = selectedCities.length === 0 || selectedCities.includes(venue.city);
            const amenityOK = selectedAmenities.length === 0 || selectedAmenities.some((amenity) => venue.amenities.includes(amenity));
            return searchOK && priceOK && stateOK && cityOK && amenityOK;
        })
        .sort((a, b) => {
            if (sortBy === "rating") return b.rating - a.rating;
            if (sortBy === "reviews") return b.reviewCount - a.reviewCount;
            return a.name.localeCompare(b.name);
        }), [activeVenues, searchQuery, selectedPrices, selectedStates, selectedCities, selectedAmenities, sortBy]);

    const { currentPage, totalPages, pageItems: paginatedVenues } = useMemo(
        () => paginateItems(filtered, requestedPage, pageSize),
        [filtered, requestedPage, pageSize],
    );

    useEffect(() => {
        if (requestedPage !== currentPage) {
            syncArchivePageRef.current(currentPage);
        }
    }, [requestedPage, currentPage]);

    useEffect(() => {
        if (!hasInitializedPageReset.current) {
            hasInitializedPageReset.current = true;
            return;
        }

        syncArchivePageRef.current(1);
    }, [searchQuery, selectedPrices, selectedStates, selectedCities, selectedAmenities, sortBy]);

    const applyNearestVenueLocation = (venue: Venue) => {
        const nextState = venue.state.trim();
        const nextCity = venue.city.trim();

        setSelectedStates(nextState ? [nextState] : []);
        setSelectedCities(nextCity ? [nextCity] : []);
        setLocationPermissionState("applied");
        setLocationPromptVisible(false);
        setLocationMessage(nextCity
            ? `Showing venues in ${nextCity}${nextState ? `, ${nextState}` : ""}.`
            : "Showing venues closest to your current area.");

        if (typeof window !== "undefined") {
            window.localStorage.setItem(LOCATION_PROMPT_STORAGE_KEY, "applied");
        }
    };

    const requestUserLocation = () => {
        if (typeof window === "undefined") return;
        if (!("geolocation" in navigator)) {
            setLocationPermissionState("unsupported");
            setLocationMessage("Location is not supported in this browser.");
            setLocationPromptVisible(false);
            window.localStorage.setItem(LOCATION_PROMPT_STORAGE_KEY, "dismissed");
            return;
        }

        setLocationPermissionState("requesting");
        setLocationMessage(null);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const nearestVenue = nearestVenueByCoordinates(activeVenues, position.coords.latitude, position.coords.longitude);
                if (!nearestVenue) {
                    setLocationPermissionState("error");
                    setLocationMessage("No venue coordinates are available yet for location matching.");
                    return;
                }

                applyNearestVenueLocation(nearestVenue);
            },
            () => {
                setLocationPermissionState("error");
                setLocationMessage("We could not access your location. You can still filter manually.");
                setLocationPromptVisible(false);
                window.localStorage.setItem(LOCATION_PROMPT_STORAGE_KEY, "dismissed");
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
        );
    };

    const dismissLocationPrompt = () => {
        setLocationPermissionState("dismissed");
        setLocationPromptVisible(false);
        if (typeof window !== "undefined") {
            window.localStorage.setItem(LOCATION_PROMPT_STORAGE_KEY, "dismissed");
        }
    };

    const clearAllFilters = () => {
        setSearchQuery("");
        setSelectedPrices([]);
        setSelectedStates([]);
        setSelectedCities([]);
        setSelectedAmenities([]);
        setSortBy("rating");
        setLocationMessage(null);
    };

    const hasActiveFilters = searchQuery.trim().length > 0
        || selectedPrices.length > 0
        || selectedStates.length > 0
        || selectedCities.length > 0
        || selectedAmenities.length > 0;

    return (
        <AppShell>
            <section style={{ maxWidth: 1400, margin: "0 auto", padding: "0 24px 20px" }}>
                <div style={{ marginBottom: 6, fontSize: 12, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--primary)" }}>EXPLORE</div>
                <h1 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: 36, fontWeight: 900, color: "var(--foreground)", marginBottom: 8, letterSpacing: "-0.02em" }}>Venues</h1>
                <p style={{ fontSize: 15, color: "var(--muted-foreground)", maxWidth: 640, lineHeight: 1.6, fontWeight: 500 }}>
                    Discover bars, lounges, and restaurants hosting major match watch parties and daily sports viewing. Filters now support multi-select combinations, including state-first location browsing.
                </p>
            </section>

            <section style={{ maxWidth: 1400, margin: "0 auto", padding: "0 24px 20px" }}>
                <div style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, padding: isMobile ? "16px" : "20px 24px", display: "grid", gap: 20 }}>
                    {locationPromptVisible ? (
                        <div style={{ display: "grid", gap: 12, padding: 16, borderRadius: 16, border: "1px solid color-mix(in oklch, var(--primary) 30%, var(--border))", backgroundColor: "color-mix(in oklch, var(--primary) 10%, transparent)" }}>
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                                <div style={{ display: "grid", gap: 6 }}>
                                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 800, color: "var(--primary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                                        <LocateFixed size={14} />
                                        Use Your Location
                                    </div>
                                    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--foreground)" }}>
                                        Start with venues in the city nearest to your current location. We use your device location once to preset the State and City filters.
                                    </p>
                                </div>
                                <button type="button" onClick={dismissLocationPrompt} style={{ border: "none", background: "transparent", color: "var(--muted-foreground)", cursor: "pointer", padding: 4 }} aria-label="Dismiss location prompt">
                                    <X size={16} />
                                </button>
                            </div>
                            <div style={{ display: "grid", gap: 10, gridTemplateColumns: isMobile ? "1fr" : "repeat(2, max-content)" }}>
                                <button
                                    type="button"
                                    onClick={requestUserLocation}
                                    disabled={locationPermissionState === "requesting"}
                                    style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 999, border: "none", backgroundColor: "var(--primary)", color: "var(--primary-foreground)", fontSize: 13, fontWeight: 700, cursor: locationPermissionState === "requesting" ? "wait" : "pointer", justifyContent: "center", width: "100%" }}
                                >
                                    <LocateFixed size={16} />
                                    {locationPermissionState === "requesting" ? "Checking location..." : "Use my location"}
                                </button>
                                <button type="button" onClick={dismissLocationPrompt} style={{ padding: "10px 16px", borderRadius: 999, border: "1px solid var(--border)", background: "transparent", color: "var(--muted-foreground)", fontSize: 13, fontWeight: 700, cursor: "pointer", width: "100%" }}>
                                    Not now
                                </button>
                            </div>
                        </div>
                    ) : null}

                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, flexDirection: isMobile ? "column" : "row" }}>
                        <div style={{ position: "relative", flex: "1 1 320px", maxWidth: isMobile ? "100%" : 520, width: "100%" }}>
                            <input
                                type="text"
                                placeholder="Search venues, cuisine, neighborhoods, city, or state..."
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                style={{ width: "100%", padding: "12px 16px 12px 40px", borderRadius: 12, border: "1px solid var(--border)", backgroundColor: "var(--secondary)", color: "var(--foreground)", fontFamily: "inherit", fontSize: 13, fontWeight: 500, outline: "none" }}
                            />
                            <Search style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "var(--muted-foreground)" }} />
                        </div>

                        <div style={{ display: "grid", gap: 10, width: isMobile ? "100%" : "auto", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, max-content)" }}>
                            <button type="button" onClick={requestUserLocation} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 999, border: "1px solid var(--border)", backgroundColor: "transparent", color: "var(--foreground)", fontSize: 13, fontWeight: 700, cursor: "pointer", justifyContent: "center", width: "100%" }}>
                                <MapPin size={15} />
                                Use my location
                            </button>
                            {hasActiveFilters ? (
                                <button type="button" onClick={clearAllFilters} style={{ padding: "10px 14px", borderRadius: 999, border: "1px solid var(--border)", backgroundColor: "transparent", color: "var(--muted-foreground)", fontSize: 13, fontWeight: 700, cursor: "pointer", width: "100%" }}>
                                    Clear all filters
                                </button>
                            ) : null}
                        </div>
                    </div>

                    {locationMessage ? <div style={{ fontSize: 13, fontWeight: 600, color: "var(--primary)" }}>{locationMessage}</div> : null}

                    <div style={{ height: 1, backgroundColor: "var(--border)" }} />

                    <div style={{ display: "grid", gap: 20 }}>
                        <FilterSection title="Price" hint="Choose one or more budget levels. Leave empty to include all prices." onClear={selectedPrices.length > 0 ? () => setSelectedPrices([]) : undefined} isMobile={isMobile}>
                            {PRICE_OPTIONS.map((option) => (
                                <FilterCheckbox
                                    key={option.value}
                                    checked={selectedPrices.includes(option.value)}
                                    label={option.label}
                                    onChange={() => setSelectedPrices((current) => toggleSelection(current, option.value) as PriceRange[])}
                                />
                            ))}
                        </FilterSection>

                        <div style={{ display: "grid", gap: 20 }}>
                            <div style={{ display: "grid", gap: 4 }}>
                                <span style={{ fontSize: 11, fontWeight: 800, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Location</span>
                                <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Filter by state first, then narrow to one or more cities inside those states.</span>
                            </div>

                            <FilterSection title="State" hint="Select one or more states." onClear={selectedStates.length > 0 ? () => setSelectedStates([]) : undefined} isMobile={isMobile}>
                                {stateOptions.map((state) => (
                                    <FilterCheckbox
                                        key={state}
                                        checked={selectedStates.includes(state)}
                                        label={state}
                                        onChange={() => setSelectedStates((current) => toggleSelection(current, state))}
                                    />
                                ))}
                            </FilterSection>

                            <FilterSection title="City" hint={selectedStates.length > 0 ? "Cities are limited to the selected states." : "Select one or more cities across all active venues."} onClear={selectedCities.length > 0 ? () => setSelectedCities([]) : undefined} isMobile={isMobile}>
                                {cityOptions.length > 0 ? cityOptions.map((city) => (
                                    <FilterCheckbox
                                        key={city}
                                        checked={selectedCities.includes(city)}
                                        label={city}
                                        onChange={() => setSelectedCities((current) => toggleSelection(current, city))}
                                    />
                                )) : <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>No cities match the selected states.</span>}
                            </FilterSection>
                        </div>

                        <FilterSection title="Amenities" hint="Choose any combination of amenities. A venue matches if it has at least one selected amenity." onClear={selectedAmenities.length > 0 ? () => setSelectedAmenities([]) : undefined} isMobile={isMobile}>
                            {amenityOptions.map(([key, value]) => (
                                <FilterCheckbox
                                    key={key}
                                    checked={selectedAmenities.includes(key)}
                                    label={value.label}
                                    onChange={() => setSelectedAmenities((current) => toggleSelection(current, key))}
                                />
                            ))}
                        </FilterSection>
                    </div>

                    <div style={{ height: 1, backgroundColor: "var(--border)" }} />

                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, flexDirection: isMobile ? "column" : "row" }}>
                        <span style={{ fontSize: 13, color: "var(--muted-foreground)", fontWeight: 600 }}>
                            Showing {paginatedVenues.length} on this page, {filtered.length} venue{filtered.length !== 1 ? "s" : ""} total
                        </span>

                        <div style={{ display: "grid", gap: 12, width: isMobile ? "100%" : "auto", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, max-content)" }}>
                            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "var(--muted-foreground)", justifyContent: isMobile ? "space-between" : "flex-start" }}>
                                Sort
                                <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortOption)} style={{ minHeight: 40, borderRadius: 10, border: "1px solid var(--border)", backgroundColor: "var(--secondary)", color: "var(--foreground)", padding: "0 12px", fontFamily: "inherit", fontSize: 13, fontWeight: 600, width: isMobile ? "100%" : "auto" }}>
                                    <option value="rating">Top Rating</option>
                                    <option value="reviews">Most Reviews</option>
                                    <option value="name">Name A-Z</option>
                                </select>
                            </label>

                            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "var(--muted-foreground)", justifyContent: isMobile ? "space-between" : "flex-start" }}>
                                Per Page
                                <select value={pageSize} onChange={(event) => syncArchivePageRef.current(1, Number(event.target.value))} style={{ minHeight: 40, borderRadius: 10, border: "1px solid var(--border)", backgroundColor: "var(--secondary)", color: "var(--foreground)", padding: "0 12px", fontFamily: "inherit", fontSize: 13, fontWeight: 600, width: isMobile ? "100%" : "auto" }}>
                                    {PAGE_SIZE_OPTIONS.map((size) => (
                                        <option key={size} value={size}>{size}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    </div>
                </div>
            </section>

            <section style={{ maxWidth: 1400, margin: "0 auto", padding: "20px 24px 48px" }}>
                {filtered.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "80px 20px", borderRadius: 24, border: "1px dashed var(--border)", backgroundColor: "color-mix(in oklch, var(--secondary) 30%, transparent)" }}>
                        <h3 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: 20, fontWeight: 800, color: "var(--foreground)", marginBottom: 8 }}>NO VENUES FOUND</h3>
                        <p style={{ fontSize: 14, color: "var(--muted-foreground)" }}>Try adjusting your search or filter selections.</p>
                    </div>
                ) : (
                    <MapListToggle
                        venues={paginatedVenues.map((venue) => ({
                            id: venue.id,
                            slug: venue.slug,
                            lat: venue.lat,
                            lng: venue.lng,
                            name: venue.name,
                            coverImage: venue.coverImageUrl || "/venue-hero.webp",
                            city: venue.city,
                            address: venue.addressLine1,
                            rating: venue.rating,
                            reviewCount: venue.reviewCount,
                            amenities: venue.amenities,
                            cuisineTags: venue.cuisineTags,
                            priceRange: venue.priceRange,
                            isVerified: venue.isVerified,
                            isFeatured: venue.isFeatured,
                            spotsRemaining: null,
                            nextEvent: `${venue.upcomingEventsCount} upcoming events`,
                        }))}
                        onVenueClick={(index) => {
                            const venue = paginatedVenues[index];
                            if (venue) window.location.href = `/venues/${venue.slug}`;
                        }}
                        onBookNow={(index) => {
                            const venue = paginatedVenues[index];
                            if (venue) window.location.href = `/venues/${venue.slug}`;
                        }}
                    />
                )}
                <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={(page) => syncArchivePageRef.current(page)} />
            </section>

            <section style={{ padding: "48px 24px", backgroundColor: "var(--secondary)", borderTop: "1px solid var(--border)" }}>
                <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--primary)", marginBottom: 8 }}>OWN A VENUE?</div>
                    <h2 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: 28, fontWeight: 900, color: "var(--foreground)", marginBottom: 12 }}>LIST YOUR VENUE FOR FREE</h2>
                    <p style={{ fontSize: 15, color: "var(--muted-foreground)", marginBottom: 24, lineHeight: 1.6 }}>
                        Join {activeVenues.length}+ venues on MatchWatch. Get discovered by fans looking for the right watch-party spot in their city.
                    </p>
                    <Link href="/for-venues" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 32px", borderRadius: 99, fontWeight: 700, fontSize: 14, backgroundColor: "var(--primary)", color: "var(--primary-foreground)", textDecoration: "none", transition: "all 0.2s" }}>
                        Register Your Venue
                    </Link>
                </div>
            </section>
        </AppShell>
    );
}

export default function VenuesPage() {
    return (
        <React.Suspense fallback={<AppShell><section style={{ minHeight: "50vh" }} /></AppShell>}>
            <VenuesPageContent />
        </React.Suspense>
    );
}
