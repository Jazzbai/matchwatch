"use client";

import React, { useEffect, useMemo, useRef } from "react";

type MatchVenueMapPoint = {
    id: string;
    name: string;
    slug: string;
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

const FALLBACK_CENTER: [number, number] = [29.7604, -95.3698]; // Houston

function escapeHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
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

export function MatchVenueMap({ venues, onSelectVenue, height = 360 }: MatchVenueMapProps) {
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<any>(null);
    const markerLayerRef = useRef<any>(null);
    const leafletRef = useRef<any>(null);

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
            const L = await import("leaflet");
            if (!mounted || !mapContainerRef.current || mapRef.current) return;

            leafletRef.current = L;

            delete (L.Icon.Default.prototype as any)._getIconUrl;
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
        })();

        return () => {
            mounted = false;
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

        const layer = L.layerGroup();
        markerLayerRef.current = layer;
        layer.addTo(map);

        if (validVenues.length === 0) {
            map.setView(FALLBACK_CENTER, 11, { animate: false });
            return;
        }

        const points: [number, number][] = [];

        for (const venue of validVenues) {
            const marker = L.marker([venue.lat, venue.lng], {
                icon: createVenuePulseIcon(L),
            }).addTo(layer);
            const capacityLabel = venue.bookingLimit
                ? `${venue.confirmedBookings}/${venue.bookingLimit} booked`
                : `${venue.confirmedBookings} booked`;
            marker.bindPopup(
                `<div style="min-width:180px"><strong>${escapeHtml(venue.name)}</strong><br/>${escapeHtml(venue.city || "")}${venue.city && venue.addressLine1 ? " · " : ""}${escapeHtml(venue.addressLine1 || "")}<br/><span style="color:#666">${escapeHtml(capacityLabel)}</span></div>`,
            );
            marker.on("click", () => onSelectVenue?.(venue.id));
            points.push([venue.lat, venue.lng]);
        }

        if (points.length === 1) {
            map.setView(points[0], 13, { animate: false });
            return;
        }

        const bounds = L.latLngBounds(points);
        map.fitBounds(bounds, { padding: [30, 30] });
    }, [validVenues, onSelectVenue]);

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
