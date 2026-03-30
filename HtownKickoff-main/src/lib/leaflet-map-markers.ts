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

            return L.divIcon({
                className: `venue-map-cluster venue-map-cluster--${density}`,
                html: `
                    <span class="venue-map-cluster__bubble">
                        <span class="venue-map-cluster__count">${count}</span>
                    </span>
                `,
                iconSize: [size, size],
                iconAnchor: [size / 2, size / 2],
            });
        },
    });
}
