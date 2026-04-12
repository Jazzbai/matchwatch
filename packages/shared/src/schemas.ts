import { z } from 'zod';
import {
    USER_ROLES, MATCH_STATUSES, BOOKING_STATUSES,
    NOTIFICATION_TYPES, PRICE_RANGES,
} from './constants';

// ─── Auth Schemas ───────────────────────────────

export const registerSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z
        .string()
        .min(10, 'Password must be at least 10 characters')
        .regex(/[A-Z]/, 'Password must contain an uppercase letter')
        .regex(/[a-z]/, 'Password must contain a lowercase letter')
        .regex(/[0-9]/, 'Password must contain a number')
        .regex(/[^A-Za-z0-9]/, 'Password must contain a special character'),
    name: z.string().min(2).max(100),
    timezone: z.string().default('UTC'),
    locale: z.string().default('en'),
    captchaToken: z.string().min(1).optional(),
    website: z.string().optional(), // honeypot
});

export const registerVenueSchema = registerSchema.extend({
    venue: z.object({
        googlePlaceId: z.string().max(255).optional(),
        name: z.string().min(2).max(150),
        address: z.string().min(5),
        city: z.string().min(2),
        country: z.string().min(2),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        timezone: z.string(),
        phone: z.string().optional(),
        description: z.string().optional(),
        amenities: z.array(z.string().min(1).max(80)).max(60).default([]),
        vibes: z.array(z.string().min(1).max(80)).max(60).default([]),
        cuisineTags: z.array(z.string().min(1).max(80)).max(60).default([]),
        priceRange: z.enum(PRICE_RANGES).default('MID'),
        capacity: z.number().int().positive().optional(),
    }).optional(),
    claimVenueId: z.string().uuid().optional(),
    claimNotes: z.string().max(2000).optional(),
    claimVerificationDocuments: z.array(z.string().url()).max(10).default([]),
}).superRefine((value, ctx) => {
    if (!value.venue && !value.claimVenueId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['venue'],
            message: 'venue or claimVenueId is required',
        });
    }
});

export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
    deviceName: z.string().optional(),
    captchaToken: z.string().min(1).optional(),
});

export const verifyEmailSchema = z.object({
    token: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
    email: z.string().email(),
});

export const resetPasswordSchema = z.object({
    token: z.string().min(1),
    password: registerSchema.shape.password,
});

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: registerSchema.shape.password,
});

// ─── Match Schemas ──────────────────────────────

export const matchQuerySchema = z.object({
    sport_id: z.string().uuid().optional(),
    league_id: z.string().uuid().optional(),
    team_id: z.string().uuid().optional(),
    date_from: z.string().optional(),
    date_to: z.string().optional(),
    status: z.enum(MATCH_STATUSES).optional(),
    has_venues: z.coerce.boolean().optional(),
    city: z.string().optional(),
    upcoming_only: z.coerce.boolean().optional(),
    include_past: z.coerce.boolean().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    sort: z.enum(['date_asc', 'date_desc']).default('date_asc'),
});

export const matchVenueQuerySchema = z.object({
    lat: z.coerce.number().optional(),
    lng: z.coerce.number().optional(),
    radius_km: z.coerce.number().default(50),
    amenities: z.array(z.string()).optional(),
    cuisine: z.array(z.string()).optional(),
    price_range: z.array(z.enum(PRICE_RANGES)).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    sort: z.enum(['distance', 'rating', 'spots']).default('distance'),
});

// ─── Venue Schemas ──────────────────────────────

export const venueQuerySchema = z.object({
    q: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    lat: z.coerce.number().optional(),
    lng: z.coerce.number().optional(),
    radius_km: z.coerce.number().optional(),
    amenities: z.array(z.string()).optional(),
    cuisine: z.array(z.string()).optional(),
    price_range: z.array(z.enum(PRICE_RANGES)).optional(),
    is_verified: z.coerce.boolean().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    sort: z.string().optional(),
});

export const updateVenueSchema = z.object({
    googlePlaceId: z.string().max(255).optional(),
    name: z.string().min(2).max(150).optional(),
    description: z.string().optional(),
    shortDescription: z.string().max(280).optional(),
    addressLine1: z.string().optional(),
    addressLine2: z.string().optional(),
    city: z.string().optional(),
    stateProvince: z.string().optional(),
    country: z.string().optional(),
    postalCode: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    timezone: z.string().optional(),
    phone: z.string().optional(),
    website: z.string().url().optional(),
    instagramHandle: z.string().optional(),
    googleMapsUrl: z.string().url().optional(),
    capacity: z.number().int().positive().optional(),
    amenities: z.array(z.string().min(1).max(80)).max(60).optional(),
    vibes: z.array(z.string().min(1).max(80)).max(60).optional(),
    cuisineTags: z.array(z.string().min(1).max(80)).max(60).optional(),
    priceRange: z.enum(PRICE_RANGES).optional(),
    coverImageUrl: z.string().url().optional(),
    coverImageS3Key: z.string().max(500).optional(),
    galleryImageUrls: z.array(z.string().url()).max(5).optional(),
    galleryS3Keys: z.array(z.string().max(500)).max(5).optional(),
});

