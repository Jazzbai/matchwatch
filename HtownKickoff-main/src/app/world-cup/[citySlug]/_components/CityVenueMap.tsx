"use client";

import React, { useEffect, useRef, useMemo, useState } from "react";
import {
  loadLeafletWithClusters,
  createVenuePinIcon,
  type ClusterLayer,
  type ClusterLeafletModule,
  type LeafletMap,
} from "@/lib/leaflet-map-markers";
import type { CityVenue } from "../types";
import { buildVenueRegisterUrl } from "../types";

interface Props {
  venues: CityVenue[];
  citySlug: string;
  cityName: string;
  centerLat: number;
  centerLng: number;
  zoom?: number;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function CityVenueMap({
  venues,
  citySlug,
  cityName,
  centerLat,
  centerLng,
  zoom = 11,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<ClusterLayer | null>(null);
  const leafletRef = useRef<ClusterLeafletModule | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const validVenues = useMemo(
    () =>
      venues.filter(
        (v) =>
          Number.isFinite(v.lat) &&
          Number.isFinite(v.lng) &&
          Math.abs(v.lat) > 0 &&
          Math.abs(v.lng) > 0,
      ),
    [venues],
  );

  useEffect(() => {
    let mounted = true;

    void (async () => {
      const L = await loadLeafletWithClusters();
      if (!mounted || !containerRef.current || mapRef.current) return;

      leafletRef.current = L;

      delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(containerRef.current, {
        center: [centerLat, centerLng],
        zoom,
        scrollWheelZoom: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      mapRef.current = map;

      // Leaflet renders blank/mis-sized if the container had no size at init —
      // invalidate on every container resize so tiles + pins lay out correctly.
      const ro = new ResizeObserver(() => map.invalidateSize());
      if (containerRef.current) ro.observe(containerRef.current);
      resizeObserverRef.current = ro;
      setTimeout(() => map.invalidateSize(), 0);

      // Refs don't trigger re-renders, so the marker effect would never re-run
      // once the async map init finishes — flag readiness to re-run it.
      if (mounted) setMapReady(true);
    })();

    return () => {
      mounted = false;
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      layerRef.current = null;
      leafletRef.current = null;
    };
  }, [centerLat, centerLng, zoom]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    if (layerRef.current) {
      (layerRef.current as { remove(): void }).remove();
      layerRef.current = null;
    }

    const layer = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      zoomToBoundsOnClick: true,
      removeOutsideVisibleBounds: true,
      animate: true,
      animateAddingMarkers: false,
      maxClusterRadius: 60,
      disableClusteringAtZoom: 14,
      iconCreateFunction: (cluster: { getChildCount(): number }) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div style="background:oklch(0.72 0.19 28);color:#0a0b0d;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;border:2px solid rgba(255,255,255,0.3)">${count}</div>`,
          className: "",
          iconSize: L.point(34, 34),
        });
      },
    });

    layerRef.current = layer;
    layer.addTo(map);

    map.invalidateSize();

    if (validVenues.length === 0) return;

    const points: [number, number][] = [];

    for (const venue of validVenues) {
      const claimUrl = buildVenueRegisterUrl({
        citySlug,
        venueSlug: venue.slug,
        type: "claim",
      });
      const viewUrl = `/venues/${encodeURIComponent(venue.slug)}`;
      const wpBadge = venue.watchPartyReady
        ? `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;background:rgba(34,197,94,0.15);color:#22c55e;border:1px solid rgba(34,197,94,0.3);margin-bottom:8px">✓ Watch Party Ready</span><br/>`
        : "";

      const popupHtml = `
        <div style="min-width:200px;font-family:system-ui,sans-serif;line-height:1.4">
          <strong style="font-size:14px;display:block;margin-bottom:2px">${escapeHtml(venue.name)}</strong>
          <span style="font-size:11px;color:#666">${escapeHtml(venue.type)}</span><br/>
          <span style="font-size:11px;color:#666">${escapeHtml(venue.address)}</span><br/>
          <div style="margin:8px 0">${wpBadge}</div>
          <div style="display:flex;gap:6px;margin-top:4px">
            <a href="${viewUrl}" style="flex:1;display:inline-block;padding:5px 8px;background:#0a0b0d;color:#f1ece4;text-align:center;border-radius:6px;font-size:11px;font-weight:700;text-decoration:none">View Venue</a>
            <a href="${claimUrl}" style="flex:1;display:inline-block;padding:5px 8px;background:oklch(0.72 0.19 28);color:#0a0b0d;text-align:center;border-radius:6px;font-size:11px;font-weight:700;text-decoration:none">Claim Venue</a>
          </div>
        </div>
      `;

      const marker = L.marker([venue.lat, venue.lng], {
        icon: createVenuePinIcon(L),
      });
      marker.bindPopup(popupHtml, { maxWidth: 240 });
      layer.addLayer(marker);
      points.push([venue.lat, venue.lng]);
    }

    if (points.length === 1) {
      map.setView(points[0], 14, { animate: false });
    } else if (points.length > 1) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [validVenues, citySlug, mapReady]);

  return (
    <section className="cc-section" id="map">
      <div className="cc-wrap">
        <div className="cc-sh">
          <div>
            <h2 className="cc-st">{cityName} Watch Party Venue Map</h2>
            <p className="cc-ss">
              Explore {cityName} venues, bars, restaurants, hotels, and event spaces
              available for World Cup watch parties.
            </p>
          </div>
        </div>
        <div className="cc-map-outer" style={{ height: 480 }}>
          <div
            ref={containerRef}
            style={{ width: "100%", height: "100%", minHeight: 480 }}
          />
        </div>
      </div>
    </section>
  );
}
