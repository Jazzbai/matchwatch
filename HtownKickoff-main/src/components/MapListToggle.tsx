"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { List, Map } from "lucide-react";
import { useTheme } from "next-themes";
import { VenueCard, type VenueCardProps } from "./VenueCard";

export type VenueMapListItem = VenueCardProps & {
    id: string;
    slug: string;
    lat: number;
    lng: number;
};

interface MapListToggleProps {
    venues: VenueMapListItem[];
    onVenueClick?: (index: number) => void;
    onBookNow?: (index: number) => void;
    mapHeight?: number;
}

const HOUSTON_CENTER: [number, number] = [29.7604, -95.3698];

function escapeHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getTileConfig(theme: string | undefined) {
    if (theme === "dark") {
        return {
            url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        };
    }

    return {
        url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    };
}

function createVenuePulseIcon(L: any) {
    return L.divIcon({
        className: "venue-map-pin",
        html: `
            <span class="venue-map-pin__pulse"></span>
            <span class="venue-map-pin__ring"></span>
            <span class="venue-map-pin__dot"></span>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -16],
    });
}

export function MapListToggle({ venues, onVenueClick, onBookNow, mapHeight = 560 }: MapListToggleProps) {
    const { resolvedTheme } = useTheme();
    const [mobileView, setMobileView] = useState<"cards" | "map">("cards");
    const [isMobile, setIsMobile] = useState(false);
    const [mapReady, setMapReady] = useState(false);
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<any>(null);
    const leafletRef = useRef<any>(null);
    const markerLayerRef = useRef<any>(null);
    const tileLayerRef = useRef<any>(null);

    const mappedVenues = useMemo(
        () => venues
            .map((venue, index) => ({ ...venue, originalIndex: index }))
            .filter((venue) => Number.isFinite(venue.lat) && Number.isFinite(venue.lng) && Math.abs(venue.lat) > 0 && Math.abs(venue.lng) > 0),
        [venues],
    );
    const stickyTop = 96;
    const effectiveMapHeight: number | string = isMobile
        ? Math.min(mapHeight, 420)
        : `min(${mapHeight}px, calc(100vh - ${stickyTop + 24}px))`;

    useEffect(() => {
        const media = window.matchMedia("(max-width: 767px)");
        const update = () => setIsMobile(media.matches);
        update();
        media.addEventListener("change", update);
        return () => media.removeEventListener("change", update);
    }, []);

    const syncTileLayer = () => {
        const L = leafletRef.current;
        const map = mapRef.current;
        if (!L || !map) return;

        const tileConfig = getTileConfig(resolvedTheme);
        if (tileLayerRef.current) tileLayerRef.current.remove();

        tileLayerRef.current = L.tileLayer(tileConfig.url, {
            maxZoom: 19,
            attribution: tileConfig.attribution,
        }).addTo(map);
    };

    useEffect(() => {
        let mounted = true;

        void (async () => {
            const L = await import("leaflet");
            if (!mounted || !mapContainerRef.current || mapRef.current) return;

            leafletRef.current = L;
            delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
            L.Icon.Default.mergeOptions({
                iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
                iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
                shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
            });

            mapRef.current = L.map(mapContainerRef.current, {
                center: HOUSTON_CENTER,
                zoom: 11,
                scrollWheelZoom: true,
                zoomControl: true,
            });

            syncTileLayer();
            setMapReady(true);
        })();

        return () => {
            mounted = false;
            setMapReady(false);
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
            markerLayerRef.current = null;
            tileLayerRef.current = null;
            leafletRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (!mapReady) return;
        syncTileLayer();
        window.setTimeout(() => mapRef.current?.invalidateSize(), 0);
    }, [mapReady, resolvedTheme]);

    useEffect(() => {
        const L = leafletRef.current;
        const map = mapRef.current;
        if (!L || !map) return;

        if (markerLayerRef.current) {
            markerLayerRef.current.remove();
            markerLayerRef.current = null;
        }

        const layer = L.layerGroup();
        markerLayerRef.current = layer;
        layer.addTo(map);

        if (mappedVenues.length === 0) {
            map.setView(HOUSTON_CENTER, 11, { animate: false });
            return;
        }

        const points: [number, number][] = [];

        mappedVenues.forEach((venue) => {
            const marker = L.marker([venue.lat, venue.lng], {
                icon: createVenuePulseIcon(L),
            }).addTo(layer);

            const image = escapeHtml(venue.coverImage || "/venue-hero.webp");
            const title = escapeHtml(venue.name);
            const subtitle = escapeHtml([venue.city, venue.address].filter(Boolean).join(" | "));
            const rating = Number(venue.rating || 0).toFixed(1);
            const href = `/venues/${venue.slug}`;
            const popupClassName = resolvedTheme === "dark" ? "venue-map-popup-dark" : "venue-map-popup-light";

            marker.bindPopup(
                `
                <div class="venue-map-popup-card">
                    <img src="${image}" alt="${title}" class="venue-map-popup-image" />
                    <div class="venue-map-popup-body">
                        <div class="venue-map-popup-kicker">Venue</div>
                        <div class="venue-map-popup-title">${title}</div>
                        <div class="venue-map-popup-meta">${subtitle}</div>
                        <div class="venue-map-popup-footer">
                            <span class="venue-map-popup-rating">${rating} stars</span>
                            <a class="venue-map-popup-link" href="${href}">View Venue</a>
                        </div>
                    </div>
                </div>
                `,
                { className: popupClassName, closeButton: false, offset: [0, -18] },
            );
            points.push([venue.lat, venue.lng]);
        });

        if (points.length === 1) {
            map.setView(points[0], 13, { animate: false });
        } else {
            map.fitBounds(L.latLngBounds(points), { padding: [28, 28] });
        }

        setTimeout(() => map.invalidateSize(), 0);
    }, [mappedVenues, onVenueClick, resolvedTheme]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        const shouldShowMap = !isMobile || mobileView === "map";
        if (!shouldShowMap) return;
        const firstPass = window.setTimeout(() => map.invalidateSize(), 60);
        const secondPass = window.setTimeout(() => map.invalidateSize(), 220);
        return () => {
            window.clearTimeout(firstPass);
            window.clearTimeout(secondPass);
        };
    }, [isMobile, mobileView, mappedVenues.length]);

    const listPane = (
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))", alignContent: "start" }}>
            {venues.map((venue, index) => (
                <VenueCard key={venue.id} {...venue} onClick={() => onVenueClick?.(index)} onBookNow={() => onBookNow?.(index)} />
            ))}
        </div>
    );

    const mapPane = (
        <div style={{ minHeight: effectiveMapHeight, height: effectiveMapHeight, borderRadius: 24, overflow: "hidden", border: "1px solid var(--border)", background: "var(--secondary)" }}>
            <div ref={mapContainerRef} style={{ width: "100%", height: effectiveMapHeight }} />
        </div>
    );

    return (
        <div style={{ display: "grid", gap: 16 }}>
            {isMobile ? (
                <div style={{ display: "inline-flex", gap: 6, padding: 4, borderRadius: 999, border: "1px solid var(--border)", background: "var(--secondary)", alignSelf: "start" }}>
                    <button
                        type="button"
                        onClick={() => setMobileView("cards")}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            border: "none",
                            padding: "10px 14px",
                            borderRadius: 999,
                            background: mobileView === "cards" ? "var(--primary)" : "transparent",
                            color: mobileView === "cards" ? "var(--primary-foreground)" : "var(--muted-foreground)",
                            fontWeight: 700,
                            cursor: "pointer",
                        }}
                    >
                        <List size={16} />
                        Card View
                    </button>
                    <button
                        type="button"
                        onClick={() => setMobileView("map")}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            border: "none",
                            padding: "10px 14px",
                            borderRadius: 999,
                            background: mobileView === "map" ? "var(--primary)" : "transparent",
                            color: mobileView === "map" ? "var(--primary-foreground)" : "var(--muted-foreground)",
                            fontWeight: 700,
                            cursor: "pointer",
                        }}
                    >
                        <Map size={16} />
                        Map View
                    </button>
                </div>
            ) : null}

            <div
                style={{
                    display: "grid",
                    gap: 16,
                    gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1.05fr) minmax(320px, 0.95fr)",
                    alignItems: "start",
                }}
            >
                <div style={{ display: isMobile && mobileView !== "cards" ? "none" : "block" }}>
                    {listPane}
                </div>
                <div
                    style={{
                        display: isMobile && mobileView !== "map" ? "none" : "block",
                        alignSelf: "start",
                        position: isMobile ? "relative" : "sticky",
                        top: isMobile ? "auto" : stickyTop,
                    }}
                >
                    {mapPane}
                </div>
            </div>
        </div>
    );
}
