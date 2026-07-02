"use client";

import React, { useEffect, useRef } from "react";
import type { LeafletMouseEvent, Map as LeafletMap, Marker } from "leaflet";

type LocationPickerMapProps = {
    lat: number;
    lng: number;
    onSelect: (lat: number, lng: number) => void;
    zoom?: number;
};

export function LocationPickerMap({
    lat,
    lng,
    onSelect,
    zoom = 12,
}: LocationPickerMapProps) {
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<LeafletMap | null>(null);
    const markerRef = useRef<Marker | null>(null);

    useEffect(() => {
        let mounted = true;

        void (async () => {
            const L = await import("leaflet");
            if (!mounted || !mapContainerRef.current || mapRef.current) return;

            // Use CDN marker assets so markers render correctly in Next standalone builds.
            delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
            L.Icon.Default.mergeOptions({
                iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
                iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
                shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
            });

            const map = L.map(mapContainerRef.current, {
                center: [lat, lng],
                zoom,
                scrollWheelZoom: true,
            });

            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                maxZoom: 19,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            }).addTo(map);

            markerRef.current = L.marker([lat, lng]).addTo(map);

            map.on("click", (event: LeafletMouseEvent) => {
                const selectedLat = Number(event.latlng.lat);
                const selectedLng = Number(event.latlng.lng);

                if (markerRef.current) {
                    markerRef.current.setLatLng([selectedLat, selectedLng]);
                } else {
                    markerRef.current = L.marker([selectedLat, selectedLng]).addTo(map);
                }

                onSelect(selectedLat, selectedLng);
            });

            mapRef.current = map;
        })();

        return () => {
            mounted = false;
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
            markerRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (!mapRef.current || !markerRef.current) return;
        markerRef.current.setLatLng([lat, lng]);
        mapRef.current.setView([lat, lng], mapRef.current.getZoom(), { animate: false });
    }, [lat, lng]);

    return (
        <div
            ref={mapContainerRef}
            style={{
                width: "100%",
                height: "320px",
                borderRadius: "12px",
                border: "1px solid var(--border)",
                overflow: "hidden",
            }}
        />
    );
}
