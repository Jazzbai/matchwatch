"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    createMarkerSpiderfier,
    createVenueClusterGroup,
    createVenuePinIcon,
    loadLeafletWithClusters,
    type ClusterLayer,
    type ClusterLeafletModule,
    type LeafletMap,
    type MarkerSpiderfierController,
    type SpiderfyMarkerRecord,
} from "@/lib/leaflet-map-markers";

type MatchVenueMapPoint = {
    id: string;
    name: string;
    slug?: string | null;
    addressLine1?: string;
    city?: string;
    lat: number;
    lng: number;
    confirmedBookings: number;
    bookingLimit?: number | null;
};

type MatchVenueMapProps = {
    venues: MatchVenueMapPoint[];
    onSelectVenue?: (venueId: string) => void;
    height?: number;
};

const FALLBACK_CENTER: [number, number] = [29.7604, -95.3698];

function escapeHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function venueHref(venue: Pick<MatchVenueMapPoint, "id" | "slug">) {
    return `/venues/${encodeURIComponent(venue.slug || venue.id)}`;
}

export function MatchVenueMap({ venues, onSelectVenue, height = 360 }: MatchVenueMapProps) {
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<LeafletMap | null>(null);
    const markerLayerRef = useRef<ClusterLayer | null>(null);
    const leafletRef = useRef<ClusterLeafletModule | null>(null);
    const spiderfierRef = useRef<MarkerSpiderfierController | null>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const [mapReady, setMapReady] = useState(false);

    const validVenues = useMemo(
        () =>
            venues.filter(
                (venue) =>
                    Number.isFinite(venue.lat) &&
                    Number.isFinite(venue.lng) &&
                    Math.abs(venue.lat) > 0 &&
                    Math.abs(venue.lng) > 0,
            ),
        [venues],
    );

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

            const map = L.map(mapContainerRef.current, {
                center: FALLBACK_CENTER,
                zoom: 11,
                scrollWheelZoom: true,
            });

            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                maxZoom: 19,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            }).addTo(map);

            mapRef.current = map;

            // Leaflet renders blank/mis-sized if the container had no size at
            // init — invalidate on every resize so tiles + pins lay out right.
            const ro = new ResizeObserver(() => map.invalidateSize());
            if (mapContainerRef.current) ro.observe(mapContainerRef.current);
            resizeObserverRef.current = ro;
            setTimeout(() => map.invalidateSize(), 0);

            // Signal readiness so the marker effect re-runs once the map
            // exists — refs alone don't trigger a re-render, so without this
            // markers are never added if data settled before init finished.
            if (mounted) setMapReady(true);
        })();

        return () => {
            mounted = false;
            resizeObserverRef.current?.disconnect();
            resizeObserverRef.current = null;
            spiderfierRef.current?.destroy();
            spiderfierRef.current = null;
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
            markerLayerRef.current = null;
            leafletRef.current = null;
        };
    }, []);

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

        const layer = createVenueClusterGroup(L, true);
        markerLayerRef.current = layer;
        layer.addTo(map);

        map.invalidateSize();

        if (validVenues.length === 0) {
            map.setView(FALLBACK_CENTER, 11, { animate: false });
            return;
        }

        const points: [number, number][] = [];
        const spiderfyRecords: SpiderfyMarkerRecord<MatchVenueMapPoint>[] = [];

        for (const venue of validVenues) {
            const marker = L.marker([venue.lat, venue.lng], {
                icon: createVenuePinIcon(L),
            });

            const capacityLabel = venue.bookingLimit
                ? `${venue.confirmedBookings}/${venue.bookingLimit} booked`
                : `${venue.confirmedBookings} booked`;

            const popupHtml = `<div style="min-width:180px"><strong>${escapeHtml(venue.name)}</strong><br/>${escapeHtml(venue.city || "")}${venue.city && venue.addressLine1 ? " | " : ""}${escapeHtml(venue.addressLine1 || "")}<br/><span style="color:#666">${escapeHtml(capacityLabel)}</span><br/><a href="${venueHref(venue)}" style="display:inline-block;margin-top:8px;font-weight:700">View venue</a></div>`;

            marker.bindPopup(popupHtml);
            marker.on("click", () => {
                const spiderfied = spiderfierRef.current?.spiderfy(venue.id) ?? false;
                if (spiderfied) return;
                onSelectVenue?.(venue.id);
                marker.openPopup();
            });

            layer.addLayer(marker);
            spiderfyRecords.push({
                id: venue.id,
                lat: venue.lat,
                lng: venue.lng,
                marker,
                data: venue,
                popupHtml,
                onSelect: () => onSelectVenue?.(venue.id),
            });
            points.push([venue.lat, venue.lng]);
        }

        spiderfierRef.current = createMarkerSpiderfier(L, map, spiderfyRecords, {
            nearbyMarkerTolerancePx: 18,
            minZoomToSpiderfy: 15,
        });

        if (points.length === 1) {
            map.setView(points[0], 13, { animate: false });
            return () => {
                spiderfierRef.current?.destroy();
                spiderfierRef.current = null;
            };
        }

        const bounds = L.latLngBounds(points);
        map.fitBounds(bounds, { padding: [30, 30] });

        return () => {
            spiderfierRef.current?.destroy();
            spiderfierRef.current = null;
        };
    }, [validVenues, onSelectVenue, mapReady]);

    return (
        <div
            ref={mapContainerRef}
            style={{
                width: "100%",
                height: `${height}px`,
                borderRadius: "14px",
                border: "1px solid var(--border)",
                overflow: "hidden",
                background: "var(--secondary)",
            }}
        />
    );
}
