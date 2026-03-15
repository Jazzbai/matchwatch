import { v4 as uuidv4 } from 'uuid';
import { nanoid } from 'nanoid';

/** Generate a booking reference like "FW-A3K9PX" */
export function generateBookingReference(): string {
    return `FW-${nanoid(6).toUpperCase()}`;
}

/** Generate a slug from a string */
export function slugify(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/** Generate a unique slug (with random suffix) */
export function generateUniqueSlug(text: string): string {
    return `${slugify(text)}-${nanoid(6).toLowerCase()}`;
}

/** Calculate Haversine distance between two lat/lng points in km */
export function haversineDistance(
    lat1: number, lng1: number,
    lat2: number, lng2: number,
): number {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(deg: number): number {
    return deg * (Math.PI / 180);
}

/** Standard API response envelope */
export function apiResponse<T>(data: T, meta?: Record<string, unknown>) {
    return {
        success: true as const,
        data,
        ...(meta ? { meta } : {}),
    };
}

/** Standard API error response */
export function apiError(code: string, message: string, details?: unknown) {
    return {
        success: false as const,
        error: {
            code,
            message,
            ...(details ? { details } : {}),
        },
    };
}

/** Pagination helpers */
export function paginationMeta(page: number, limit: number, total: number) {
    return {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
    };
}

export function paginationOffset(page: number, limit: number): number {
    return (page - 1) * limit;
}
