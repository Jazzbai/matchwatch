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

            return L.divIcon({
                className: `venue-map-cluster venue-map-cluster--${density}`,
                html: `
                    <span
                        class="venue-map-cluster__bubble"
                        style="
                            display:flex;
                            align-items:center;
                            justify-content:center;
                            width:${size}px;
                            height:${size}px;
                            border-radius:999px;
                            border:2px solid rgba(255,255,255,0.72);
                            background:linear-gradient(180deg,#32c36c 0%,#17924b 100%);
                            box-shadow:0 10px 24px rgba(23,146,75,0.32), inset 0 1px 0 rgba(255,255,255,0.28);
                            color:#ffffff;
                            font-weight:900;
                            line-height:1;
                        "
                    >
                        <span
                            class="venue-map-cluster__count"
                            style="
                                display:block;
                                width:100%;
                                text-align:center;
                                font-size:${fontSize}px;
                                letter-spacing:-0.02em;
                                text-shadow:0 1px 1px rgba(0,0,0,0.28);
                            "
                        >${count}</span>
                    </span>
                `,
                iconSize: [size, size],
                iconAnchor: [size / 2, size / 2],
            });
        },
    });
}
