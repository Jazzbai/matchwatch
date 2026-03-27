/**
 * MatchWatch API Client
 *
 * Centralized API client for the frontend with:
 * - Base URL configuration
 * - Automatic auth token injection
 * - Request/response interceptors
 * - Token refresh on 401
 * - Type-safe response handling
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

// ─── Auth Token Store ───────────────────────────

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function getAccessToken(): string | null {
    if (typeof window !== 'undefined') {
        return accessToken || localStorage.getItem('accessToken');
    }
    return accessToken;
}

export function setAccessToken(token: string | null) {
    accessToken = token;
    if (typeof window !== 'undefined') {
        if (token) {
            localStorage.setItem('accessToken', token);
        } else {
            localStorage.removeItem('accessToken');
        }
    }
}

// ─── API Response Types ─────────────────────────

export interface ApiResponse<T> {
    success: true;
    data: T;
    meta?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface ApiError {
    success: false;
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
    requestId?: string;
}

export class ApiClientError extends Error {
    status: number;
    code: string;
    details?: unknown;

    constructor(status: number, code: string, message: string, details?: unknown) {
        super(message);
        this.name = 'ApiClientError';
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

// ─── Token Refresh ──────────────────────────────

async function refreshToken(): Promise<string | null> {
    try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
        });
        if (!res.ok) {
            setAccessToken(null);
            return null;
        }
        const data = await res.json();
        if (data.success && data.data.accessToken) {
            setAccessToken(data.data.accessToken);
            return data.data.accessToken;
        }
        return null;
    } catch {
        setAccessToken(null);
        return null;
    }
}

// Single-flight refresh: prevent multiple concurrent refresh requests
async function ensureToken(): Promise<string | null> {
    if (!refreshPromise) {
        refreshPromise = refreshToken().finally(() => {
            refreshPromise = null;
        });
    }
    return refreshPromise;
}

// ─── Core Fetch Wrapper ─────────────────────────

interface RequestOptions extends Omit<RequestInit, 'body'> {
    body?: unknown;
    params?: Record<string, string | number | boolean | undefined>;
    skipAuth?: boolean;
}

async function apiFetch<T>(
    endpoint: string,
    options: RequestOptions = {},
): Promise<ApiResponse<T>> {
    const { body, params, skipAuth = false, ...fetchOptions } = options;

    // Build URL with query params
    let url = `${API_BASE}${endpoint}`;
    if (params) {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== '') {
                searchParams.set(key, String(value));
            }
        });
        const queryString = searchParams.toString();
        if (queryString) url += `?${queryString}`;
    }

    // Headers
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...((fetchOptions.headers || {}) as Record<string, string>),
    };

    if (!skipAuth) {
        const token = getAccessToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
    }

    // Execute request
    let response = await fetch(url, {
        ...fetchOptions,
        headers,
        credentials: 'include',
        body: body ? JSON.stringify(body) : undefined,
    });

    // Handle 401 - try to refresh token
    if (response.status === 401 && !skipAuth && getAccessToken()) {
        const newToken = await ensureToken();
        if (newToken) {
            headers['Authorization'] = `Bearer ${newToken}`;
            response = await fetch(url, {
                ...fetchOptions,
                headers,
                credentials: 'include',
                body: body ? JSON.stringify(body) : undefined,
            });
        }
    }

    const data = await response.json();

    if (!response.ok || !data.success) {
        throw new ApiClientError(
            response.status,
            data.error?.code || 'UNKNOWN_ERROR',
            data.error?.message || 'An unexpected error occurred',
            data.error?.details,
        );
    }

    return data as ApiResponse<T>;
}

// ─── HTTP Method Helpers ────────────────────────

export const api = {
    get: <T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>) =>
        apiFetch<T>(endpoint, { method: 'GET', params }),

    post: <T>(endpoint: string, body?: unknown) =>
        apiFetch<T>(endpoint, { method: 'POST', body }),

    put: <T>(endpoint: string, body?: unknown) =>
        apiFetch<T>(endpoint, { method: 'PUT', body }),

    patch: <T>(endpoint: string, body?: unknown) =>
        apiFetch<T>(endpoint, { method: 'PATCH', body }),

    delete: <T>(endpoint: string) =>
        apiFetch<T>(endpoint, { method: 'DELETE' }),
};

// ─── Auth API ───────────────────────────────────

export const authApi = {
    register: (data: { email: string; password: string; name: string; timezone?: string; locale?: string }) =>
        apiFetch<{ message: string }>('/auth/register', {
            method: 'POST',
            body: { ...data, email: data.email.trim().toLowerCase(), name: data.name.trim() },
            skipAuth: true,
        }),

    registerVenue: (data: {
        email: string;
        password: string;
        name: string;
        timezone?: string;
        locale?: string;
        venue?: {
            name: string;
            address: string;
            city: string;
            country: string;
            lat: number;
            lng: number;
            timezone: string;
            phone?: string;
            description?: string;
            shortDescription?: string;
            amenities?: string[];
            vibes?: string[];
            cuisineTags?: string[];
            priceRange?: 'BUDGET' | 'MID' | 'UPSCALE' | 'LUXURY';
            capacity?: number;
            googlePlaceId?: string;
        };
        claimVenueId?: string;
        claimNotes?: string;
        claimVerificationDocuments?: string[];
    }) =>
        apiFetch<{
            message: string;
            businessApprovalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
            venueApprovalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
            claimStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
            venue?: { id: string; name: string; slug: string };
        }>('/auth/register-venue', {
            method: 'POST',
            body: { ...data, email: data.email.trim().toLowerCase(), name: data.name.trim() },
            skipAuth: true,
        }),

    login: (data: { email: string; password: string }) =>
        apiFetch<{ accessToken: string; user: AuthUser }>('/auth/login', {
            method: 'POST',
            body: { ...data, email: data.email.trim().toLowerCase() },
            skipAuth: true,
        }),

    logout: () =>
        apiFetch<{ message: string }>('/auth/logout', { method: 'POST' }),

    logoutAll: () =>
        apiFetch<{ message: string }>('/auth/logout-all', { method: 'POST' }),

    refresh: () =>
        apiFetch<{ accessToken: string }>('/auth/refresh', { method: 'POST', skipAuth: true }),

    forgotPassword: (email: string) =>
        apiFetch<{ message: string }>('/auth/forgot-password', {
            method: 'POST',
            body: { email: email.trim().toLowerCase() },
            skipAuth: true,
        }),

    resetPassword: (data: { token: string; password: string }) =>
        apiFetch<{ message: string }>('/auth/reset-password', { method: 'POST', body: data, skipAuth: true }),

    changePassword: (data: { currentPassword: string; newPassword: string }) =>
        apiFetch<{ message: string }>('/auth/change-password', { method: 'POST', body: data }),
};

// ─── Types ──────────────────────────────────────

export interface AuthUser {
    id: string;
    email: string;
    name: string;
    role: string;
    avatarUrl?: string;
    timezone?: string;
    businessApprovalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
    businessApprovalNotes?: string | null;
}

export interface ExistingVenueMatch {
    id: string;
    name: string;
    slug: string;
    city: string;
    approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface GooglePlaceMenuItem {
    name: string;
    description?: string | null;
    price?: string | number | null;
}

export interface GooglePlaceMenuSection {
    name: string;
    description?: string | null;
    items: GooglePlaceMenuItem[];
}

export interface GooglePlaceSnapshot {
    placeId: string;
    displayName: string;
    formattedAddress?: string | null;
    addressLine1?: string | null;
    city?: string | null;
    stateProvince?: string | null;
    country?: string | null;
    postalCode?: string | null;
    lat?: string | number | null;
    lng?: string | number | null;
    timezone?: string | null;
    phone?: string | null;
    website?: string | null;
    googleMapsUrl?: string | null;
    rating?: string | number | null;
    reviewCount?: number | null;
    menu?: {
        url?: string | null;
        sections?: GooglePlaceMenuSection[];
        lastSyncedAt?: string | null;
    } | null;
}

export interface GooglePlaceSearchResult {
    placeId: string;
    name: string;
    formattedAddress?: string | null;
    city?: string | null;
    rating?: string | number | null;
    reviewCount?: number | null;
    existingVenue?: ExistingVenueMatch | null;
}

export interface GooglePlaceDetailsResponse {
    googlePlaceId: string;
    defaults: GooglePlaceSnapshot;
    existingVenue?: ExistingVenueMatch | null;
}

export interface Match {
    id: string;
    isFeatured?: boolean;
    eventFormat?: 'HEAD_TO_HEAD' | 'SINGLE_EVENT';
    eventTitle?: string | null;
    eventSubtitle?: string | null;
    homeTeamName?: string | null;
    awayTeamName?: string | null;
    homeTeamCrestUrl?: string;
    awayTeamCrestUrl?: string;
    homeScore?: number | null;
    awayScore?: number | null;
    matchDateUtc: string;
    status: string;
    matchDay?: number;
    stage?: string;
    venueName?: string;
    venueCount?: number;
    league?: {
        id: string;
        name: string;
        shortName?: string;
        logoUrl?: string;
    };
}

export interface Venue {
    id: string;
    name: string;
    slug: string;
    shortDescription?: string;
    description?: string;
    addressLine1: string;
    city: string;
    coverImageUrl?: string;
    galleryImageUrls?: string[];
    amenities: string[];
    cuisineTags: string[];
    priceRange: string;
    averageRating?: string;
    totalReviews?: number;
    ratingOverride?: string | null;
    reviewCountOverride?: number | null;
    isVerified: boolean;
    isFeatured: boolean;
    capacity?: number;
    distance?: string;
    followerCount?: number;
    isFollowing?: boolean;
    approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
    googlePlaceId?: string | null;
    menuSource?: 'NONE' | 'GOOGLE' | 'MANUAL' | null;
}

export interface BlogCategory {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    sortOrder: number;
    isActive: boolean;
}

export interface BlogPostSummary {
    id: string;
    title: string;
    slug: string;
    excerpt?: string | null;
    featuredImageUrl?: string | null;
    status: 'DRAFT' | 'PUBLISHED';
    publishedAt?: string | null;
    createdAt: string;
    updatedAt?: string;
    categoryIds?: string[];
    categories: BlogCategory[];
    authorName?: string | null;
}

export interface BlogPostDetail extends BlogPostSummary {
    contentJson?: Record<string, unknown> | null;
    contentHtml: string;
    featuredImageS3Key?: string | null;
}

export interface BlogComment {
    id: string;
    postId: string;
    content: string;
    createdAt: string;
    status?: 'PENDING' | 'APPROVED' | 'REJECTED';
    userId?: string;
    userName?: string | null;
    userAvatarUrl?: string | null;
}

export interface PresignedUpload {
    uploadUrl: string;
    publicUrl: string;
    uploadHeaders?: Record<string, string>;
    key: string;
    expiresIn: number;
}

export interface Booking {
    id: string;
    bookingReference: string;
    partySize: number;
    status: string;
    specialRequests?: string;
    createdAt: string;
    venue?: { id: string; name: string; slug?: string; address?: string; city?: string; coverImageUrl?: string };
    match?: { id: string; homeTeamName: string; awayTeamName: string; matchDateUtc: string; status?: string };
}

export interface VenueEvent {
    id: string;
    venueId: string;
    matchId: string;
    bookingLimit?: number;
    confirmedBookingsCount: number;
    specialNotes?: string;
    customPrice?: string;
    doorsOpenAt?: string;
    spotsRemaining?: number | null;
    match?: Match;
}

export interface Notification {
    id: string;
    type: string;
    title: string;
    body: string;
    actionUrl?: string;
    isRead: boolean;
    createdAt: string;
}

export const uploadApi = {
    createPresignedUrl: (data: {
        filename: string;
        contentType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
        purpose: 'avatar' | 'venue_cover' | 'venue_gallery' | 'menu_item' | 'post';
        fileSize: number;
    }) =>
        apiFetch<PresignedUpload>('/uploads/presigned-url', {
            method: 'POST',
            body: data,
        }),
};

export const placesApi = {
    search: (query: string) =>
        api.get<GooglePlaceSearchResult[]>('/places/search', { q: query.trim() }),
    details: (placeId: string) =>
        api.get<GooglePlaceDetailsResponse>('/places/details', { placeId: placeId.trim() }),
};

export const blogApi = {
    listCategories: () => api.get<BlogCategory[]>('/blog/categories'),
    listPosts: (params?: { q?: string; category?: string; page?: number; limit?: number }) =>
        api.get<BlogPostSummary[]>('/blog/posts', params),
    getPost: (slug: string) => api.get<BlogPostDetail>(`/blog/posts/${slug}`),
    listComments: (postId: string) => api.get<BlogComment[]>(`/blog/posts/${postId}/comments`),
    createComment: (postId: string, content: string) =>
        api.post<BlogComment>(`/blog/posts/${postId}/comments`, { content }),
};
