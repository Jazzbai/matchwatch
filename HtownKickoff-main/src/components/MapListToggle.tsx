"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { List, Map as MapIcon } from "lucide-react";
import { useTheme } from "next-themes";
import {
    createMarkerSpiderfier,
    createVenueClusterGroup,
    createVenuePinIcon,
    loadLeafletWithClusters,
    type ClusterLayer,
    type ClusterLeafletModule,
    type LeafletMap,
    type MarkerSpiderfierController,
    type LeafletTileLayer,
    type SpiderfyMarkerRecord,
} from "@/lib/leaflet-map-markers";
import { VenueCard, type VenueCardProps } from "./VenueCard";

export type VenueMapListItem = VenueCardProps & {
    id: string;
    slug?: string | null;
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
const MIN_MULTI_POINT_ZOOM = 4;

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

function venueHref(venue: Pick<VenueMapListItem, "id" | "slug">) {
    return `/venues/${encodeURIComponent(venue.slug || venue.id)}`;
}

export function MapListToggle({ venues, onVenueClick, onBookNow, mapHeight = 560 }: MapListToggleProps) {
    const { resolvedTheme } = useTheme();
    const [mobileView, setMobileView] = useState<"cards" | "map">("cards");
    const [isMobile, setIsMobile] = useState(false);
    const [mapReady, setMapReady] = useState(false);
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<LeafletMap | null>(null);
    const leafletRef = useRef<ClusterLeafletModule | null>(null);
    const markerLayerRef = useRef<ClusterLayer | null>(null);
    const spiderfierRef = useRef<MarkerSpiderfierController | null>(null);
    const tileLayerRef = useRef<LeafletTileLayer | null>(null);
    const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);

    const mappedVenues = useMemo(
        () => venues
            .map((venue, index) => ({ ...venue, originalIndex: index }))
            .filter((venue) => Number.isFinite(venue.lat) && Number.isFinite(venue.lng) && Math.abs(venue.lat) > 0 && Math.abs(venue.lng) > 0),
        [venues],
    );
    const mappedVenueLookup = useMemo(
        () => new Map(mappedVenues.map((venue) => [venue.id, venue] as const)),
        [mappedVenues],
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

    const syncTileLayer = useCallback(() => {
        const L = leafletRef.current;
        const map = mapRef.current;
        if (!L || !map) return;

        const tileConfig = getTileConfig(resolvedTheme);
        if (tileLayerRef.current) tileLayerRef.current.remove();

        tileLayerRef.current = L.tileLayer(tileConfig.url, {
            maxZoom: 19,
            attribution: tileConfig.attribution,
        }).addTo(map);
    }, [resolvedTheme]);

    useEffect(() => {
        let mounted = true;

        void (async () => {
            const L = await loadLeafletWithClusters();
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
            spiderfierRef.current?.destroy();
            spiderfierRef.current = null;
            markerLayerRef.current = null;
            tileLayerRef.current = null;
            leafletRef.current = null;
        };
    }, [syncTileLayer]);

    useEffect(() => {
        if (!mapReady) return;
        syncTileLayer();
        window.setTimeout(() => mapRef.current?.invalidateSize(), 0);
    }, [mapReady, syncTileLayer]);

    useEffect(() => {
        const L = leafletRef.current;
        const map = mapRef.current;
        if (!L || !map) return;

        if (markerLayerRef.current) {
            markerLayerRef.current.remove();
            markerLayerRef.current = null;
        }
        spiderfierRef.current?.destroy();
        spiderfierRef.current = null;

        const layer = createVenueClusterGroup(L, isMobile);
        markerLayerRef.current = layer;
        layer.addTo(map);

        if (mappedVenues.length === 0) {
            map.setView(HOUSTON_CENTER, 11, { animate: false });
            return;
        }

        const points: [number, number][] = [];
        const spiderfyRecords: SpiderfyMarkerRecord<(typeof mappedVenues)[number]>[] = [];

        mappedVenues.forEach((venue) => {
            const marker = L.marker([venue.lat, venue.lng], {
                icon: createVenuePinIcon(L),
            });

            const image = escapeHtml(venue.coverImage || "/venue-hero.webp");
            const title = escapeHtml(venue.name);
            const subtitle = escapeHtml([venue.city, venue.address].filter(Boolean).join(" | "));
            const rating = Number(venue.rating || 0).toFixed(1);
            const href = venueHref(venue);
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
            marker.on("click", () => {
                const spiderfied = spiderfierRef.current?.spiderfy(venue.id) ?? false;
                if (spiderfied) return;

                setSelectedVenueId(venue.id);
                onVenueClick?.(venue.originalIndex);
                marker.openPopup();
            });
            layer.addLayer(marker);
            spiderfyRecords.push({
                id: venue.id,
                lat: venue.lat,
                lng: venue.lng,
                marker,
                data: venue,
                popupHtml: `
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
                popupOptions: { className: popupClassName, closeButton: false, offset: [0, -18] },
                onSelect: () => {
                    setSelectedVenueId(venue.id);
                    onVenueClick?.(venue.originalIndex);
                },
            });
            points.push([venue.lat, venue.lng]);
        });

        spiderfierRef.current = createMarkerSpiderfier(L, map, spiderfyRecords, {
            nearbyMarkerTolerancePx: isMobile ? 24 : 18,
            minZoomToSpiderfy: isMobile ? 14 : 15,
        });

        if (points.length === 1) {
            map.setView(points[0], 13, { animate: false });
        } else {
            const bounds = L.latLngBounds(points);
            map.fitBounds(bounds, { padding: [28, 28] });

            // When venues span multiple states, fitBounds can zoom out so far that
            // marker clustering collapses everything into one marker. Keep the
            // explorer at a usable nationwide zoom so distinct pins remain visible.
            if (map.getZoom() < MIN_MULTI_POINT_ZOOM) {
                map.setView(bounds.getCenter(), MIN_MULTI_POINT_ZOOM, { animate: false });
            }
        }

        setTimeout(() => map.invalidateSize(), 0);
        return () => {
            spiderfierRef.current?.destroy();
            spiderfierRef.current = null;
        };
    }, [isMobile, mappedVenues, onVenueClick, resolvedTheme]);

    useEffect(() => {
        if (!selectedVenueId) return;
        const node = cardRefs.current[selectedVenueId];
        node?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, [selectedVenueId]);

    const focusVenue = (venueId: string) => {
        setSelectedVenueId(venueId);
        const venue = mappedVenueLookup.get(venueId);
        if (!venue) return;
        spiderfierRef.current?.focus(venueId);
    };

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
                <div
                    key={venue.id}
                    ref={(node) => {
                        cardRefs.current[venue.id] = node;
                    }}
                    style={{
                        borderRadius: 24,
                        transition: "box-shadow 0.2s ease, transform 0.2s ease",
                        boxShadow: selectedVenueId === venue.id
                            ? "0 0 0 2px color-mix(in oklch, var(--primary) 38%, transparent), 0 16px 40px rgba(0,0,0,0.12)"
                            : "none",
                    }}
                >
                    <VenueCard
                        {...venue}
                        onClick={() => {
                            setSelectedVenueId(venue.id);
                            onVenueClick?.(index);
                            focusVenue(venue.id);
                        }}
                        onBookNow={() => onBookNow?.(index)}
                    />
                </div>
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
                        <MapIcon size={16} />
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
                <div
                    style={{
                        display: isMobile && mobileView !== "cards" ? "none" : "block",
                        minHeight: 0,
                        maxHeight: isMobile ? "none" : effectiveMapHeight,
                        overflowY: isMobile ? "visible" : "auto",
                        paddingRight: isMobile ? 0 : 8,
                    }}
                >
                    {listPane}
                </div>
                <div
                    style={{
                        display: isMobile && mobileView !== "map" ? "none" : "block",
                        alignSelf: "start",
                        position: isMobile ? "relative" : "sticky",
                        top: isMobile ? "auto" : stickyTop,
                        height: isMobile ? "auto" : effectiveMapHeight,
                    }}
                >
                    {mapPane}
                </div>
            </div>
        </div>
    );
}
