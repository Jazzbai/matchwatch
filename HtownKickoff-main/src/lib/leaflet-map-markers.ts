export type LeafletModule = typeof import("leaflet");
export type LeafletMap = import("leaflet").Map;
export type LeafletLayer = import("leaflet").Layer;
export type LeafletTileLayer = import("leaflet").TileLayer;
export type LeafletLayerGroup = import("leaflet").LayerGroup;
export type LeafletMarker = import("leaflet").Marker;
export type LeafletPoint = import("leaflet").Point;
export type LeafletPopupOptions = import("leaflet").PopupOptions;
export type LeafletMarkerOptions = import("leaflet").MarkerOptions;

export interface ClusterLayer {
    addTo(map: LeafletMap): unknown;
    addLayer(layer: LeafletLayer): unknown;
    remove(): unknown;
}

export interface ClusterLeafletModule extends LeafletModule {
    markerClusterGroup(options: {
        showCoverageOnHover: boolean;
        spiderfyOnMaxZoom: boolean;
        zoomToBoundsOnClick: boolean;
        removeOutsideVisibleBounds: boolean;
        animate: boolean;
        animateAddingMarkers: boolean;
        maxClusterRadius: number;
        disableClusteringAtZoom: number;
        iconCreateFunction: (cluster: { getChildCount(): number }) => unknown;
    }): ClusterLayer;
}

export interface SpiderfyMarkerRecord<T = unknown> {
    id: string;
    lat: number;
    lng: number;
    marker: LeafletMarker;
    data: T;
    popupHtml?: string;
    popupOptions?: LeafletPopupOptions;
    onSelect?: () => void;
}

export interface MarkerSpiderfierOptions {
    nearbyMarkerTolerancePx?: number;
    circleToSpiralThreshold?: number;
    circleFootSeparationPx?: number;
    spiralFootSeparationPx?: number;
    spiralLengthStartPx?: number;
    spiralLengthFactorPx?: number;
    minZoomToSpiderfy?: number;
}

export interface MarkerSpiderfierController {
    spiderfy(target: string | SpiderfyMarkerRecord): boolean;
    unspiderfy(): void;
    focus(targetId: string, zoom?: number): void;
    destroy(): void;
}

export async function loadLeafletWithClusters(): Promise<ClusterLeafletModule> {
    const leafletModule = await import("leaflet");
    const L = (("default" in leafletModule ? leafletModule.default : leafletModule) as unknown as ClusterLeafletModule);
    const globalScope = globalThis as typeof globalThis & {
        L?: ClusterLeafletModule;
        Leaflet?: ClusterLeafletModule;
    };

    if (!globalScope.L?.markerClusterGroup) {
        globalScope.L = L;
        globalScope.Leaflet = L;
        await import("leaflet.markercluster/dist/leaflet.markercluster-src.js");
    }

    return (globalScope.L ?? L) as ClusterLeafletModule;
}

