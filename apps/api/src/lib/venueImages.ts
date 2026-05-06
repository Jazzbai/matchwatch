import { createHash } from 'crypto';

import type { GoogleSourceSnapshot } from './googlePlaces';

export type GooglePhotoAttribution = {
    displayName: string;
    uri?: string | null;
    photoUri?: string | null;
};

export type GooglePlacePhotoSnapshot = {
    name: string;
    widthPx?: number | null;
    heightPx?: number | null;
    authorAttributions?: GooglePhotoAttribution[];
};

export type GoogleImageSelectionSnapshot = {
    coverPhotoName?: string | null;
    galleryPhotoNames?: string[];
    selectedAt?: string | null;
    sourceHash?: string | null;
};

export type VenueImageAttribution = GooglePhotoAttribution;

export type VenueImageRenderPayload = {
    coverImageUrl: string | null;
    galleryImageUrls: string[];
    imageSource: 'manual' | 'google' | 'none';
    coverImageAttributions: VenueImageAttribution[];
    galleryImageAttributions: VenueImageAttribution[][];
    googleSuggestedImages: Array<GooglePlacePhotoSnapshot & {
        previewUrl: string;
        isSelectedCover: boolean;
        isSelectedGallery: boolean;
    }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function isLegacyGooglePlacePhotoUrl(value: string) {
    return value.includes('maps.googleapis.com/maps/api/place/photo');
}

function asNumber(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function encodePhotoName(photoName: string) {
    return photoName
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/');
}

function scorePhotoForCover(photo: GooglePlacePhotoSnapshot) {
    const width = photo.widthPx || 0;
    const height = photo.heightPx || 0;
    if (!width || !height) return Number.NEGATIVE_INFINITY;

    const resolutionScore = width * height;
    const ratio = width / height;
    const ratioDelta = Math.abs(ratio - (16 / 9));
    const ratioScore = Math.max(0, 10_000 - ratioDelta * 4_000);
    const landscapeBonus = width >= height ? 50_000 : 0;
    return resolutionScore + ratioScore + landscapeBonus;
}

function isUsablePhoto(photo: GooglePlacePhotoSnapshot) {
    const width = photo.widthPx || 0;
    const height = photo.heightPx || 0;
    return Boolean(photo.name && width >= 800 && height >= 800);
}

function buildSourceHash(photos: GooglePlacePhotoSnapshot[]) {
    const payload = photos
        .map((photo) => ({
            name: photo.name,
            widthPx: photo.widthPx || 0,
            heightPx: photo.heightPx || 0,
        }));

    return createHash('sha1').update(JSON.stringify(payload)).digest('hex');
}

export function normalizeGooglePhotoSnapshots(value: unknown): GooglePlacePhotoSnapshot[] {
    if (!Array.isArray(value)) return [];

    const seen = new Set<string>();
    const normalized: GooglePlacePhotoSnapshot[] = [];
    for (const entry of value) {
        if (!isRecord(entry)) continue;
        const name = asString(entry.name);
        if (!name || seen.has(name)) continue;
        seen.add(name);
        const authorAttributions = Array.isArray(entry.authorAttributions)
            ? entry.authorAttributions.flatMap((author) => {
                if (!isRecord(author)) return [];
                const displayName = asString(author.displayName);
                if (!displayName) return [];
                return [{
                    displayName,
                    uri: asString(author.uri),
                    photoUri: asString(author.photoUri),
                }];
            })
            : [];

        normalized.push({
            name,
            widthPx: asNumber(entry.widthPx),
            heightPx: asNumber(entry.heightPx),
            authorAttributions,
        });
    }
    return normalized;
}

export function computeGoogleImageSelection(photos: GooglePlacePhotoSnapshot[]): GoogleImageSelectionSnapshot {
    const usablePhotos = photos.filter(isUsablePhoto);
    if (usablePhotos.length === 0) {
        return {
            coverPhotoName: null,
            galleryPhotoNames: [],
            selectedAt: new Date().toISOString(),
            sourceHash: buildSourceHash(photos),
        };
    }

    const sortedForCover = [...usablePhotos].sort((a, b) => scorePhotoForCover(b) - scorePhotoForCover(a));
    const cover = sortedForCover[0];

    const galleryCandidates = usablePhotos
        .filter((photo) => photo.name !== cover.name)
        .sort((a, b) => {
            const landscapeDelta = Number(Boolean(b.widthPx && b.heightPx && b.widthPx >= b.heightPx))
                - Number(Boolean(a.widthPx && a.heightPx && a.widthPx >= a.heightPx));
            if (landscapeDelta !== 0) return landscapeDelta;
            return (b.widthPx || 0) * (b.heightPx || 0) - (a.widthPx || 0) * (a.heightPx || 0);
        })
        .slice(0, 6);

    return {
        coverPhotoName: cover.name,
        galleryPhotoNames: galleryCandidates.map((photo) => photo.name),
        selectedAt: new Date().toISOString(),
        sourceHash: buildSourceHash(photos),
    };
}

export function normalizeGoogleSourceSnapshot(snapshot: GoogleSourceSnapshot): GoogleSourceSnapshot {
    const normalizedPhotos = normalizeGooglePhotoSnapshots(snapshot.photos);
    const sourceHash = buildSourceHash(normalizedPhotos);
    const existingSelection = isRecord(snapshot.googleImageSelection)
        ? snapshot.googleImageSelection as GoogleImageSelectionSnapshot
        : null;

    const validPhotoNames = new Set(normalizedPhotos.map((photo) => photo.name));
    const canReuseExistingSelection = Boolean(
        existingSelection
        && existingSelection.sourceHash === sourceHash
        && (!existingSelection.coverPhotoName || validPhotoNames.has(existingSelection.coverPhotoName))
        && (existingSelection.galleryPhotoNames || []).every((photoName) => validPhotoNames.has(photoName)),
    );

    const googleImageSelection = canReuseExistingSelection
        ? {
            coverPhotoName: existingSelection?.coverPhotoName || null,
            galleryPhotoNames: (existingSelection?.galleryPhotoNames || []).filter((photoName) => photoName !== existingSelection?.coverPhotoName),
            selectedAt: existingSelection?.selectedAt || new Date().toISOString(),
            sourceHash,
        }
        : computeGoogleImageSelection(normalizedPhotos);

    return {
        ...snapshot,
        photos: normalizedPhotos,
        photosFetchedAt: snapshot.photosFetchedAt || new Date().toISOString(),
        googleImageSelection,
    };
}

export function resolveSelectedGooglePhotos(snapshot: GoogleSourceSnapshot | null | undefined) {
    if (!snapshot) {
        return {
            photos: [] as GooglePlacePhotoSnapshot[],
            cover: null as GooglePlacePhotoSnapshot | null,
            gallery: [] as GooglePlacePhotoSnapshot[],
            selection: null as GoogleImageSelectionSnapshot | null,
        };
    }

    const normalized = normalizeGoogleSourceSnapshot(snapshot);
    const photos = normalizeGooglePhotoSnapshots(normalized.photos);
    const selection = normalized.googleImageSelection || null;
    const cover = photos.find((photo) => photo.name === selection?.coverPhotoName) || null;
    const gallery = (selection?.galleryPhotoNames || [])
        .map((photoName) => photos.find((photo) => photo.name === photoName) || null)
        .filter((photo): photo is GooglePlacePhotoSnapshot => Boolean(photo));

    return { photos, cover, gallery, selection };
}

export function setGoogleCoverPhoto(snapshot: GoogleSourceSnapshot, photoName: string) {
    const normalized = normalizeGoogleSourceSnapshot(snapshot);
    const { photos, selection } = resolveSelectedGooglePhotos(normalized);
    if (!photos.some((photo) => photo.name === photoName)) return normalized;

    const existingGallery = (selection?.galleryPhotoNames || []).filter((name) => name !== photoName);
    return {
        ...normalized,
        googleImageSelection: {
            coverPhotoName: photoName,
            galleryPhotoNames: existingGallery,
            selectedAt: new Date().toISOString(),
            sourceHash: selection?.sourceHash || buildSourceHash(photos),
        },
    };
}

export function appendGoogleGalleryPhoto(snapshot: GoogleSourceSnapshot, photoName: string) {
    const normalized = normalizeGoogleSourceSnapshot(snapshot);
    const { photos, selection } = resolveSelectedGooglePhotos(normalized);
    if (!photos.some((photo) => photo.name === photoName)) return normalized;

    const galleryPhotoNames = Array.from(new Set([
        ...(selection?.galleryPhotoNames || []).filter((name) => name !== photoName && name !== selection?.coverPhotoName),
        photoName,
    ])).slice(0, 6);

    return {
        ...normalized,
        googleImageSelection: {
            coverPhotoName: selection?.coverPhotoName || null,
            galleryPhotoNames,
            selectedAt: new Date().toISOString(),
            sourceHash: selection?.sourceHash || buildSourceHash(photos),
        },
    };
}

export function resetGoogleImageSelection(snapshot: GoogleSourceSnapshot) {
    const normalized = normalizeGoogleSourceSnapshot(snapshot);
    return {
        ...normalized,
        googleImageSelection: computeGoogleImageSelection(normalizeGooglePhotoSnapshots(normalized.photos)),
    };
}

export function buildGooglePhotoProxyUrl(slugOrId: string, photoName: string) {
    return `/api/v1/venues/${encodeURIComponent(slugOrId)}/google-photo?name=${encodeURIComponent(photoName)}`;
}

export function buildGoogleCoverProxyUrl(slugOrId: string) {
    return `/api/v1/venues/${encodeURIComponent(slugOrId)}/cover-image`;
}

export function buildGoogleGalleryProxyUrl(slugOrId: string, index: number) {
    return `/api/v1/venues/${encodeURIComponent(slugOrId)}/gallery/${index}`;
}

export function getGooglePhotoAttributions(photo: GooglePlacePhotoSnapshot | null | undefined) {
    return (photo?.authorAttributions || []).map((entry) => ({
        displayName: entry.displayName,
        uri: entry.uri || null,
        photoUri: entry.photoUri || null,
    }));
}

export function buildVenueImageRenderPayload(params: {
    slugOrId: string;
    coverImageUrl?: string | null;
    manualGalleryImageUrls?: string[];
    snapshot?: GoogleSourceSnapshot | null;
}): VenueImageRenderPayload {
    const manualCoverImageUrl = asString(params.coverImageUrl);
    const manualGalleryImageUrls = (params.manualGalleryImageUrls || [])
        .map((value) => asString(value))
        .filter((value): value is string => Boolean(value));
    const { photos, cover, gallery, selection } = resolveSelectedGooglePhotos(params.snapshot || null);
    const googleCoverUrl = cover ? buildGoogleCoverProxyUrl(params.slugOrId) : null;
    const googleGallery = gallery.map((photo, index) => ({
        url: buildGoogleGalleryProxyUrl(params.slugOrId, index),
        attributions: getGooglePhotoAttributions(photo),
    }));
    const isLegacyGoogleManualCover = Boolean(manualCoverImageUrl && isLegacyGooglePlacePhotoUrl(manualCoverImageUrl));
    const preferredManualCoverImageUrl = isLegacyGoogleManualCover ? null : manualCoverImageUrl;
    const fallbackManualCoverImageUrl = isLegacyGoogleManualCover ? manualCoverImageUrl : null;

    const coverImageUrl = preferredManualCoverImageUrl
        || googleCoverUrl
        || fallbackManualCoverImageUrl
        || manualGalleryImageUrls[0]
        || googleGallery[0]?.url
        || null;
    const selectedManualImage = Boolean(
        (preferredManualCoverImageUrl && coverImageUrl === preferredManualCoverImageUrl)
        || (fallbackManualCoverImageUrl && coverImageUrl === fallbackManualCoverImageUrl)
        || (manualGalleryImageUrls[0] && coverImageUrl === manualGalleryImageUrls[0]),
    );
    const imageSource: VenueImageRenderPayload['imageSource'] = selectedManualImage
        ? 'manual'
        : googleCoverUrl || googleGallery[0]?.url
            ? 'google'
            : 'none';

    const galleryImageUrls = [
        ...manualGalleryImageUrls,
        ...googleGallery.map((entry) => entry.url),
    ];
    const galleryImageAttributions = [
        ...manualGalleryImageUrls.map(() => [] as VenueImageAttribution[]),
        ...googleGallery.map((entry) => entry.attributions),
    ];

    return {
        coverImageUrl,
        galleryImageUrls,
        imageSource,
        coverImageAttributions: imageSource === 'google'
            ? getGooglePhotoAttributions(cover || gallery[0])
            : [],
        galleryImageAttributions,
        googleSuggestedImages: photos.map((photo) => ({
            ...photo,
            previewUrl: buildGooglePhotoProxyUrl(params.slugOrId, photo.name),
            isSelectedCover: photo.name === selection?.coverPhotoName,
            isSelectedGallery: (selection?.galleryPhotoNames || []).includes(photo.name),
        })),
    };
}

export function encodeGooglePhotoPath(photoName: string) {
    return encodePhotoName(photoName);
}
