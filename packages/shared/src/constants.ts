// ─── User Roles ─────────────────────────────────
export const USER_ROLES = ['USER', 'VENUE_OWNER', 'ADMIN', 'SUPER_ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

// ─── Match Status ───────────────────────────────
export const MATCH_STATUSES = [
    'SCHEDULED', 'TIMED', 'IN_PLAY', 'PAUSED',
    'FINISHED', 'POSTPONED', 'CANCELLED', 'SUSPENDED',
] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

// ─── Booking Status ─────────────────────────────
export const BOOKING_STATUSES = [
    'PENDING', 'CONFIRMED', 'CANCELLED_BY_USER',
    'CANCELLED_BY_VENUE', 'NO_SHOW',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

// ─── Notification Types ─────────────────────────
export const NOTIFICATION_TYPES = [
    'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'VENUE_POST',
    'MATCH_REMINDER', 'VENUE_NOTIFICATION', 'SYSTEM',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// ─── Venue Amenities ────────────────────────────
export const AMENITIES = [
    'TV', 'PROJECTOR', 'HOOKAH', 'VIP', 'SMOKE_FREE',
    'ALCOHOLIC', 'OUTDOOR', 'WIFI', 'PARKING',
    'FOOD', 'KIDS', 'LIVE_MUSIC', 'PRIVATE_ROOM',
] as const;
export type Amenity = (typeof AMENITIES)[number];

// ─── Cuisine Tags ───────────────────────────────
export const CUISINE_TAGS = [
    'ITALIAN', 'MEXICAN', 'CHINESE', 'JAPANESE', 'TURKISH',
    'AMERICAN', 'MIDDLE_EASTERN', 'INDIAN', 'THAI',
    'KOREAN', 'MEDITERRANEAN', 'BRAZILIAN', 'FRENCH',
    'SEAFOOD', 'BBQ', 'VEGAN', 'FAST_FOOD',
] as const;
export type CuisineTag = (typeof CUISINE_TAGS)[number];

// ─── Price Range ────────────────────────────────
export const PRICE_RANGES = ['BUDGET', 'MID', 'UPSCALE', 'LUXURY'] as const;
export type PriceRange = (typeof PRICE_RANGES)[number];

// ─── Dietary Tags ───────────────────────────────
export const DIETARY_TAGS = [
    'VEGAN', 'VEGETARIAN', 'GLUTEN_FREE', 'HALAL', 'KOSHER',
] as const;
export type DietaryTag = (typeof DIETARY_TAGS)[number];

// ─── Venue Claim Status ─────────────────────────
export const CLAIM_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

// ─── Discount Types ─────────────────────────────
export const DISCOUNT_TYPES = ['PERCENTAGE', 'FIXED', 'FREE_ITEM'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

// ─── Audit Actions ──────────────────────────────
export const AUDIT_ACTIONS = [
    'USER_LOGIN', 'USER_LOGOUT', 'USER_REGISTER',
    'BOOKING_CREATED', 'BOOKING_CANCELLED', 'BOOKING_CONFIRMED',
    'VENUE_CREATED', 'VENUE_UPDATED', 'VENUE_VERIFIED',
    'EVENT_CREATED', 'EVENT_DELETED', 'POST_CREATED',
    'NOTIFICATION_SENT', 'PASSWORD_CHANGED', 'PASSWORD_RESET',
    'ADMIN_ACTION', 'MATCH_SYNCED',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

// ─── Error Codes ────────────────────────────────
export const ERROR_CODES = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    CONFLICT: 'CONFLICT',
    RATE_LIMITED: 'RATE_LIMITED',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
    EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
    INSUFFICIENT_SPOTS: 'INSUFFICIENT_SPOTS',
    BOOKING_LIMIT_REACHED: 'BOOKING_LIMIT_REACHED',
} as const;

// ─── Seeded League Codes (Football-Data.org) ────
export const LEAGUE_CODES: Record<string, string> = {
    PL: 'Premier League',
    PD: 'La Liga',
    BL1: 'Bundesliga',
    SA: 'Serie A',
    FL1: 'Ligue 1',
    CL: 'Champions League',
    MLS: 'MLS',
};

// ─── Amenity Display ────────────────────────────
export const AMENITY_ICONS: Record<string, string> = {
    TV: 'tv',
    PROJECTOR: 'projector',
    HOOKAH: 'hookah',
    VIP: 'vip',
    SMOKE_FREE: 'smoke-free',
    ALCOHOLIC: 'bar',
    OUTDOOR: 'outdoor',
    WIFI: 'wifi',
    PARKING: 'parking',
    FOOD: 'food',
    KIDS: 'kids',
    LIVE_MUSIC: 'music',
    PRIVATE_ROOM: 'private',
};
