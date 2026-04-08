export type LeafletModule = typeof import("leaflet");
export type LeafletMap = import("leaflet").Map;
export type LeafletLayer = import("leaflet").Layer;
export type LeafletTileLayer = import("leaflet").TileLayer;

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