export function createVenuePinIcon(L: LeafletModule) {
    return L.divIcon({
        className: "venue-map-pin",
        html: `
            <span class="venue-map-pin__pulse"></span>
            <span class="venue-map-pin__shell"></span>
            <span class="venue-map-pin__center"></span>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -24],
    });
}

export function createVenueClusterGroup(L: ClusterLeafletModule, compact = false): ClusterLayer {
    return L.markerClusterGroup({
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        zoomToBoundsOnClick: true,
        removeOutsideVisibleBounds: true,
        animate: true,
        animateAddingMarkers: false,
        maxClusterRadius: compact ? 42 : 56,
        disableClusteringAtZoom: compact ? 14 : 15,
        iconCreateFunction: (cluster) => {
            const count = cluster.getChildCount();
            const density = count < 10 ? "sm" : count < 50 ? "md" : "lg";
            const size = density === "sm" ? 30 : density === "md" ? 34 : 38;
            const fontSize = density === "sm" ? 12 : density === "md" ? 13 : 14;
            const radius = Math.floor(size / 2) - 2;
            const center = size / 2;

            return L.divIcon({
                className: `venue-map-cluster venue-map-cluster--${density}`,
                html: `
                    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="display:block;overflow:visible">
                        <defs>
                            <linearGradient id="venue-cluster-gradient-${size}" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stop-color="#32c36c" />
                                <stop offset="100%" stop-color="#17924b" />
                            </linearGradient>
                            <filter id="venue-cluster-shadow-${size}" x="-50%" y="-50%" width="200%" height="200%">
                                <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="rgba(23,146,75,0.32)" />
                            </filter>
                        </defs>
                        <circle cx="${center}" cy="${center}" r="${radius}" fill="url(#venue-cluster-gradient-${size})" stroke="rgba(255,255,255,0.72)" stroke-width="2" filter="url(#venue-cluster-shadow-${size})" />
                        <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="${fontSize}" font-weight="900" letter-spacing="-0.02em" style="paint-order:stroke;stroke:rgba(0,0,0,0.28);stroke-width:1px;">${count}</text>
                    </svg>
                `,
                iconSize: [size, size],
                iconAnchor: [size / 2, size / 2],
            });
        },
    });
}

function generateCirclePoints(
    center: LeafletPoint,
    count: number,
    footSeparationPx: number,
    L: LeafletModule,
) {
    const circumference = footSeparationPx * (2 + count);
    const radius = circumference / (Math.PI * 2);
    const angleStep = (Math.PI * 2) / count;
    const points: LeafletPoint[] = [];

    for (let index = 0; index < count; index += 1) {
        const angle = -Math.PI / 2 + index * angleStep;
        points.push(L.point(
            center.x + radius * Math.cos(angle),
            center.y + radius * Math.sin(angle),
        ));
    }

    return points;
}

function generateSpiralPoints(
    center: LeafletPoint,
    count: number,
    footSeparationPx: number,
    spiralLengthStartPx: number,
    spiralLengthFactorPx: number,
    L: LeafletModule,
) {
    const points: LeafletPoint[] = [];
    let legLength = spiralLengthStartPx;
    let angle = 0;

    for (let index = 0; index < count; index += 1) {
        angle += footSeparationPx / legLength + index * 0.0005;
        const x = center.x + legLength * Math.cos(angle);
        const y = center.y + legLength * Math.sin(angle);
        points.push(L.point(x, y));
        legLength += (Math.PI * 2 * spiralLengthFactorPx) / angle;
    }

    return points;
}

export function createMarkerSpiderfier<T>(
    L: LeafletModule,
    map: LeafletMap,
    records: SpiderfyMarkerRecord<T>[],
    options?: MarkerSpiderfierOptions,
): MarkerSpiderfierController {
    const nearbyMarkerTolerancePx = options?.nearbyMarkerTolerancePx ?? 18;
    const circleToSpiralThreshold = options?.circleToSpiralThreshold ?? 9;
    const circleFootSeparationPx = options?.circleFootSeparationPx ?? 34;
    const spiralFootSeparationPx = options?.spiralFootSeparationPx ?? 26;
    const spiralLengthStartPx = options?.spiralLengthStartPx ?? 14;
    const spiralLengthFactorPx = options?.spiralLengthFactorPx ?? 6;
    const minZoomToSpiderfy = options?.minZoomToSpiderfy ?? 15;

    const recordMap = new Map(records.map((record) => [record.id, record] as const));
    const overlayGroup = L.layerGroup().addTo(map);
    const activeSpiderfyIds = new Set<string>();

    const unspiderfy = () => {
        overlayGroup.clearLayers();
        if (activeSpiderfyIds.size === 0) return;

        activeSpiderfyIds.forEach((id) => {
            const record = recordMap.get(id);
            if (record) record.marker.setOpacity(1);
        });
        activeSpiderfyIds.clear();
    };

    const findNearbyRecords = (target: SpiderfyMarkerRecord<T>) => {
        const centerPoint = map.latLngToLayerPoint([target.lat, target.lng]);
        return records.filter((candidate) => {
            const point = map.latLngToLayerPoint([candidate.lat, candidate.lng]);
            return centerPoint.distanceTo(point) <= nearbyMarkerTolerancePx;
        });
    };

    const spiderfy = (target: string | SpiderfyMarkerRecord<T>) => {
        if (map.getZoom() < minZoomToSpiderfy) return false;

        const targetRecord = typeof target === "string" ? recordMap.get(target) : target;
        if (!targetRecord) return false;

        const nearbyRecords = findNearbyRecords(targetRecord);
        if (nearbyRecords.length <= 1) {
            unspiderfy();
            return false;
        }

        const nearbyIds = new Set(nearbyRecords.map((record) => record.id));
        if (
            activeSpiderfyIds.size === nearbyIds.size &&
            [...activeSpiderfyIds].every((id) => nearbyIds.has(id))
        ) {
            return true;
        }

        unspiderfy();

        const centerLatLng = L.latLng(targetRecord.lat, targetRecord.lng);
        const centerPoint = map.latLngToLayerPoint(centerLatLng);
        const spiderPoints = nearbyRecords.length >= circleToSpiralThreshold
            ? generateSpiralPoints(centerPoint, nearbyRecords.length, spiralFootSeparationPx, spiralLengthStartPx, spiralLengthFactorPx, L)
            : generateCirclePoints(centerPoint, nearbyRecords.length, circleFootSeparationPx, L);

        nearbyRecords.forEach((record, index) => {
            record.marker.closePopup();
            record.marker.setOpacity(0);
            activeSpiderfyIds.add(record.id);

            const destinationLatLng = map.layerPointToLatLng(spiderPoints[index]);
            const sourceLatLng = L.latLng(record.lat, record.lng);

            L.polyline([sourceLatLng, destinationLatLng], {
                className: "venue-map-spider-leg",
                color: "#32c36c",
                weight: 2,
                opacity: 0.95,
                interactive: false,
            }).addTo(overlayGroup);

            const markerOptions: LeafletMarkerOptions = {
                zIndexOffset: 1000,
                keyboard: false,
            };
            if (record.marker.options.icon) {
                markerOptions.icon = record.marker.options.icon;
            }
            const spiderMarker = L.marker(destinationLatLng, markerOptions);

            if (record.popupHtml) {
                spiderMarker.bindPopup(record.popupHtml, record.popupOptions);
            }

            spiderMarker.on("click", () => {
                record.onSelect?.();
                if (record.popupHtml) {
                    spiderMarker.openPopup();
                }
            });

            spiderMarker.addTo(overlayGroup);
        });

        return true;
    };

    const focus = (targetId: string, zoom = minZoomToSpiderfy + 1) => {
        const record = recordMap.get(targetId);
        if (!record) return;

        map.flyTo([record.lat, record.lng], Math.max(map.getZoom(), zoom), {
            animate: true,
            duration: 0.35,
        });

        window.setTimeout(() => {
            spiderfy(record);
        }, 260);
    };

    const clearOnInteraction = () => unspiderfy();
    map.on("click", clearOnInteraction);
    map.on("zoomstart", clearOnInteraction);
    map.on("movestart", clearOnInteraction);

    return {
        spiderfy,
        unspiderfy,
        focus,
        destroy: () => {
            unspiderfy();
            map.off("click", clearOnInteraction);
            map.off("zoomstart", clearOnInteraction);
            map.off("movestart", clearOnInteraction);
            overlayGroup.remove();
        },
    };
}
