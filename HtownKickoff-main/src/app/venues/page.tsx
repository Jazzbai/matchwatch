"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Search } from "lucide-react";
import { AppShell } from "../../components/AppShell";
import { MapListToggle } from "../../components/MapListToggle";
import { PaginationControls } from "../../components/PaginationControls";
import { AMENITY_LABELS } from "../../lib/data";
import { useData, type PriceRange, type Venue } from "../../lib/data-provider";
import { paginateItems, parsePageParam } from "../../lib/pagination";

// US state full name → 2-letter abbreviation
const STATE_ABBREV: Record<string, string> = {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR", "California": "CA",
    "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE", "Florida": "FL", "Georgia": "GA",
    "Hawaii": "HI", "Idaho": "ID", "Illinois": "IL", "Indiana": "IN", "Iowa": "IA",
    "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
    "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS",
    "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV",
    "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
    "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK",
    "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
    "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT",
    "Vermont": "VT", "Virginia": "VA", "Washington": "WA", "West Virginia": "WV",
    "Wisconsin": "WI", "Wyoming": "WY", "District of Columbia": "DC",
};

function normalizeStateToAbbrev(state: string): string {
    const trimmed = state.trim();
    if (!trimmed) return "";
    // Already an abbreviation (1-2 uppercase letters)
    if (/^[A-Z]{2}$/.test(trimmed)) return trimmed;
    return STATE_ABBREV[trimmed] ?? trimmed.toUpperCase().slice(0, 2);
}

const PRICE_OPTIONS: Array<{ value: PriceRange; label: string }> = [
    { value: "BUDGET", label: "Budget" },
    { value: "MID", label: "Mid-range" },
    { value: "UPSCALE", label: "Upscale" },
    { value: "LUXURY", label: "Luxury" },
];
const PAGE_SIZE_OPTIONS = [12, 24, 48] as const;
const LOCATION_SESSION_KEY = "venues-location-session-v1";

type SortOption = "rating" | "reviews" | "name";
type BrowserPermissionState = "idle" | "requesting" | "applied" | "unsupported" | "error";

type DropdownKey = "price" | "state" | "city" | "amenity" | null;

function normalizeFilterValue(value: string | null | undefined) {
    return (value || "").trim();
}

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
}: {
    checked: boolean;
    label: string;
    onChange: () => void;
}) {
    return (
        <label
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: checked ? "1px solid var(--primary)" : "1px solid var(--border)",
                backgroundColor: checked ? "color-mix(in oklch, var(--primary) 12%, transparent)" : "var(--secondary)",
                color: checked ? "var(--foreground)" : "var(--muted-foreground)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                minHeight: 42,
                userSelect: "none",
            }}
        >
            <input
                type="checkbox"
                checked={checked}
                onChange={onChange}
                style={{ width: 16, height: 16, accentColor: "var(--primary)", flexShrink: 0 }}
            />
            <span>{label}</span>
        </label>

    );
}