// ─── Booking Schemas ────────────────────────────

export const createBookingSchema = z.object({
    venueEventId: z.string().uuid(),
    partySize: z.number().int().min(1).max(20),
    specialRequests: z.string().max(500).optional(),
});

export const bookingQuerySchema = z.object({
    status: z.enum(BOOKING_STATUSES).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const updateBookingStatusSchema = z.object({
    status: z.enum(BOOKING_STATUSES),
    cancellationReason: z.string().optional(),
});

// ─── Event Schemas ──────────────────────────────

export const createEventSchema = z.object({
    matchId: z.string().uuid(),
    bookingLimit: z.number().int().positive().optional(),
    specialNotes: z.string().optional(),
    customPrice: z.number().positive().optional(),
    currency: z.string().length(3).default('USD'),
    doorsOpenAt: z.string().optional(),
    requiresApproval: z.boolean().default(false),
});

export const updateEventSchema = createEventSchema.partial();

export const createCustomVenueEventSchema = z.object({
    title: z.string().min(3).max(160),
    description: z.string().max(1000).optional(),
    eventTypeTags: z.array(z.string().min(1).max(80)).min(1).max(10),
    startsAt: z.string(),
    endsAt: z.string(),
    imageUrl: z.string().url().optional(),
    imageS3Key: z.string().max(500).optional(),
    bookingNotes: z.string().max(500).optional(),
});

export const updateCustomVenueEventSchema = createCustomVenueEventSchema.partial();

// ─── Menu Schemas ───────────────────────────────

export const createMenuCategorySchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    sortOrder: z.number().int().default(0),
});

export const createMenuItemSchema = z.object({
    categoryId: z.string().uuid(),
    name: z.string().min(1).max(150),
    description: z.string().optional(),
    price: z.number().positive(),
    currency: z.string().length(3).default('USD'),
    isAvailable: z.boolean().default(true),
    isFeatured: z.boolean().default(false),
    dietaryTags: z.array(z.string()).default([]),
    allergens: z.array(z.string()).default([]),
    sortOrder: z.number().int().default(0),
});

// ─── Post Schemas ───────────────────────────────

export const createPostSchema = z.object({
    content: z.string().min(1).max(5000),
    matchId: z.string().uuid().optional(),
    scheduledPublishAt: z.string().optional(),
});

// ─── User Schemas ───────────────────────────────

export const updateProfileSchema = z.object({
    name: z.string().min(2).max(100).optional(),
    timezone: z.string().optional(),
    locale: z.string().optional(),
    pushToken: z.string().optional(),
});

export const updateInterestsSchema = z.object({
    teamIds: z.array(z.string().uuid()),
});

// ─── Review Schemas ─────────────────────────────

export const createReviewSchema = z.object({
    rating: z.number().int().min(1).max(5),
    title: z.string().max(200).optional(),
    content: z.string().optional(),
    venueEventId: z.string().uuid().optional(),
});

// ─── Notification Schemas ───────────────────────

export const notifyFollowersSchema = z.object({
    title: z.string().min(1).max(65),
    body: z.string().min(1).max(200),
    actionUrl: z.string().url().optional(),
    postId: z.string().uuid().optional(),
});

export const readNotificationsSchema = z.object({
    ids: z.array(z.string().uuid()).optional(),
});

// ─── Upload Schema ──────────────────────────────

export const presignedUploadSchema = z.object({
    filename: z.string().min(1),
    contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
    purpose: z.enum(['avatar', 'venue_cover', 'venue_gallery', 'menu_item', 'post', 'entity_primary', 'entity_hero']),
    fileSize: z.coerce.number().int().positive().max(4 * 1024 * 1024),
});

// ─── Pagination Schema ──────────────────────────

export const paginationSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
});

// ─── Admin Schemas ──────────────────────────────

export const adminUpdateUserSchema = z.object({
    role: z.enum(USER_ROLES).optional(),
    isSuspended: z.boolean().optional(),
    suspensionReason: z.string().optional(),
});

export const adminUpdateVenueSchema = z.object({
    isVerified: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    isActive: z.boolean().optional(),
});

// ─── Type Exports ───────────────────────────────

export type RegisterInput = z.infer<typeof registerSchema>;
export type RegisterVenueInput = z.infer<typeof registerVenueSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type MatchQuery = z.infer<typeof matchQuerySchema>;
export type VenueQuery = z.infer<typeof venueQuerySchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type NotifyFollowersInput = z.infer<typeof notifyFollowersSchema>;