function FilterDropdown({
    title,
    summary,
    isOpen,
    onToggle,
    onClear,
    isMobile,
    searchValue,
    onSearchChange,
    searchPlaceholder,
    emptyState,
    children,
}: {
    title: string;
    summary: string;
    isOpen: boolean;
    onToggle: () => void;
    onClear?: () => void;
    isMobile: boolean;
    searchValue?: string;
    onSearchChange?: (value: string) => void;
    searchPlaceholder?: string;
    emptyState?: string;
    children: React.ReactNode;
}) {
    return (
        <div style={{ position: "relative", minWidth: isMobile ? "100%" : 180, flex: isMobile ? "1 1 100%" : "0 1 220px" }}>
            <button
                type="button"
                onClick={onToggle}
                style={{
                    width: "100%",
                    minHeight: 44,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--secondary)",
                    color: "var(--foreground)",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    textAlign: "left",
                }}
            >
                <span style={{ display: "grid", gap: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>{title}</span>
                    <span>{summary}</span>
                </span>
                <ChevronDown size={16} style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s ease" }} />
            </button>
            {isOpen ? (
                <div
                    style={{
                        position: "absolute",
                        top: "calc(100% + 8px)",
                        left: 0,
                        zIndex: 20,
                        width: isMobile ? "100%" : 320,
                        maxWidth: "min(92vw, 360px)",
                        maxHeight: 320,
                        overflowY: "auto",
                        display: "grid",
                        gap: 12,
                        padding: 14,
                        borderRadius: 16,
                        border: "1px solid var(--border)",
                        backgroundColor: "var(--card)",
                        boxShadow: "0 18px 40px rgba(0, 0, 0, 0.14)",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: "var(--foreground)" }}>{title}</span>
                        {onClear ? (
                            <button
                                type="button"
                                onClick={onClear}
                                style={{ border: "none", background: "transparent", color: "var(--primary)", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0 }}
                            >
                                Clear
                            </button>
                        ) : null}
                    </div>
                    {onSearchChange ? (
                        <div style={{ position: "relative" }}>
                            <input
                                type="text"
                                value={searchValue || ""}
                                onChange={(event) => onSearchChange(event.target.value)}
                                placeholder={searchPlaceholder || `Search ${title.toLowerCase()}...`}
                                style={{
                                    width: "100%",
                                    minHeight: 40,
                                    padding: "10px 12px 10px 38px",
                                    borderRadius: 12,
                                    border: "1px solid var(--border)",
                                    backgroundColor: "var(--secondary)",
                                    color: "var(--foreground)",
                                    fontFamily: "inherit",
                                    fontSize: 13,
                                    fontWeight: 500,
                                    outline: "none",
                                }}
                            />
                            <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 15, height: 15, color: "var(--muted-foreground)" }} />
                        </div>
                    ) : null}
                    {React.Children.count(children) > 0 ? (
                        <div style={{ display: "grid", gap: 10, gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(132px, 1fr))" }}>
                            {children}
                        </div>
                    ) : (
                        <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{emptyState || `No ${title.toLowerCase()} match your search.`}</span>
                    )}
                </div>
            ) : null}
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
    const [locationPermissionState, setLocationPermissionState] = useState<BrowserPermissionState>("idle");
    const [locationMessage, setLocationMessage] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(false);
    const [openDropdown, setOpenDropdown] = useState<DropdownKey>(null);
    const [stateSearchQuery, setStateSearchQuery] = useState("");
    const [citySearchQuery, setCitySearchQuery] = useState("");
    const [amenitySearchQuery, setAmenitySearchQuery] = useState("");

    const requestedPage = parsePageParam(searchParams.get("page"));
    const pageSize = parsePageSizeParam(searchParams.get("pageSize"));
    const syncArchivePageRef = useRef<(nextPage: number, nextPageSize?: number) => void>(() => {});
    const hasInitializedPageReset = useRef(false);
    const dropdownContainerRef = useRef<HTMLDivElement | null>(null);

    const activeVenues = useMemo(() => VENUES.filter((venue) => venue.isActive), [VENUES]);
    const stateOptions = useMemo(
        () => Array.from(new Set(
            activeVenues.map((venue) => normalizeStateToAbbrev(normalizeFilterValue(venue.state))).filter(Boolean)
        )).sort((a, b) => a.localeCompare(b)),
        [activeVenues],
    );

    // AJAX city search state
    const [ajaxCities, setAjaxCities] = useState<string[]>([]);
    const [ajaxCitiesLoading, setAjaxCitiesLoading] = useState(false);
    const cityFetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const amenityOptions = useMemo(
        () => Object.entries(AMENITY_LABELS)
            .filter(([key]) => activeVenues.some((venue) => venue.amenities.includes(key)))
            .sort((a, b) => a[1].label.localeCompare(b[1].label)),
        [activeVenues],
    );
    const filteredStateOptions = useMemo(() => {
        const query = stateSearchQuery.trim().toLowerCase();
        if (!query) return stateOptions;
        return stateOptions.filter((state) => state.toLowerCase().includes(query));
    }, [stateOptions, stateSearchQuery]);

    // Fetch cities from API (debounced, AJAX)
    const fetchCities = useCallback((query: string, states: string[]) => {
        if (cityFetchTimer.current) clearTimeout(cityFetchTimer.current);
        cityFetchTimer.current = setTimeout(async () => {
            setAjaxCitiesLoading(true);
            try {
                const params = new URLSearchParams();
                if (query) params.set("q", query);
                // Send raw state values (both abbrevs and full) so backend can match
                for (const abbrev of states) {
                    // Find full names that map to this abbreviation to cast a wide net
                    const fullNames = Object.entries(STATE_ABBREV)
                        .filter(([, v]) => v === abbrev)
                        .map(([k]) => k);
                    params.append("states[]", abbrev);
                    for (const full of fullNames) params.append("states[]", full);
                }
                const res = await fetch(`/api/v1/venues/cities?${params.toString()}`);
                if (res.ok) {
                    const json = await res.json();
                    setAjaxCities(Array.isArray(json.data) ? json.data : []);
                }
            } catch {
                // silently ignore
            } finally {
                setAjaxCitiesLoading(false);
            }
        }, 250);
    }, []);

    const filteredCityOptions = ajaxCities;
    const filteredAmenityOptions = useMemo(() => {
        const query = amenitySearchQuery.trim().toLowerCase();
        if (!query) return amenityOptions;
        return amenityOptions.filter(([key, value]) => {
            const label = value.label.toLowerCase();
            return label.includes(query) || key.toLowerCase().includes(query);
        });
    }, [amenityOptions, amenitySearchQuery]);

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

    // Trigger AJAX city fetch when city dropdown opens or search query changes
    useEffect(() => {
        if (openDropdown === "city") {
            fetchCities(citySearchQuery, selectedStates);
        }
    }, [openDropdown, citySearchQuery, selectedStates, fetchCities]);

    // When city dropdown closes, clear results (will reload fresh on next open)
    useEffect(() => {
        if (openDropdown !== "city") {
            setAjaxCities([]);
        }
    }, [openDropdown]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const media = window.matchMedia("(max-width: 767px)");
        const update = () => setIsMobile(media.matches);
        update();
        media.addEventListener("change", update);
        return () => media.removeEventListener("change", update);
    }, []);

    useEffect(() => {
        function handleOutsideClick(event: MouseEvent) {
            if (!dropdownContainerRef.current?.contains(event.target as Node)) {
                setOpenDropdown(null);
            }
        }

        document.addEventListener("mousedown", handleOutsideClick);
        return () => document.removeEventListener("mousedown", handleOutsideClick);
    }, []);

    useEffect(() => {
        if (openDropdown !== "state") {
            setStateSearchQuery("");
        }
        if (openDropdown !== "city") {
            setCitySearchQuery("");
        }
        if (openDropdown !== "amenity") {
            setAmenitySearchQuery("");
        }
    }, [openDropdown]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (window.sessionStorage.getItem(LOCATION_SESSION_KEY) === "done") return;
        window.sessionStorage.setItem(LOCATION_SESSION_KEY, "done");

        if (!("geolocation" in navigator)) {
            setLocationPermissionState("unsupported");
            return;
        }

        setLocationPermissionState("requesting");
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const nearestVenue = nearestVenueByCoordinates(activeVenues, position.coords.latitude, position.coords.longitude);
                if (!nearestVenue) {
                    setLocationPermissionState("error");
                    setLocationMessage("No venue coordinates are available yet for location matching.");
                    return;
                }

                const nextState = normalizeStateToAbbrev(normalizeFilterValue(nearestVenue.state));
                const nextCity = normalizeFilterValue(nearestVenue.city);
                setSelectedStates(nextState ? [nextState] : []);
                setSelectedCities(nextCity ? [nextCity] : []);
                setLocationPermissionState("applied");
                setLocationMessage(nextCity ? `Showing venues in ${nextCity}${nextState ? `, ${nextState}` : ""}.` : "Showing venues closest to your current area.");
            },
            () => {
                setLocationPermissionState("error");
                setLocationMessage("Location access was not granted. You can still filter manually.");
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
        );
    }, [activeVenues]);

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
            const normalizedState = normalizeStateToAbbrev(normalizeFilterValue(venue.state));
            const normalizedCity = normalizeFilterValue(venue.city);
            const stateOK = selectedStates.length === 0 || selectedStates.includes(normalizedState);
            const cityOK = selectedCities.length === 0 || selectedCities.includes(normalizedCity);
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

    const clearAllFilters = () => {
        setSearchQuery("");
        setSelectedPrices([]);
        setSelectedStates([]);
        setSelectedCities([]);
        setSelectedAmenities([]);
        setSortBy("rating");
        setLocationMessage(null);
    };

    const priceSummary = selectedPrices.length > 0 ? `${selectedPrices.length} selected` : "Any price";
    const stateSummary = selectedStates.length > 0 ? `${selectedStates.length} selected` : "All states";
    const citySummary = selectedCities.length > 0 ? `${selectedCities.length} selected` : "All cities";
    const amenitySummary = selectedAmenities.length > 0 ? `${selectedAmenities.length} selected` : "Any amenity";
    const hasActiveFilters = searchQuery.trim().length > 0 || selectedPrices.length > 0 || selectedStates.length > 0 || selectedCities.length > 0 || selectedAmenities.length > 0;

    if (VENUES.length === 0) {
        return (
            <AppShell>
                <style>{`@keyframes shimmer{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
                <section style={{ maxWidth: 1400, margin: "0 auto", padding: "0 24px 20px" }}>
                    <div style={{ height: 14, width: 80, borderRadius: 6, background: "var(--secondary)", marginBottom: 10, animation: "shimmer 1.5s ease-in-out infinite" }} />
                    <div style={{ height: 40, width: 200, borderRadius: 10, background: "var(--secondary)", marginBottom: 10, animation: "shimmer 1.5s ease-in-out infinite" }} />
                    <div style={{ height: 16, width: 320, borderRadius: 6, background: "var(--secondary)", animation: "shimmer 1.5s ease-in-out infinite" }} />
                </section>
                <section style={{ maxWidth: 1400, margin: "0 auto", padding: "0 24px 48px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
                        {Array.from({ length: 9 }).map((_, i) => (
                            <div key={i} style={{ borderRadius: 16, overflow: "hidden", background: "var(--card)", border: "1px solid var(--border)" }}>
                                <div style={{ height: 180, background: "var(--secondary)", animation: "shimmer 1.5s ease-in-out infinite" }} />
                                <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                                    <div style={{ height: 18, width: "70%", borderRadius: 6, background: "var(--secondary)", animation: "shimmer 1.5s ease-in-out infinite" }} />
                                    <div style={{ height: 13, width: "50%", borderRadius: 6, background: "var(--secondary)", animation: "shimmer 1.5s ease-in-out infinite" }} />
                                    <div style={{ display: "flex", gap: 6 }}>
                                        {[1,2,3].map(j => <div key={j} style={{ height: 24, width: 60, borderRadius: 99, background: "var(--secondary)", animation: "shimmer 1.5s ease-in-out infinite" }} />)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </AppShell>
        );
    }
    return (
        <AppShell>
            <section style={{ maxWidth: 1400, margin: "0 auto", padding: "0 24px 20px" }}>
                <div style={{ marginBottom: 6, fontSize: 12, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--primary)" }}>EXPLORE</div>
                <h1 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: 36, fontWeight: 900, color: "var(--foreground)", marginBottom: 8, letterSpacing: "-0.02em" }}>Venues</h1>
                <p style={{ fontSize: 15, color: "var(--muted-foreground)", maxWidth: 640, lineHeight: 1.6, fontWeight: 500 }}>
                    Discover bars, lounges, and restaurants hosting major match watch parties and daily sports viewing. Filters support multi-select combinations, including state-first location browsing.
                </p>
            </section>

            <section style={{ maxWidth: 1400, margin: "0 auto", padding: "0 24px 20px" }}>
                <div style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, padding: isMobile ? "16px" : "20px 24px", display: "grid", gap: 16 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, flexDirection: isMobile ? "column" : "row" }}>
                        <div style={{ position: "relative", flex: "1 1 320px", maxWidth: isMobile ? "100%" : 420, width: "100%" }}>
                            <input
                                type="text"
                                placeholder="Search venues, cuisine, neighborhoods, city, or state..."
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                style={{ width: "100%", padding: "12px 16px 12px 40px", borderRadius: 12, border: "1px solid var(--border)", backgroundColor: "var(--secondary)", color: "var(--foreground)", fontFamily: "inherit", fontSize: 13, fontWeight: 500, outline: "none" }}
                            />
                            <Search style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "var(--muted-foreground)" }} />
                        </div>

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

                    {locationMessage ? <div style={{ fontSize: 13, fontWeight: 600, color: locationPermissionState === "error" ? "var(--muted-foreground)" : "var(--primary)" }}>{locationMessage}</div> : null}

                    <div ref={dropdownContainerRef} style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                        <FilterDropdown title="Price" summary={priceSummary} isOpen={openDropdown === "price"} onToggle={() => setOpenDropdown((current) => current === "price" ? null : "price")} onClear={selectedPrices.length > 0 ? () => setSelectedPrices([]) : undefined} isMobile={isMobile}>
                            {PRICE_OPTIONS.map((option) => (
                                <FilterCheckbox
                                    key={option.value}
                                    checked={selectedPrices.includes(option.value)}
                                    label={option.label}
                                    onChange={() => setSelectedPrices((current) => toggleSelection(current, option.value) as PriceRange[])}
                                />
                            ))}
                        </FilterDropdown>

                        <FilterDropdown
                            title="State"
                            summary={stateSummary}
                            isOpen={openDropdown === "state"}
                            onToggle={() => setOpenDropdown((current) => current === "state" ? null : "state")}
                            onClear={selectedStates.length > 0 ? () => setSelectedStates([]) : undefined}
                            isMobile={isMobile}
                            searchValue={stateSearchQuery}
                            onSearchChange={setStateSearchQuery}
                            searchPlaceholder="Search states..."
                            emptyState="No states match your search."
                        >
                            {filteredStateOptions.map((state) => (
                                <FilterCheckbox key={state} checked={selectedStates.includes(state)} label={state} onChange={() => setSelectedStates((current) => toggleSelection(current, state))} />
                            ))}
                        </FilterDropdown>

                        <FilterDropdown
                            title="City"
                            summary={citySummary}
                            isOpen={openDropdown === "city"}
                            onToggle={() => setOpenDropdown((current) => current === "city" ? null : "city")}
                            onClear={selectedCities.length > 0 ? () => setSelectedCities([]) : undefined}
                            isMobile={isMobile}
                            searchValue={citySearchQuery}
                            onSearchChange={setCitySearchQuery}
                            searchPlaceholder="Type to search cities..."
                            emptyState={ajaxCitiesLoading ? "Loading cities..." : "No cities found. Try a different search."}
                        >
                            {filteredCityOptions.map((city) => (
                                <FilterCheckbox key={city} checked={selectedCities.includes(city)} label={city} onChange={() => setSelectedCities((current) => toggleSelection(current, city))} />
                            ))}
                        </FilterDropdown>

                        <FilterDropdown
                            title="Amenities"
                            summary={amenitySummary}
                            isOpen={openDropdown === "amenity"}
                            onToggle={() => setOpenDropdown((current) => current === "amenity" ? null : "amenity")}
                            onClear={selectedAmenities.length > 0 ? () => setSelectedAmenities([]) : undefined}
                            isMobile={isMobile}
                            searchValue={amenitySearchQuery}
                            onSearchChange={setAmenitySearchQuery}
                            searchPlaceholder="Search amenities..."
                            emptyState="No amenities match your search."
                        >
                            {filteredAmenityOptions.map(([key, value]) => (
                                <FilterCheckbox key={key} checked={selectedAmenities.includes(key)} label={value.label} onChange={() => setSelectedAmenities((current) => toggleSelection(current, key))} />
                            ))}
                        </FilterDropdown>
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <span style={{ fontSize: 13, color: "var(--muted-foreground)", fontWeight: 600 }}>
                            Showing {paginatedVenues.length} on this page, {filtered.length} venue{filtered.length !== 1 ? "s" : ""} total
                        </span>
                        {hasActiveFilters ? (
                            <button type="button" onClick={clearAllFilters} style={{ padding: "10px 14px", borderRadius: 999, border: "1px solid var(--border)", backgroundColor: "transparent", color: "var(--muted-foreground)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                                Clear all filters
                            </button>
                        ) : null}
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
                            fanTeams: venue.fanTeams ?? [],
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
