import { Hono } from 'hono';
import { z } from 'zod';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import os from 'os';
import { execSync } from 'child_process';
import { timingSafeEqual } from 'crypto';
import DOMPurify from 'isomorphic-dompurify';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { and, asc, count, desc, eq, gte, lte, ilike, inArray, or, sql } from 'drizzle-orm';
import { db } from '../db/client';
import {
    blogCategories,
    blogComments,
    blogPostCategories,
    blogPosts,
    bookings,
    drivers,
    entitySlugRedirects,
    entrants,
    eventEntries,
    sports,
    leagues,
    manufacturers,
    matchParticipants,
    stadiums,
    matches,
    matchPredictions,
    menuCategories,
    players,
    staticPages,
    standingsRows,
    teamRosterMembers,
    teamStadiumLinks,
    teams,
    users,
    userTeamInterests,
    venueClaims,
    venueAttributes,
    venueCustomEvents,
    venueEvents,
    venues,
} from '../db/schema';
import { apiError, apiResponse, generateUniqueSlug, paginationMeta, paginationOffset } from '../lib/utils';
import { hashPassword } from '../lib/auth';
import { authRateLimit } from '../middleware';
import { createPresignedUpload as createStoragePresignedUpload, deleteStorageObjects, STORAGE_MAX_FILE_SIZE } from '../lib/storage';
import { type GoogleSourceSnapshot } from '../lib/googlePlaces';
import {
    buildGoogleSyncUpdates,
    enrichGoogleMenuSnapshot,
    getAllowedGoogleAmenities,
    refreshVenueFromGoogle,
    sanitizeAmenities,
} from '../lib/googleVenueSync';
import { applyGoogleMenuSnapshot, buildGoogleVenueFields } from '../lib/venueOnboarding';
import { presignedUploadSchema } from '@matchwatch/shared';
import { buildEntityEnrichment, type EntityBaseRecord, type EntityEnrichmentResult, type EntityKind } from '../lib/entityEnrichment';
import { allocateCanonicalSlug } from '../lib/entitySlugs';
import { getRecommendationPreview, getRecommendations } from '../lib/entityRecommendations';
import { getLatestLeagueStandings, refreshLeagueStandingsSnapshot } from '../lib/standings';
import { getMatchPrediction, refreshMatchPrediction } from '../lib/predictions';
import { choosePreferredTeamRecord, normalizeTeamIdentity, scoreTeamIdentityRecord } from '../lib/teamIdentity';

declare module 'hono' {
    interface ContextVariableMap {
        superAdmin: {
            username: string;
        };
    }
}

const superAdminRoutes = new Hono();

const SESSION_COOKIE_NAME = 'mw_super_admin';
const SESSION_ISSUER = 'matchwatch-super-admin';
const SESSION_TTL_SECONDS = 8 * 60 * 60;

const paginationQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    search: z.string().trim().optional(),
});

const superAdminLoginSchema = z.object({
    username: z.string().trim().min(3).max(120),
    password: z.string().min(8).max(200),
});

const createUserSchema = z.object({
    email: z.string().email(),
    name: z.string().min(2).max(100),
    password: z.string().min(10).max(200),
    role: z.enum(['USER', 'VENUE_OWNER', 'BUSINESS', 'ADMIN', 'SUPER_ADMIN']).default('USER'),
});

const updateUserSchema = z.object({
    email: z.string().email().optional(),
    name: z.string().min(2).max(100).optional(),
    role: z.enum(['USER', 'VENUE_OWNER', 'BUSINESS', 'ADMIN', 'SUPER_ADMIN']).optional(),
    isActive: z.boolean().optional(),
    isSuspended: z.boolean().optional(),
    password: z.string().min(10).max(200).optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });

const reviewBusinessApprovalSchema = z.object({
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
    notes: z.string().max(2000).nullable().optional(),
});

const createSportSchema = z.object({
    name: z.string().min(2).max(80),
    slug: z.string().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    shortName: z.string().max(20).optional(),
    sortOrder: z.coerce.number().int().default(0),
    isActive: z.boolean().default(true),
});

const updateSportSchema = z.object({
    name: z.string().min(2).max(80).optional(),
    slug: z.string().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
    shortName: z.string().max(20).nullable().optional(),
    sortOrder: z.coerce.number().int().optional(),
    isActive: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });

const createLeagueSchema = z.object({
    sportId: z.string().uuid(),
    name: z.string().min(2).max(100),
    shortName: z.string().max(20).optional(),
    logoUrl: z.string().url().optional(),
    externalId: z.string().max(20).optional(),
    country: z.string().max(50).optional(),
    sortOrder: z.coerce.number().int().default(0),
    isActive: z.boolean().default(true),
});

const updateLeagueSchema = z.object({
    sportId: z.string().uuid().optional(),
    name: z.string().min(2).max(100).optional(),
    shortName: z.string().max(20).nullable().optional(),
    logoUrl: z.string().url().nullable().optional(),
    externalId: z.string().max(20).nullable().optional(),
    country: z.string().max(50).nullable().optional(),
    sortOrder: z.coerce.number().int().optional(),
    isActive: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });

const teamSearchQuerySchema = z.object({
    search: z.string().trim().default(''),
    leagueId: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(12),
    page: z.coerce.number().int().min(1).optional(),
    includeInactive: z.coerce.boolean().optional(),
});

const teamDuplicateQuerySchema = z.object({
    leagueId: z.string().uuid().optional(),
    includeInactive: z.coerce.boolean().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
});

const createTeamSchema = z.object({
    leagueId: z.string().uuid().nullable().optional(),
    primaryStadiumId: z.string().uuid().nullable().optional(),
    secondaryStadiumIds: z.array(z.string().uuid()).max(12).optional(),
    name: z.string().min(2).max(150),
    shortName: z.string().max(30).nullable().optional(),
    crestUrl: z.string().url().nullable().optional(),
    heroImageUrl: z.string().url().nullable().optional(),
    website: z.string().url().nullable().optional(),
    country: z.string().max(80).nullable().optional(),
    shortDescription: z.string().max(280).nullable().optional(),
    description: z.string().max(4000).nullable().optional(),
    aliases: z.array(z.string().max(120)).max(10).optional(),
    externalId: z.string().max(20).nullable().optional(),
    rosterMembers: z.array(z.object({
        playerId: z.string().uuid(),
        shirtNumber: z.string().max(12).nullable().optional(),
        position: z.string().max(60).nullable().optional(),
        isCaptain: z.boolean().optional(),
        sortOrder: z.coerce.number().int().optional(),
        isActive: z.boolean().optional(),
    })).max(80).optional(),
    isActive: z.boolean().default(true),
});

const updateTeamSchema = createTeamSchema.partial().refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });

const mergeTeamSchema = z.object({
    targetTeamId: z.string().uuid(),
});

const seedTeamRosterSchema = z.object({
    mode: z.enum(['merge', 'replace']).default('merge'),
});

const mergeStadiumSchema = z.object({
    targetStadiumId: z.string().uuid(),
});

const stadiumSearchQuerySchema = z.object({
    search: z.string().trim().default(''),
    limit: z.coerce.number().int().min(1).max(50).default(12),
    page: z.coerce.number().int().min(1).optional(),
    includeInactive: z.coerce.boolean().optional().default(false),
});

const createStadiumSchema = z.object({
    name: z.string().min(2).max(200),
    shortName: z.string().max(80).nullable().optional(),
    imageUrl: z.string().url().nullable().optional(),
    heroImageUrl: z.string().url().nullable().optional(),
    shortDescription: z.string().max(280).nullable().optional(),
    description: z.string().max(4000).nullable().optional(),
    website: z.string().url().nullable().optional(),
    addressLine1: z.string().max(255).nullable().optional(),
    city: z.string().max(100).nullable().optional(),
    stateProvince: z.string().max(100).nullable().optional(),
    country: z.string().max(100).nullable().optional(),
    postalCode: z.string().max(20).nullable().optional(),
    lat: z.coerce.number().min(-90).max(90).nullable().optional(),
    lng: z.coerce.number().min(-180).max(180).nullable().optional(),
    capacity: z.coerce.number().int().positive().nullable().optional(),
    openedYear: z.coerce.number().int().min(1800).max(3000).nullable().optional(),
    surface: z.string().max(80).nullable().optional(),
    aliases: z.array(z.string().max(120)).max(10).optional(),
    googlePlaceId: z.string().max(255).nullable().optional(),
    googleSourceSnapshot: z.any().optional(),
    externalId: z.string().max(50).nullable().optional(),
    isActive: z.boolean().default(true),
});

const updateStadiumSchema = createStadiumSchema.partial().refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });

const venueArraySchema = z.array(z.string().min(1).max(80)).max(60);
const galleryUrlArraySchema = z.array(z.string().url()).max(5);
const galleryKeyArraySchema = z.array(z.string().max(500)).max(5);

const createVenueSchema = z.object({
    ownerId: z.string().uuid().optional(),
    ownerEmail: z.string().email().optional(),
    name: z.string().min(2).max(150),
    slug: z.string().min(2).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
    description: z.string().max(5000).optional(),
    shortDescription: z.string().max(280).optional(),
    addressLine1: z.string().min(3).max(255),
    addressLine2: z.string().max(255).optional(),
    city: z.string().min(2).max(100),
    stateProvince: z.string().max(100).optional(),
    country: z.string().min(2).max(100),
    postalCode: z.string().max(20).optional(),
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    timezone: z.string().default('America/Chicago'),
    phone: z.string().max(30).optional(),
    website: z.string().url().optional(),
    instagramHandle: z.string().max(100).optional(),
    googleMapsUrl: z.string().url().optional(),
    googlePlaceId: z.string().max(255).nullable().optional(),
    coverImageUrl: z.string().url().optional(),
    coverImageS3Key: z.string().max(500).optional(),
    galleryImageUrls: galleryUrlArraySchema.optional(),
    galleryS3Keys: galleryKeyArraySchema.optional(),
    amenities: venueArraySchema.default([]),
    vibes: venueArraySchema.default([]),
    cuisineTags: venueArraySchema.default([]),
    priceRange: z.enum(['BUDGET', 'MID', 'UPSCALE', 'LUXURY']).default('MID'),
    capacity: z.coerce.number().int().positive().optional(),
    approvalStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED']).default('PENDING'),
    approvalNotes: z.string().max(2000).optional(),
    isVerified: z.boolean().default(false),
    isActive: z.boolean().default(true),
    isFeatured: z.boolean().default(false),
}).superRefine((value, ctx) => {
    if (!value.ownerId && !value.ownerEmail?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'ownerId or ownerEmail is required', path: ['ownerId'] });
    }
});

const updateVenueSchema = z.object({
    ownerId: z.string().uuid().optional(),
    name: z.string().min(2).max(150).optional(),
    slug: z.string().min(2).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
    description: z.string().max(5000).nullable().optional(),
    shortDescription: z.string().max(280).nullable().optional(),
    addressLine1: z.string().min(3).max(255).optional(),
    addressLine2: z.string().max(255).nullable().optional(),
    city: z.string().min(2).max(100).optional(),
    stateProvince: z.string().max(100).nullable().optional(),
    country: z.string().min(2).max(100).optional(),
    postalCode: z.string().max(20).nullable().optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    timezone: z.string().min(3).max(50).optional(),
    phone: z.string().max(30).nullable().optional(),
    website: z.string().url().nullable().optional(),
    instagramHandle: z.string().max(100).nullable().optional(),
    googleMapsUrl: z.string().url().nullable().optional(),
    coverImageUrl: z.string().url().nullable().optional(),
    coverImageS3Key: z.string().max(500).nullable().optional(),
    galleryImageUrls: galleryUrlArraySchema.optional(),
    galleryS3Keys: galleryKeyArraySchema.optional(),
    amenities: venueArraySchema.optional(),
    vibes: venueArraySchema.optional(),
    cuisineTags: venueArraySchema.optional(),
    isVerified: z.boolean().optional(),
    isActive: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    priceRange: z.enum(['BUDGET', 'MID', 'UPSCALE', 'LUXURY']).optional(),
    capacity: z.coerce.number().int().positive().nullable().optional(),
    ratingOverride: z.coerce.number().min(0).max(5).nullable().optional(),
    reviewCountOverride: z.coerce.number().int().min(0).nullable().optional(),
    googlePlaceId: z.string().max(255).nullable().optional(),
    approvalStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
    approvalNotes: z.string().max(2000).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });

const reviewVenueApprovalSchema = z.object({
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
    notes: z.string().max(2000).nullable().optional(),
    isVerified: z.boolean().optional(),
});

const reviewVenueClaimSchema = z.object({
    status: z.enum(['APPROVED', 'REJECTED']),
    adminNotes: z.string().max(2000).nullable().optional(),
});

const revertVenueGoogleSchema = z.object({
    includeMenu: z.boolean().default(false),
});

const createBlogCategorySchema = z.object({
    name: z.string().min(2).max(120),
    slug: z.string().max(160).optional(),
    description: z.string().max(500).optional(),
    sortOrder: z.coerce.number().int().default(0),
    isActive: z.boolean().default(true),
});

const updateBlogCategorySchema = z.object({
    name: z.string().min(2).max(120).optional(),
    slug: z.string().max(160).optional(),
    description: z.string().max(500).nullable().optional(),
    sortOrder: z.coerce.number().int().optional(),
    isActive: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });

const createBlogPostSchema = z.object({
    title: z.string().min(3).max(200),
    slug: z.string().max(220).optional(),
    excerpt: z.string().max(500).nullable().optional(),
    featuredImageUrl: z.string().url().nullable().optional(),
    featuredImageS3Key: z.string().max(500).nullable().optional(),
    contentJson: z.any().optional(),
    renderedHtml: z.string().default(''),
    status: z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT'),
    publishedAt: z.string().datetime().nullable().optional(),
    categoryIds: z.array(z.string().uuid()).default([]),
});

const updateBlogPostSchema = z.object({
    title: z.string().min(3).max(200).optional(),
    slug: z.string().max(220).optional(),
    excerpt: z.string().max(500).nullable().optional(),
    featuredImageUrl: z.string().url().nullable().optional(),
    featuredImageS3Key: z.string().max(500).nullable().optional(),
    contentJson: z.any().optional(),
    renderedHtml: z.string().optional(),
    status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
    publishedAt: z.string().datetime().nullable().optional(),
    categoryIds: z.array(z.string().uuid()).optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });

const updateBlogCommentSchema = z.object({
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
});

const venueAttributeQuerySchema = z.object({
    type: z.enum(['AMENITY', 'VIBE', 'CUISINE']).optional(),
    search: z.string().trim().optional(),
    includeInactive: z.coerce.boolean().default(false),
});

const createVenueAttributeSchema = z.object({
    type: z.enum(['AMENITY', 'VIBE', 'CUISINE']),
    label: z.string().min(1).max(80),
    slug: z.string().max(80).optional(),
    sortOrder: z.coerce.number().int().default(0),
    isActive: z.boolean().default(true),
});

const updateVenueAttributeSchema = z.object({
    label: z.string().min(1).max(80).optional(),
    slug: z.string().max(80).optional(),
    sortOrder: z.coerce.number().int().optional(),
    isActive: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });

const createMatchEventSchema = z.object({
    venueId: z.string().uuid(),
    matchId: z.string().uuid(),
    bookingLimit: z.coerce.number().int().positive().optional(),
    specialNotes: z.string().max(2000).optional(),
    customPrice: z.coerce.number().nonnegative().optional(),
    currency: z.string().length(3).default('USD'),
    doorsOpenAt: z.string().datetime().optional(),
    requiresApproval: z.boolean().default(false),
});

const updateMatchEventSchema = z.object({
    isActive: z.boolean().optional(),
    bookingLimit: z.coerce.number().int().positive().nullable().optional(),
    specialNotes: z.string().max(2000).nullable().optional(),
    customPrice: z.coerce.number().nonnegative().nullable().optional(),
    currency: z.string().length(3).optional(),
    doorsOpenAt: z.string().datetime().nullable().optional(),
    requiresApproval: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });

const createCustomEventSchema = z.object({
    venueId: z.string().uuid(),
    title: z.string().min(3).max(160),
    description: z.string().max(5000).optional(),
    eventTypeTags: z.array(z.string().max(50)).max(12).default([]),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    imageUrl: z.string().url().optional(),
    imageS3Key: z.string().optional(),
    bookingNotes: z.string().max(2000).optional(),
});

const updateCustomEventSchema = z.object({
    title: z.string().min(3).max(160).optional(),
    description: z.string().max(5000).nullable().optional(),
    eventTypeTags: z.array(z.string().max(50)).max(12).optional(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    imageUrl: z.string().url().nullable().optional(),
    imageS3Key: z.string().nullable().optional(),
    bookingNotes: z.string().max(2000).nullable().optional(),
    isActive: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });

const createMatchSchema = z.object({
    isFeatured: z.boolean().default(false),
    eventFormat: z.enum(['HEAD_TO_HEAD', 'SINGLE_EVENT']).default('HEAD_TO_HEAD'),
    eventTitle: z.string().max(200).nullable().optional(),
    eventSubtitle: z.string().max(200).nullable().optional(),
    leagueId: z.string().uuid().nullable().optional(),
    homeTeamId: z.string().uuid().nullable().optional(),
    awayTeamId: z.string().uuid().nullable().optional(),
    stadiumId: z.string().uuid().nullable().optional(),
    homeTeamName: z.string().min(2).max(150).optional(),
    awayTeamName: z.string().min(2).max(150).optional(),
    homeTeamCrestUrl: z.string().url().nullable().optional(),
    awayTeamCrestUrl: z.string().url().nullable().optional(),
    matchDateUtc: z.string().datetime(),
    status: z.enum(['SCHEDULED', 'TIMED', 'IN_PLAY', 'PAUSED', 'FINISHED', 'POSTPONED', 'CANCELLED', 'SUSPENDED']).default('SCHEDULED'),
    matchDay: z.coerce.number().int().nullable().optional(),
    stage: z.string().max(50).nullable().optional(),
    venueName: z.string().max(200).nullable().optional(),
    externalMatchId: z.string().max(50).optional(),
}).superRefine((value, ctx) => {
    if (value.eventFormat === 'SINGLE_EVENT') {
        if (!value.eventTitle?.trim()) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Event title is required', path: ['eventTitle'] });
        }
    } else {
        if (!value.homeTeamId && !value.homeTeamName?.trim()) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Home team is required', path: ['homeTeamName'] });
        }
        if (!value.awayTeamId && !value.awayTeamName?.trim()) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Away team is required', path: ['awayTeamName'] });
        }
        if (value.homeTeamId && value.awayTeamId && value.homeTeamId === value.awayTeamId) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Home and away teams must be different', path: ['awayTeamId'] });
        }
    }
});

const updateMatchSchema = z.object({
    isFeatured: z.boolean().optional(),
    eventFormat: z.enum(['HEAD_TO_HEAD', 'SINGLE_EVENT']).optional(),
    eventTitle: z.string().max(200).nullable().optional(),
    eventSubtitle: z.string().max(200).nullable().optional(),
    leagueId: z.string().uuid().nullable().optional(),
    homeTeamId: z.string().uuid().nullable().optional(),
    awayTeamId: z.string().uuid().nullable().optional(),
    stadiumId: z.string().uuid().nullable().optional(),
    homeTeamName: z.string().min(2).max(150).optional(),
    awayTeamName: z.string().min(2).max(150).optional(),
    homeTeamCrestUrl: z.string().url().nullable().optional(),
    awayTeamCrestUrl: z.string().url().nullable().optional(),
    matchDateUtc: z.string().datetime().optional(),
    status: z.enum(['SCHEDULED', 'TIMED', 'IN_PLAY', 'PAUSED', 'FINISHED', 'POSTPONED', 'CANCELLED', 'SUSPENDED']).optional(),
    matchDay: z.coerce.number().int().nullable().optional(),
    stage: z.string().max(50).nullable().optional(),
    venueName: z.string().max(200).nullable().optional(),
    externalMatchId: z.string().max(50).nullable().optional(),
}).superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'At least one field is required' });
    }
    if (value.homeTeamId && value.awayTeamId && value.homeTeamId === value.awayTeamId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Home and away teams must be different', path: ['awayTeamId'] });
    }
});

const motorsportEntryStatusSchema = z.enum(['ENTERED', 'ACTIVE', 'FINISHED', 'DNF', 'DNS', 'DSQ', 'WITHDRAWN']);

const motorsportEntryQuerySchema = paginationQuerySchema.extend({
    matchId: z.string().uuid().optional(),
});

const createMotorsportEntrySchema = z.object({
    matchId: z.string().uuid(),
    externalId: z.string().max(120).optional(),
    carNumber: z.string().max(20).optional(),
    driverId: z.string().uuid().nullable().optional(),
    driverName: z.string().min(2).max(150).optional(),
    driverShortName: z.string().max(60).optional(),
    driverNationality: z.string().max(80).optional(),
    driverCountryCode: z.string().max(3).optional(),
    driverHeadshotUrl: z.string().url().optional(),
    entrantId: z.string().uuid().nullable().optional(),
    entrantName: z.string().min(2).max(150).optional(),
    entrantShortName: z.string().max(60).optional(),
    entrantBrandColor: z.string().max(20).optional(),
    entrantLogoUrl: z.string().url().optional(),
    manufacturerId: z.string().uuid().nullable().optional(),
    manufacturerName: z.string().min(2).max(150).optional(),
    manufacturerShortName: z.string().max(60).optional(),
    manufacturerLogoUrl: z.string().url().optional(),
    displayName: z.string().max(200).optional(),
    gridPosition: z.coerce.number().int().nullable().optional(),
    startPosition: z.coerce.number().int().nullable().optional(),
    finishPosition: z.coerce.number().int().nullable().optional(),
    status: motorsportEntryStatusSchema.default('ENTERED'),
    points: z.union([z.coerce.number(), z.string()]).nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
}).superRefine((value, ctx) => {
    if (!value.driverId && !value.driverName?.trim() && !value.displayName?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Driver name or display name is required', path: ['driverName'] });
    }
});

const updateMotorsportEntrySchema = z.object({
    matchId: z.string().uuid().optional(),
    externalId: z.string().max(120).nullable().optional(),
    carNumber: z.string().max(20).nullable().optional(),
    driverId: z.string().uuid().nullable().optional(),
    driverName: z.string().min(2).max(150).optional(),
    driverShortName: z.string().max(60).nullable().optional(),
    driverNationality: z.string().max(80).nullable().optional(),
    driverCountryCode: z.string().max(3).nullable().optional(),
    driverHeadshotUrl: z.string().url().nullable().optional(),
    entrantId: z.string().uuid().nullable().optional(),
    entrantName: z.string().min(2).max(150).optional(),
    entrantShortName: z.string().max(60).nullable().optional(),
    entrantBrandColor: z.string().max(20).nullable().optional(),
    entrantLogoUrl: z.string().url().nullable().optional(),
    manufacturerId: z.string().uuid().nullable().optional(),
    manufacturerName: z.string().min(2).max(150).optional(),
    manufacturerShortName: z.string().max(60).nullable().optional(),
    manufacturerLogoUrl: z.string().url().nullable().optional(),
    displayName: z.string().max(200).nullable().optional(),
    gridPosition: z.coerce.number().int().nullable().optional(),
    startPosition: z.coerce.number().int().nullable().optional(),
    finishPosition: z.coerce.number().int().nullable().optional(),
    status: motorsportEntryStatusSchema.optional(),
    points: z.union([z.coerce.number(), z.string()]).nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });

const matchImportSchema = z.object({
    csv: z.string().min(1),
    dryRun: z.boolean().default(false),
});

const matchImportRowSchema = z.object({
    homeTeamName: z.string().min(2),
    awayTeamName: z.string().min(2),
    matchDateUtc: z.string().datetime(),
    status: z.enum(['SCHEDULED', 'TIMED', 'IN_PLAY', 'PAUSED', 'FINISHED', 'POSTPONED', 'CANCELLED', 'SUSPENDED']).optional().default('SCHEDULED'),
    leagueId: z.string().uuid().optional(),
    leagueName: z.string().optional(),
    stage: z.string().optional(),
    venueName: z.string().optional(),
    externalMatchId: z.string().max(50).optional(),
});

function parseCsvLine(line: string): string[] {
    const out: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }
        if (ch === ',' && !inQuotes) {
            out.push(current.trim());
            current = '';
            continue;
        }
        current += ch;
    }
    out.push(current.trim());
    return out;
}

function parseCsvRows(csv: string): Array<Record<string, string>> {
    const lines = csv
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    if (lines.length < 2) return [];

    const headers = parseCsvLine(lines[0]).map((value) => value.trim());
    const rows: Array<Record<string, string>> = [];
    for (let idx = 1; idx < lines.length; idx += 1) {
        const cols = parseCsvLine(lines[idx]);
        const row: Record<string, string> = {};
        for (let c = 0; c < headers.length; c += 1) {
            row[headers[c]] = cols[c] ?? '';
        }
        rows.push(row);
    }
    return rows;
}

function slugifyValue(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
}

function sanitizeGalleryUrls(values?: string[] | null) {
    return (values || []).map((value) => value.trim()).filter(Boolean).slice(0, 5);
}

function sanitizeGalleryKeys(values?: string[] | null) {
    return (values || []).map((value) => value.trim()).filter(Boolean).slice(0, 5);
}

function sanitizeBlogHtml(value?: string | null) {
    return DOMPurify.sanitize(value || '');
}

async function syncBlogPostCategoryIds(postId: string, categoryIds: string[]) {
    await db.delete(blogPostCategories).where(eq(blogPostCategories.postId, postId));
    if (categoryIds.length === 0) return;
    await db.insert(blogPostCategories).values(categoryIds.map((categoryId) => ({
        postId,
        categoryId,
    })));
}

async function resolveVenueOwner(ownerId?: string, ownerEmail?: string) {
    if (ownerId) {
        const [owner] = await db.select({
            id: users.id,
            email: users.email,
            role: users.role,
        }).from(users).where(eq(users.id, ownerId)).limit(1);
        return owner ?? null;
    }

    if (ownerEmail?.trim()) {
        const [owner] = await db.select({
            id: users.id,
            email: users.email,
            role: users.role,
        }).from(users).where(eq(users.email, ownerEmail.trim().toLowerCase())).limit(1);
        return owner ?? null;
    }

    return null;
}

async function getTeamById(teamId: string) {
    const [team] = await db.select({
        id: teams.id,
        leagueId: teams.leagueId,
        name: teams.name,
        shortName: teams.shortName,
        crestUrl: teams.crestUrl,
        sportId: leagues.sportId,
    }).from(teams)
        .leftJoin(leagues, eq(teams.leagueId, leagues.id))
        .where(and(eq(teams.id, teamId), eq(teams.isActive, true)))
        .limit(1);
    return team ?? null;
}

async function getLeagueById(leagueId: string) {
    const [league] = await db.select({
        id: leagues.id,
        sportId: leagues.sportId,
        name: leagues.name,
    }).from(leagues).where(and(eq(leagues.id, leagueId), eq(leagues.isActive, true))).limit(1);
    return league ?? null;
}

async function getStadiumById(stadiumId: string) {
    const [stadium] = await db.select({
        id: stadiums.id,
        name: stadiums.name,
        city: stadiums.city,
        country: stadiums.country,
    }).from(stadiums).where(and(eq(stadiums.id, stadiumId), eq(stadiums.isActive, true))).limit(1);
    return stadium ?? null;
}

async function buildMatchValues(input: z.infer<typeof createMatchSchema> | z.infer<typeof updateMatchSchema>) {
    const eventFormat = input.eventFormat || 'HEAD_TO_HEAD';
    const homeTeamId = input.homeTeamId === undefined ? undefined : (input.homeTeamId || null);
    const awayTeamId = input.awayTeamId === undefined ? undefined : (input.awayTeamId || null);
    const stadiumId = input.stadiumId === undefined ? undefined : (input.stadiumId || null);
    const leagueId = input.leagueId === undefined ? undefined : (input.leagueId || null);

    const league = leagueId ? await getLeagueById(leagueId) : null;
    if (leagueId && !league) {
        return { error: apiError('NOT_FOUND', 'League not found'), status: 404 as const };
    }

    const homeTeam = homeTeamId ? await getTeamById(homeTeamId) : null;
    if (homeTeamId && !homeTeam) {
        return { error: apiError('NOT_FOUND', 'Home team not found'), status: 404 as const };
    }

    const awayTeam = awayTeamId ? await getTeamById(awayTeamId) : null;
    if (awayTeamId && !awayTeam) {
        return { error: apiError('NOT_FOUND', 'Away team not found'), status: 404 as const };
    }

    if (homeTeam?.id && awayTeam?.id && homeTeam.id === awayTeam.id) {
        return { error: apiError('VALIDATION_ERROR', 'Home and away teams must be different'), status: 400 as const };
    }

    if (league?.sportId) {
        if (homeTeam?.sportId && homeTeam.sportId !== league.sportId) {
            return { error: apiError('VALIDATION_ERROR', 'Home team does not belong to the same sport as the selected league'), status: 400 as const };
        }
        if (awayTeam?.sportId && awayTeam.sportId !== league.sportId) {
            return { error: apiError('VALIDATION_ERROR', 'Away team does not belong to the same sport as the selected league'), status: 400 as const };
        }
    }

    const stadium = stadiumId ? await getStadiumById(stadiumId) : null;
    if (stadiumId && !stadium) {
        return { error: apiError('NOT_FOUND', 'Stadium not found'), status: 404 as const };
    }

    const homeTeamName = homeTeam?.name ?? input.homeTeamName?.trim();
    const awayTeamName = awayTeam?.name ?? input.awayTeamName?.trim();
    const venueName = stadium?.name ?? (input.venueName === null ? null : input.venueName?.trim() || undefined);

    if (eventFormat === 'HEAD_TO_HEAD' && homeTeamName && awayTeamName && homeTeamName.localeCompare(awayTeamName, undefined, { sensitivity: 'accent' }) === 0) {
        return { error: apiError('VALIDATION_ERROR', 'Home and away teams must be different'), status: 400 as const };
    }

    return {
        values: {
            isFeatured: input.isFeatured,
            eventFormat,
            eventTitle: input.eventTitle === undefined ? undefined : (input.eventTitle?.trim() || null),
            eventSubtitle: input.eventSubtitle === undefined ? undefined : (input.eventSubtitle?.trim() || null),
            leagueId,
            homeTeamId: eventFormat === 'HEAD_TO_HEAD' ? homeTeamId : null,
            awayTeamId: eventFormat === 'HEAD_TO_HEAD' ? awayTeamId : null,
            stadiumId,
            homeTeamName: eventFormat === 'HEAD_TO_HEAD' ? (homeTeamName || null) : null,
            awayTeamName: eventFormat === 'HEAD_TO_HEAD' ? (awayTeamName || null) : null,
            homeTeamCrestUrl: eventFormat === 'HEAD_TO_HEAD'
                ? (homeTeam?.crestUrl ?? (input.homeTeamCrestUrl !== undefined ? input.homeTeamCrestUrl : input.homeTeamId !== undefined || input.homeTeamName !== undefined ? null : undefined))
                : null,
            awayTeamCrestUrl: eventFormat === 'HEAD_TO_HEAD'
                ? (awayTeam?.crestUrl ?? (input.awayTeamCrestUrl !== undefined ? input.awayTeamCrestUrl : input.awayTeamId !== undefined || input.awayTeamName !== undefined ? null : undefined))
                : null,
            matchDateUtc: input.matchDateUtc ? new Date(input.matchDateUtc) : undefined,
            status: input.status,
            matchDay: input.matchDay === undefined ? undefined : (input.matchDay || null),
            stage: input.stage === undefined ? undefined : (input.stage || null),
            venueName,
            externalMatchId: input.externalMatchId === undefined ? undefined : (input.externalMatchId || null),
        },
    };
}

async function getMatchById(matchId: string) {
    const [match] = await db.select({
        id: matches.id,
        leagueId: matches.leagueId,
        eventFormat: matches.eventFormat,
    }).from(matches).where(eq(matches.id, matchId)).limit(1);
    return match ?? null;
}

async function resolveDriver(values: {
    driverId?: string | null;
    driverName?: string | null;
    driverShortName?: string | null;
    driverNationality?: string | null;
    driverCountryCode?: string | null;
    driverHeadshotUrl?: string | null;
}) {
    if (values.driverId) {
        const [driver] = await db.select({ id: drivers.id }).from(drivers).where(eq(drivers.id, values.driverId)).limit(1);
        return driver?.id ?? null;
    }

    const driverName = values.driverName?.trim();
    if (!driverName) return null;

    const [existing] = await db.select({ id: drivers.id })
        .from(drivers)
        .where(ilike(drivers.name, driverName))
        .limit(1);
    if (existing) return existing.id;

    const slug = await allocateCanonicalSlug('driver', driverName, { shortName: values.driverShortName?.trim() || null });
    const [created] = await db.insert(drivers).values({
        name: driverName,
        slug,
        shortName: values.driverShortName?.trim() || null,
        nationality: values.driverNationality?.trim() || null,
        countryCode: values.driverCountryCode?.trim().toUpperCase() || null,
        headshotUrl: values.driverHeadshotUrl?.trim() || null,
    }).returning({ id: drivers.id });
    return created?.id ?? null;
}

async function resolveEntrant(leagueId: string | null | undefined, values: {
    entrantId?: string | null;
    entrantName?: string | null;
    entrantShortName?: string | null;
    entrantBrandColor?: string | null;
    entrantLogoUrl?: string | null;
}) {
    if (values.entrantId) {
        const [entrant] = await db.select({ id: entrants.id }).from(entrants).where(eq(entrants.id, values.entrantId)).limit(1);
        return entrant?.id ?? null;
    }

    const entrantName = values.entrantName?.trim();
    if (!entrantName) return null;

    const [existing] = await db.select({ id: entrants.id })
        .from(entrants)
        .where(and(
            ilike(entrants.name, entrantName),
            leagueId ? eq(entrants.leagueId, leagueId) : sql`true`,
        ))
        .limit(1);
    if (existing) return existing.id;

    const slug = await allocateCanonicalSlug('entrant', entrantName, { shortName: values.entrantShortName?.trim() || null });
    const [created] = await db.insert(entrants).values({
        leagueId: leagueId ?? null,
        name: entrantName,
        slug,
        shortName: values.entrantShortName?.trim() || null,
        brandColor: values.entrantBrandColor?.trim() || null,
        logoUrl: values.entrantLogoUrl?.trim() || null,
    }).returning({ id: entrants.id });
    return created?.id ?? null;
}

async function resolveManufacturer(leagueId: string | null | undefined, values: {
    manufacturerId?: string | null;
    manufacturerName?: string | null;
    manufacturerShortName?: string | null;
    manufacturerLogoUrl?: string | null;
}) {
    if (values.manufacturerId) {
        const [manufacturer] = await db.select({ id: manufacturers.id }).from(manufacturers).where(eq(manufacturers.id, values.manufacturerId)).limit(1);
        return manufacturer?.id ?? null;
    }

    const manufacturerName = values.manufacturerName?.trim();
    if (!manufacturerName) return null;

    const [existing] = await db.select({ id: manufacturers.id })
        .from(manufacturers)
        .where(and(
            ilike(manufacturers.name, manufacturerName),
            leagueId ? eq(manufacturers.leagueId, leagueId) : sql`true`,
        ))
        .limit(1);
    if (existing) return existing.id;

    const slug = await allocateCanonicalSlug('manufacturer', manufacturerName, { shortName: values.manufacturerShortName?.trim() || null });
    const [created] = await db.insert(manufacturers).values({
        leagueId: leagueId ?? null,
        name: manufacturerName,
        slug,
        shortName: values.manufacturerShortName?.trim() || null,
        logoUrl: values.manufacturerLogoUrl?.trim() || null,
    }).returning({ id: manufacturers.id });
    return created?.id ?? null;
}

function normalizeEntryPoints(points: string | number | null | undefined) {
    if (points === undefined) return undefined;
    if (points === null || points === '') return null;
    const numeric = typeof points === 'number' ? points : Number(points);
    return Number.isFinite(numeric) ? numeric.toFixed(2) : null;
}

async function buildMotorsportEntryValues(input: z.infer<typeof createMotorsportEntrySchema> | z.infer<typeof updateMotorsportEntrySchema>, existingMatchId?: string) {
    const matchId = input.matchId ?? existingMatchId;
    if (!matchId) {
        return { error: apiError('VALIDATION_ERROR', 'Match is required'), status: 400 as const };
    }

    const match = await getMatchById(matchId);
    if (!match) {
        return { error: apiError('NOT_FOUND', 'Match not found'), status: 404 as const };
    }
    if (match.eventFormat !== 'SINGLE_EVENT') {
        return { error: apiError('VALIDATION_ERROR', 'Motorsport entries can only be attached to SINGLE_EVENT matches'), status: 400 as const };
    }

    const [driverId, entrantId, manufacturerId] = await Promise.all([
        resolveDriver({
            driverId: input.driverId ?? null,
            driverName: 'driverName' in input ? input.driverName ?? null : null,
            driverShortName: 'driverShortName' in input ? input.driverShortName ?? null : null,
            driverNationality: 'driverNationality' in input ? input.driverNationality ?? null : null,
            driverCountryCode: 'driverCountryCode' in input ? input.driverCountryCode ?? null : null,
            driverHeadshotUrl: 'driverHeadshotUrl' in input ? input.driverHeadshotUrl ?? null : null,
        }),
        resolveEntrant(match.leagueId, {
            entrantId: input.entrantId ?? null,
            entrantName: 'entrantName' in input ? input.entrantName ?? null : null,
            entrantShortName: 'entrantShortName' in input ? input.entrantShortName ?? null : null,
            entrantBrandColor: 'entrantBrandColor' in input ? input.entrantBrandColor ?? null : null,
            entrantLogoUrl: 'entrantLogoUrl' in input ? input.entrantLogoUrl ?? null : null,
        }),
        resolveManufacturer(match.leagueId, {
            manufacturerId: input.manufacturerId ?? null,
            manufacturerName: 'manufacturerName' in input ? input.manufacturerName ?? null : null,
            manufacturerShortName: 'manufacturerShortName' in input ? input.manufacturerShortName ?? null : null,
            manufacturerLogoUrl: 'manufacturerLogoUrl' in input ? input.manufacturerLogoUrl ?? null : null,
        }),
    ]);

    return {
        values: {
            matchId: match.id,
            externalId: input.externalId === undefined ? undefined : (input.externalId?.trim() || null),
            carNumber: input.carNumber === undefined ? undefined : (input.carNumber?.trim() || null),
            driverId,
            entrantId,
            manufacturerId,
            displayName: input.displayName === undefined ? undefined : (input.displayName?.trim() || null),
            gridPosition: input.gridPosition === undefined ? undefined : (input.gridPosition ?? null),
            startPosition: input.startPosition === undefined ? undefined : (input.startPosition ?? null),
            finishPosition: input.finishPosition === undefined ? undefined : (input.finishPosition ?? null),
            status: input.status,
            points: normalizeEntryPoints(input.points),
            metadata: input.metadata === undefined ? undefined : (input.metadata ?? null),
        },
    };
}

async function listMotorsportEntries(where?: ReturnType<typeof and> | ReturnType<typeof eq>) {
    return db.select({
        id: eventEntries.id,
        matchId: eventEntries.matchId,
        externalId: eventEntries.externalId,
        carNumber: eventEntries.carNumber,
        displayName: eventEntries.displayName,
        gridPosition: eventEntries.gridPosition,
        startPosition: eventEntries.startPosition,
        finishPosition: eventEntries.finishPosition,
        status: eventEntries.status,
        points: eventEntries.points,
        metadata: eventEntries.metadata,
        matchEventTitle: matches.eventTitle,
        matchEventSubtitle: matches.eventSubtitle,
        matchHomeTeamName: matches.homeTeamName,
        matchAwayTeamName: matches.awayTeamName,
        driverId: drivers.id,
        driverName: drivers.name,
        driverShortName: drivers.shortName,
        driverNationality: drivers.nationality,
        driverCountryCode: drivers.countryCode,
        driverHeadshotUrl: drivers.headshotUrl,
        entrantId: entrants.id,
        entrantName: entrants.name,
        entrantShortName: entrants.shortName,
        entrantBrandColor: entrants.brandColor,
        entrantLogoUrl: entrants.logoUrl,
        manufacturerId: manufacturers.id,
        manufacturerName: manufacturers.name,
        manufacturerShortName: manufacturers.shortName,
        manufacturerLogoUrl: manufacturers.logoUrl,
    })
        .from(eventEntries)
        .innerJoin(matches, eq(eventEntries.matchId, matches.id))
        .leftJoin(drivers, eq(eventEntries.driverId, drivers.id))
        .leftJoin(entrants, eq(eventEntries.entrantId, entrants.id))
        .leftJoin(manufacturers, eq(eventEntries.manufacturerId, manufacturers.id))
        .where(where)
        .orderBy(
            desc(matches.matchDateUtc),
            sql`coalesce(${eventEntries.startPosition}, ${eventEntries.gridPosition}, 9999)`,
            asc(eventEntries.carNumber),
            asc(drivers.name),
        );
}

function galleryImageUrlsFromMetadata(metadata: unknown): string[] {
    if (!metadata || typeof metadata !== 'object') return [];
    const raw = (metadata as Record<string, unknown>).galleryImageUrls;
    if (!Array.isArray(raw)) return [];
    return raw
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean);
}

function metadataRecord(metadata: unknown): Record<string, unknown> {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
    return metadata as Record<string, unknown>;
}

function normalizeVenueModerationState<T extends {
    approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
    isActive?: boolean;
}>(
    input: T,
    fallbackApprovalStatus: 'PENDING' | 'APPROVED' | 'REJECTED' = 'PENDING',
    fallbackIsActive = false,
) {
    const approvalStatus = input.approvalStatus ?? fallbackApprovalStatus;
    const requestedIsActive = input.isActive ?? fallbackIsActive;
    return {
        approvalStatus,
        isActive: approvalStatus === 'APPROVED' ? requestedIsActive : false,
    };
}

function formatVenueMutationError(error: unknown) {
    const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code || '') : '';
    const message = typeof error === 'object' && error && 'message' in error ? String((error as { message?: unknown }).message || '') : '';
    const detail = `${code} ${message}`.toLowerCase();

    if (code === '23505' || detail.includes('duplicate key')) {
        if (detail.includes('google_place')) {
            return { status: 409 as const, body: apiError('CONFLICT', 'Google Place ID is already linked to another venue') };
        }
        if (detail.includes('slug')) {
            return { status: 409 as const, body: apiError('CONFLICT', 'Venue slug already exists') };
        }
        return { status: 409 as const, body: apiError('CONFLICT', 'Venue update conflicts with an existing record') };
    }

    return { status: 500 as const, body: apiError('INTERNAL_ERROR', 'Failed to save venue') };
}

const deleteUploadSchema = z.object({
    keys: z.array(z.string().min(1).max(500)).min(1).max(20),
});

function normalizeStorageKey(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeStorageKeys(values: unknown) {
    if (!Array.isArray(values)) return [] as string[];
    return values
        .map((value) => normalizeStorageKey(value))
        .filter((value): value is string => Boolean(value));
}

async function cleanupRemovedVenueMedia(params: {
    previousCoverKey?: string | null;
    previousGalleryKeys?: string[] | null;
    nextCoverKey?: string | null;
    nextGalleryKeys?: string[] | null;
}) {
    const removedKeys = new Set<string>();
    const previousCoverKey = normalizeStorageKey(params.previousCoverKey);
    const nextCoverKey = normalizeStorageKey(params.nextCoverKey);

    if (previousCoverKey && previousCoverKey !== nextCoverKey) {
        removedKeys.add(previousCoverKey);
    }

    const nextGalleryKeySet = new Set(normalizeStorageKeys(params.nextGalleryKeys));
    for (const key of normalizeStorageKeys(params.previousGalleryKeys)) {
        if (!nextGalleryKeySet.has(key)) {
            removedKeys.add(key);
        }
    }

    if (removedKeys.size === 0) return;

    try {
        await deleteStorageObjects(Array.from(removedKeys));
    } catch {
        // Best effort cleanup only. Keep DB update successful even if object deletion fails.
    }
}

function mapVenueRow(row: {
    id: string;
    ownerId: string;
    ownerEmail?: string | null;
    ownerName?: string | null;
    name: string;
    slug: string;
    description?: string | null;
    descriptionSource?: 'NONE' | 'GOOGLE' | 'MANUAL' | null;
    shortDescription?: string | null;
    shortDescriptionSource?: 'NONE' | 'GOOGLE' | 'MANUAL' | null;
    addressLine1: string;
    addressLine2?: string | null;
    city: string;
    stateProvince?: string | null;
    country: string;
    postalCode?: string | null;
    lat: string | number;
    lng: string | number;
    timezone: string;
    coverImageUrl?: string | null;
    coverImageS3Key?: string | null;
    galleryS3Keys?: string[] | null;
    phone?: string | null;
    website?: string | null;
    instagramHandle?: string | null;
    googleMapsUrl?: string | null;
    googlePlaceId?: string | null;
    approvalStatus?: string | null;
    approvalNotes?: string | null;
    menuSource?: string | null;
    capacity?: number | null;
    amenities: string[];
    vibes: string[];
    cuisineTags: string[];
    priceRange?: string | null;
    priceRangeSource?: 'NONE' | 'GOOGLE' | 'MANUAL' | null;
    isVerified: boolean;
    isActive: boolean;
    isFeatured: boolean;
    ratingOverride?: string | number | null;
    reviewCountOverride?: number | null;
    createdAt: Date;
    updatedAt?: Date;
    metadata?: unknown;
    googleSourceSnapshot?: unknown;
}) {
    return {
        ...row,
        lat: Number(row.lat),
        lng: Number(row.lng),
        galleryImageUrls: galleryImageUrlsFromMetadata(row.metadata),
        galleryS3Keys: row.galleryS3Keys || [],
        amenities: row.amenities || [],
        vibes: row.vibes || [],
        cuisineTags: row.cuisineTags || [],
        ratingOverride: row.ratingOverride === null || row.ratingOverride === undefined ? null : Number(row.ratingOverride),
        reviewCountOverride: row.reviewCountOverride ?? null,
        googlePlaceId: row.googlePlaceId ?? null,
        approvalStatus: row.approvalStatus ?? null,
        approvalNotes: row.approvalNotes ?? null,
        menuSource: row.menuSource ?? null,
        descriptionSource: row.descriptionSource ?? null,
        shortDescriptionSource: row.shortDescriptionSource ?? null,
        priceRangeSource: row.priceRangeSource ?? null,
        googleSourceSnapshot: row.googleSourceSnapshot ?? null,
    };
}

function getSuperAdminUsername(): string | null {
    const username = process.env.SUPER_ADMIN_USERNAME?.trim();
    return username || null;
}

function getSuperAdminPasswordRaw(): string | null {
    const password = process.env.SUPER_ADMIN_PASSWORD?.trim();
    return password || null;
}

function getSuperAdminPasswordHash(): string | null {
    const passwordHash = process.env.SUPER_ADMIN_PASSWORD_HASH?.trim();
    return passwordHash || null;
}

function getSessionSecret(): Uint8Array | null {
    const secret = process.env.SUPER_ADMIN_SESSION_SECRET?.trim();
    if (!secret) return null;
    return new TextEncoder().encode(secret);
}

function safeCompare(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    if (leftBuffer.length !== rightBuffer.length) return false;
    return timingSafeEqual(leftBuffer, rightBuffer);
}

async function verifySuperAdminPassword(inputPassword: string): Promise<boolean> {
    const passwordHash = getSuperAdminPasswordHash();
    if (passwordHash) {
        return bcrypt.compare(inputPassword, passwordHash);
    }

    const rawPassword = getSuperAdminPasswordRaw();
    if (!rawPassword) return false;
    return safeCompare(inputPassword, rawPassword);
}

async function signSessionToken(username: string): Promise<string> {
    const secret = getSessionSecret();
    if (!secret) throw new Error('SUPER_ADMIN_SESSION_SECRET is not configured');
    return new SignJWT({
        username,
        scope: 'super_admin',
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(username)
        .setIssuedAt()
        .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
        .setIssuer(SESSION_ISSUER)
        .sign(secret);
}

async function verifySessionToken(token: string): Promise<{ username: string } | null> {
    const secret = getSessionSecret();
    if (!secret) return null;
    try {
        const { payload } = await jwtVerify(token, secret, { issuer: SESSION_ISSUER });
        if (payload.scope !== 'super_admin') return null;
        const username = String(payload.username || payload.sub || '').trim();
        if (!username) return null;
        return { username };
    } catch {
        return null;
    }
}

async function getSuperAdminSession(c: any): Promise<{ username: string } | null> {
    const token = getCookie(c, SESSION_COOKIE_NAME);
    if (!token) return null;
    return verifySessionToken(token);
}

async function superAdminAuthMiddleware(c: any, next: any) {
    const session = await getSuperAdminSession(c);
    if (!session) {
        return c.json(apiError('UNAUTHORIZED', 'Super admin authentication required'), 401);
    }
    c.set('superAdmin', session);
    await next();
}

superAdminRoutes.post('/login', authRateLimit, async (c) => {
    const configuredUsername = getSuperAdminUsername();
    const hasPasswordConfig = Boolean(getSuperAdminPasswordHash() || getSuperAdminPasswordRaw());
    const hasSecretConfig = Boolean(getSessionSecret());

    if (!configuredUsername || !hasPasswordConfig || !hasSecretConfig) {
        return c.json(
            apiError(
                'SUPER_ADMIN_MISCONFIGURED',
                'Super admin credentials are not configured. Set SUPER_ADMIN_USERNAME, SUPER_ADMIN_PASSWORD (or SUPER_ADMIN_PASSWORD_HASH), and SUPER_ADMIN_SESSION_SECRET.',
            ),
            500,
        );
    }

    const body = await c.req.json().catch(() => ({}));
    const parsed = superAdminLoginSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid credentials payload', parsed.error.issues), 400);
    }

    const inputUsername = parsed.data.username.trim();
    const usernameMatches = safeCompare(inputUsername, configuredUsername);
    const passwordMatches = await verifySuperAdminPassword(parsed.data.password);

    if (!usernameMatches || !passwordMatches) {
        return c.json(apiError('UNAUTHORIZED', 'Invalid super admin username or password'), 401);
    }

    const sessionToken = await signSessionToken(configuredUsername);
    setCookie(c, SESSION_COOKIE_NAME, sessionToken, {
        path: '/api/v1/super-admin',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        maxAge: SESSION_TTL_SECONDS,
    });

    return c.json(apiResponse({
        username: configuredUsername,
        expiresIn: SESSION_TTL_SECONDS,
    }));
});

superAdminRoutes.post('/logout', async (c) => {
    deleteCookie(c, SESSION_COOKIE_NAME, {
        path: '/api/v1/super-admin',
    });
    return c.json(apiResponse({ message: 'Logged out' }));
});

superAdminRoutes.get('/session', async (c) => {
    const session = await getSuperAdminSession(c);
    if (!session) {
        return c.json(apiResponse({
            authenticated: false,
            username: '',
        }));
    }
    return c.json(apiResponse({
        authenticated: true,
        username: session.username,
    }));
});

superAdminRoutes.use('*', superAdminAuthMiddleware);

superAdminRoutes.post('/uploads/presigned-url', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = presignedUploadSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const { filename, contentType, purpose, fileSize } = parsed.data;
    if (fileSize > STORAGE_MAX_FILE_SIZE) {
        return c.json(apiError('VALIDATION_ERROR', 'File too large. Max size is 4MB.'), 400);
    }

    try {
        const actorId = `super-admin-${c.get('superAdmin').username}`;
        return c.json(apiResponse(await createStoragePresignedUpload({
            actorId,
            filename,
            contentType,
            purpose,
            fileSize,
        })));
    } catch {
        return c.json(apiError('INTERNAL_ERROR', 'Failed to generate upload URL'), 500);
    }
});

superAdminRoutes.post('/uploads/delete-objects', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = deleteUploadSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    try {
        const result = await deleteStorageObjects(parsed.data.keys);
        return c.json(apiResponse(result));
    } catch {
        return c.json(apiError('INTERNAL_ERROR', 'Failed to delete upload objects'), 500);
    }
});

superAdminRoutes.get('/stats', async (c) => {
    const now = new Date();
    const [totalUsersResult] = await db.select({ count: count() }).from(users);
    const [activeUsersResult] = await db.select({ count: count() }).from(users).where(eq(users.isActive, true));
    const [totalVenuesResult] = await db.select({ count: count() }).from(venues);
    const [activeVenuesResult] = await db.select({ count: count() }).from(venues).where(eq(venues.isActive, true));
    const [totalMatchesResult] = await db.select({ count: count() }).from(matches);
    const [totalBookingsResult] = await db.select({ count: count() }).from(bookings);

    const [upcomingMatchEventsResult] = await db
        .select({ count: count() })
        .from(venueEvents)
        .innerJoin(matches, eq(venueEvents.matchId, matches.id))
        .where(and(
            eq(venueEvents.isActive, true),
            gte(matches.matchDateUtc, now),
            sql`${matches.status} IN ('SCHEDULED', 'TIMED')`,
        ));

    const [ongoingMatchEventsResult] = await db
        .select({ count: count() })
        .from(venueEvents)
        .innerJoin(matches, eq(venueEvents.matchId, matches.id))
        .where(and(
            eq(venueEvents.isActive, true),
            sql`${matches.status} IN ('IN_PLAY', 'PAUSED')`,
        ));

    const [upcomingCustomEventsResult] = await db
        .select({ count: count() })
        .from(venueCustomEvents)
        .where(and(eq(venueCustomEvents.isActive, true), gte(venueCustomEvents.startsAt, now)));

    const [ongoingCustomEventsResult] = await db
        .select({ count: count() })
        .from(venueCustomEvents)
        .where(and(
            eq(venueCustomEvents.isActive, true),
            lte(venueCustomEvents.startsAt, now),
            gte(venueCustomEvents.endsAt, now),
        ));

    return c.json(apiResponse({
        users: {
            total: Number(totalUsersResult?.count || 0),
            active: Number(activeUsersResult?.count || 0),
        },
        venues: {
            total: Number(totalVenuesResult?.count || 0),
            active: Number(activeVenuesResult?.count || 0),
        },
        matches: {
            total: Number(totalMatchesResult?.count || 0),
        },
        bookings: {
            total: Number(totalBookingsResult?.count || 0),
        },
        events: {
            upcoming: Number(upcomingMatchEventsResult?.count || 0) + Number(upcomingCustomEventsResult?.count || 0),
            ongoing: Number(ongoingMatchEventsResult?.count || 0) + Number(ongoingCustomEventsResult?.count || 0),
            upcomingMatchEvents: Number(upcomingMatchEventsResult?.count || 0),
            upcomingCustomEvents: Number(upcomingCustomEventsResult?.count || 0),
        },
    }));
});

superAdminRoutes.get('/system', async (c) => {
    const totalMemoryBytes = os.totalmem();
    const freeMemoryBytes = os.freemem();
    const usedMemoryBytes = totalMemoryBytes - freeMemoryBytes;
    const toGb = (bytes: number) => Number((bytes / (1024 ** 3)).toFixed(2));

    let disk = {
        totalGb: null as number | null,
        usedGb: null as number | null,
        freeGb: null as number | null,
        usedPercent: null as number | null,
    };
    try {
        const raw = execSync("df -k / | tail -1 | awk '{print $2\" \"$3\" \"$4\" \"$5}'", { encoding: 'utf8' }).trim();
        const [totalKb, usedKb, freeKb, usedPercentRaw] = raw.split(/\s+/);
        disk = {
            totalGb: Number((Number(totalKb) / 1024 / 1024).toFixed(2)),
            usedGb: Number((Number(usedKb) / 1024 / 1024).toFixed(2)),
            freeGb: Number((Number(freeKb) / 1024 / 1024).toFixed(2)),
            usedPercent: Number(String(usedPercentRaw || '0').replace('%', '')),
        };
    } catch {
        // Best effort only
    }

    let dbStatus: { ok: boolean; error?: string } = { ok: true };
    try {
        await db.execute(sql`select 1`);
    } catch (err) {
        dbStatus = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }

    const region = process.env.AWS_REGION || 'us-east-1';
    const bucket = process.env.S3_BUCKET || '';
    const hasAccessKey = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
    const hasCdnUrl = Boolean(process.env.CDN_URL);
    let bucketAccess = {
        configured: Boolean(bucket),
        reachable: false,
        error: '' as string | null,
    };

    if (bucket) {
        try {
            const s3 = new S3Client({
                region,
                ...(process.env.AWS_ACCESS_KEY_ID ? {
                    credentials: {
                        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
                    },
                } : {}),
            });
            await s3.send(new HeadBucketCommand({ Bucket: bucket }));
            bucketAccess = { configured: true, reachable: true, error: null };
        } catch (err) {
            bucketAccess = {
                configured: true,
                reachable: false,
                error: err instanceof Error ? err.message : String(err),
            };
        }
    }

    return c.json(apiResponse({
        node: process.version,
        platform: process.platform,
        uptimeSeconds: Math.floor(os.uptime()),
        loadAverage: os.loadavg(),
        cpuCores: os.cpus().length,
        memory: {
            totalGb: toGb(totalMemoryBytes),
            usedGb: toGb(usedMemoryBytes),
            freeGb: toGb(freeMemoryBytes),
            usedPercent: Number(((usedMemoryBytes / totalMemoryBytes) * 100).toFixed(2)),
        },
        disk,
        database: dbStatus,
        s3: {
            region,
            bucket,
            hasAccessKey,
            hasCdnUrl,
            ...bucketAccess,
        },
    }));
});

superAdminRoutes.get('/lookups', async (c) => {
    const now = new Date();
    const [venueRows, matchRows, leagueRows, sportRows, teamRows, playerRows, stadiumRows, ownerRows, attributeRows] = await Promise.all([
        db.select({
            id: venues.id,
            name: venues.name,
            city: venues.city,
            ownerId: venues.ownerId,
        }).from(venues).where(eq(venues.isActive, true)).orderBy(desc(venues.createdAt)).limit(300),
        db.select({
            id: matches.id,
            eventFormat: matches.eventFormat,
            eventTitle: matches.eventTitle,
            eventSubtitle: matches.eventSubtitle,
            homeTeamName: matches.homeTeamName,
            awayTeamName: matches.awayTeamName,
            matchDateUtc: matches.matchDateUtc,
            status: matches.status,
            leagueId: matches.leagueId,
        })
            .from(matches)
            .where(gte(matches.matchDateUtc, now))
            .orderBy(matches.matchDateUtc)
            .limit(500),
        db.select({
            id: leagues.id,
            sportId: leagues.sportId,
            name: leagues.name,
            shortName: leagues.shortName,
            externalId: leagues.externalId,
        }).from(leagues).where(eq(leagues.isActive, true)).orderBy(leagues.name),
        db.select({
            id: sports.id,
            name: sports.name,
            slug: sports.slug,
            shortName: sports.shortName,
        }).from(sports).where(eq(sports.isActive, true)).orderBy(sports.sortOrder, sports.name),
        db.select({
            id: teams.id,
            leagueId: teams.leagueId,
            name: teams.name,
            shortName: teams.shortName,
            crestUrl: teams.crestUrl,
        }).from(teams).where(eq(teams.isActive, true)).orderBy(teams.name).limit(500),
        db.select({
            id: players.id,
            leagueId: players.leagueId,
            name: players.name,
            slug: players.slug,
            shortName: players.shortName,
            headshotUrl: players.headshotUrl,
        }).from(players).where(eq(players.isActive, true)).orderBy(players.name).limit(1200),
        db.select({
            id: stadiums.id,
            name: stadiums.name,
            city: stadiums.city,
            country: stadiums.country,
        }).from(stadiums).where(eq(stadiums.isActive, true)).orderBy(stadiums.name).limit(300),
        db.select({
            id: users.id,
            email: users.email,
            name: users.name,
            role: users.role,
        }).from(users)
            .where(eq(users.isActive, true))
            .orderBy(users.name)
            .limit(400),
        db.select({
            id: venueAttributes.id,
            type: venueAttributes.type,
            label: venueAttributes.label,
            slug: venueAttributes.slug,
            sortOrder: venueAttributes.sortOrder,
            isActive: venueAttributes.isActive,
        }).from(venueAttributes)
            .where(eq(venueAttributes.isActive, true))
            .orderBy(venueAttributes.type, venueAttributes.sortOrder, venueAttributes.label),
    ]);

    return c.json(apiResponse({
        venues: venueRows,
        matches: matchRows,
        leagues: leagueRows,
        sports: sportRows,
        teams: teamRows,
        players: playerRows,
        stadiums: stadiumRows,
        owners: ownerRows,
        attributes: attributeRows,
    }));
});

superAdminRoutes.get('/attributes', async (c) => {
    const parsed = venueAttributeQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid query', parsed.error.issues), 400);
    }

    const conditions = [];
    if (parsed.data.type) conditions.push(eq(venueAttributes.type, parsed.data.type));
    if (!parsed.data.includeInactive) conditions.push(eq(venueAttributes.isActive, true));
    if (parsed.data.search?.trim()) {
        conditions.push(or(
            ilike(venueAttributes.label, `%${parsed.data.search.trim()}%`),
            ilike(venueAttributes.slug, `%${parsed.data.search.trim()}%`),
        )!);
    }

    const rows = await db.select({
        id: venueAttributes.id,
        type: venueAttributes.type,
        label: venueAttributes.label,
        slug: venueAttributes.slug,
        sortOrder: venueAttributes.sortOrder,
        isActive: venueAttributes.isActive,
        createdAt: venueAttributes.createdAt,
        updatedAt: venueAttributes.updatedAt,
    }).from(venueAttributes)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(venueAttributes.type, venueAttributes.sortOrder, venueAttributes.label);

    return c.json(apiResponse(rows));
});

superAdminRoutes.post('/attributes', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = createVenueAttributeSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const slug = slugifyValue(parsed.data.slug?.trim() || parsed.data.label);
    if (!slug) {
        return c.json(apiError('VALIDATION_ERROR', 'Attribute slug is required'), 400);
    }

    const [existing] = await db.select({ id: venueAttributes.id }).from(venueAttributes)
        .where(and(eq(venueAttributes.type, parsed.data.type), eq(venueAttributes.slug, slug)))
        .limit(1);

    if (existing) {
        await db.update(venueAttributes).set({
            label: parsed.data.label.trim(),
            sortOrder: parsed.data.sortOrder,
            isActive: parsed.data.isActive,
            updatedAt: new Date(),
        }).where(eq(venueAttributes.id, existing.id));
    } else {
        await db.insert(venueAttributes).values({
            type: parsed.data.type,
            label: parsed.data.label.trim(),
            slug,
            sortOrder: parsed.data.sortOrder,
            isActive: parsed.data.isActive,
        });
    }

    const [row] = await db.select({
        id: venueAttributes.id,
        type: venueAttributes.type,
        label: venueAttributes.label,
        slug: venueAttributes.slug,
        sortOrder: venueAttributes.sortOrder,
        isActive: venueAttributes.isActive,
        createdAt: venueAttributes.createdAt,
        updatedAt: venueAttributes.updatedAt,
    }).from(venueAttributes)
        .where(and(eq(venueAttributes.type, parsed.data.type), eq(venueAttributes.slug, slug)))
        .limit(1);

    return c.json(apiResponse(row), existing ? 200 : 201);
});

superAdminRoutes.patch('/attributes/:attributeId', async (c) => {
    const attributeId = c.req.param('attributeId');
    const body = await c.req.json().catch(() => ({}));
    const parsed = updateVenueAttributeSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const [existing] = await db.select({
        id: venueAttributes.id,
        type: venueAttributes.type,
        slug: venueAttributes.slug,
    }).from(venueAttributes).where(eq(venueAttributes.id, attributeId)).limit(1);
    if (!existing) return c.json(apiError('NOT_FOUND', 'Attribute not found'), 404);

    const nextSlug = parsed.data.slug !== undefined ? slugifyValue(parsed.data.slug) : undefined;
    if (parsed.data.slug !== undefined && !nextSlug) {
        return c.json(apiError('VALIDATION_ERROR', 'Attribute slug is required'), 400);
    }

    if (nextSlug && nextSlug !== existing.slug) {
        const [conflict] = await db.select({ id: venueAttributes.id }).from(venueAttributes)
            .where(and(
                eq(venueAttributes.type, existing.type),
                eq(venueAttributes.slug, nextSlug),
                sql`${venueAttributes.id} <> ${attributeId}`,
            ))
            .limit(1);
        if (conflict) return c.json(apiError('CONFLICT', 'Attribute slug already exists for this type'), 409);
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.label !== undefined) updates.label = parsed.data.label.trim();
    if (nextSlug !== undefined) updates.slug = nextSlug;
    if (parsed.data.sortOrder !== undefined) updates.sortOrder = parsed.data.sortOrder;
    if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

    await db.update(venueAttributes).set(updates).where(eq(venueAttributes.id, attributeId));
    return c.json(apiResponse({ message: 'Attribute updated' }));
});

superAdminRoutes.delete('/attributes/:attributeId', async (c) => {
    const attributeId = c.req.param('attributeId');
    const [existing] = await db.select({ id: venueAttributes.id }).from(venueAttributes)
        .where(eq(venueAttributes.id, attributeId))
        .limit(1);
    if (!existing) return c.json(apiError('NOT_FOUND', 'Attribute not found'), 404);

    await db.update(venueAttributes).set({
        isActive: false,
        updatedAt: new Date(),
    }).where(eq(venueAttributes.id, attributeId));

    return c.json(apiResponse({ message: 'Attribute archived' }));
});

superAdminRoutes.get('/teams', async (c) => {
    const parsed = teamSearchQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid query', parsed.error.issues), 400);
    }

    const search = parsed.data.search.trim();
    const whereParts = [];
    if (!parsed.data.includeInactive) {
        whereParts.push(eq(teams.isActive, true));
    }
    if (parsed.data.leagueId) {
        whereParts.push(eq(teams.leagueId, parsed.data.leagueId));
    }
    if (search) {
        whereParts.push(or(
            ilike(teams.name, `%${search}%`),
            ilike(teams.shortName, `%${search}%`),
            ilike(teams.externalId, `%${search}%`),
        )!);
    }

    const queryWhere = whereParts.length ? and(...whereParts) : undefined;

    if (parsed.data.page) {
        const offset = paginationOffset(parsed.data.page, parsed.data.limit);
        const [baseRows, [totalResult]] = await Promise.all([
            db.select({
                id: teams.id,
                leagueId: teams.leagueId,
                leagueName: leagues.name,
                slug: teams.slug,
                name: teams.name,
                shortName: teams.shortName,
                crestUrl: teams.crestUrl,
                heroImageUrl: teams.heroImageUrl,
                website: teams.website,
                country: teams.country,
                aliases: teams.aliases,
                shortDescription: teams.shortDescription,
                description: teams.description,
                primaryStadiumId: teams.primaryStadiumId,
                primaryStadiumName: stadiums.name,
                externalId: teams.externalId,
                enrichedAt: teams.enrichedAt,
                enrichmentStatus: teams.enrichmentStatus,
                enrichmentError: teams.enrichmentError,
                isActive: teams.isActive,
                createdAt: teams.createdAt,
            }).from(teams)
                .leftJoin(leagues, eq(teams.leagueId, leagues.id))
                .leftJoin(stadiums, eq(teams.primaryStadiumId, stadiums.id))
                .where(queryWhere)
                .orderBy(teams.name)
                .limit(parsed.data.limit)
                .offset(offset),
            db.select({ count: count() }).from(teams).where(queryWhere),
        ]);

        const teamIds = baseRows.map((row) => row.id);
        const [secondaryRows, rosterRows] = teamIds.length > 0
            ? await Promise.all([
                db.select({
                    teamId: teamStadiumLinks.teamId,
                    stadiumId: teamStadiumLinks.stadiumId,
                    stadiumName: stadiums.name,
                }).from(teamStadiumLinks)
                    .innerJoin(stadiums, eq(teamStadiumLinks.stadiumId, stadiums.id))
                    .where(and(inArray(teamStadiumLinks.teamId, teamIds), eq(teamStadiumLinks.isActive, true), eq(teamStadiumLinks.isPrimary, false)))
                    .orderBy(teamStadiumLinks.sortOrder, stadiums.name),
                db.select({
                    teamId: teamRosterMembers.teamId,
                    playerId: teamRosterMembers.playerId,
                    playerName: players.name,
                    playerSlug: players.slug,
                    playerShortName: players.shortName,
                    headshotUrl: players.headshotUrl,
                    shirtNumber: teamRosterMembers.shirtNumber,
                    position: teamRosterMembers.position,
                    isCaptain: teamRosterMembers.isCaptain,
                    sortOrder: teamRosterMembers.sortOrder,
                    isActive: teamRosterMembers.isActive,
                }).from(teamRosterMembers)
                    .innerJoin(players, eq(teamRosterMembers.playerId, players.id))
                    .where(inArray(teamRosterMembers.teamId, teamIds))
                    .orderBy(teamRosterMembers.sortOrder, players.name),
            ])
            : [[], []];

        const secondaryByTeamId = new Map<string, Array<{ id: string; name: string }>>();
        for (const row of secondaryRows) {
            const existing = secondaryByTeamId.get(row.teamId) || [];
            existing.push({ id: row.stadiumId, name: row.stadiumName });
            secondaryByTeamId.set(row.teamId, existing);
        }

        const rosterByTeamId = new Map<string, Array<{
            playerId: string;
            playerName: string;
            playerSlug: string;
            playerShortName: string | null;
            headshotUrl: string | null;
            shirtNumber: string | null;
            position: string | null;
            isCaptain: boolean;
            sortOrder: number;
            isActive: boolean;
        }>>();
        for (const row of rosterRows) {
            const existing = rosterByTeamId.get(row.teamId) || [];
            existing.push({
                playerId: row.playerId,
                playerName: row.playerName,
                playerSlug: row.playerSlug,
                playerShortName: row.playerShortName,
                headshotUrl: row.headshotUrl,
                shirtNumber: row.shirtNumber,
                position: row.position,
                isCaptain: row.isCaptain,
                sortOrder: row.sortOrder,
                isActive: row.isActive,
            });
            rosterByTeamId.set(row.teamId, existing);
        }

        const rows = baseRows.map((row) => ({
            ...row,
            secondaryStadiums: secondaryByTeamId.get(row.id) || [],
            rosterMembers: rosterByTeamId.get(row.id) || [],
        }));

        return c.json(apiResponse(rows, paginationMeta(parsed.data.page, parsed.data.limit, Number(totalResult?.count || 0))));
    }

    const rows = await db.select({
        id: teams.id,
        leagueId: teams.leagueId,
        name: teams.name,
        shortName: teams.shortName,
        crestUrl: teams.crestUrl,
    }).from(teams).where(queryWhere).orderBy(teams.name).limit(parsed.data.limit);

    return c.json(apiResponse(rows));
});

superAdminRoutes.get('/teams/duplicates', async (c) => {
    const parsed = teamDuplicateQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid query', parsed.error.issues), 400);
    }

    const whereParts = [];
    if (!parsed.data.includeInactive) {
        whereParts.push(eq(teams.isActive, true));
    }
    if (parsed.data.leagueId) {
        whereParts.push(eq(teams.leagueId, parsed.data.leagueId));
    }

    const queryWhere = whereParts.length ? and(...whereParts) : undefined;
    const rows = await db.select({
        id: teams.id,
        leagueId: teams.leagueId,
        leagueName: leagues.name,
        name: teams.name,
        slug: teams.slug,
        shortName: teams.shortName,
        aliases: teams.aliases,
        externalId: teams.externalId,
        crestUrl: teams.crestUrl,
        heroImageUrl: teams.heroImageUrl,
        shortDescription: teams.shortDescription,
        description: teams.description,
        isActive: teams.isActive,
        createdAt: teams.createdAt,
    }).from(teams)
        .leftJoin(leagues, eq(teams.leagueId, leagues.id))
        .where(queryWhere)
        .orderBy(leagues.name, teams.name, teams.createdAt);

    const grouped = new Map<string, typeof rows>();
    for (const row of rows) {
        const normalizedName = normalizeTeamIdentity(row.name);
        if (!normalizedName) continue;
        const groupKey = `${row.leagueId || 'no-league'}::${normalizedName}`;
        const existing = grouped.get(groupKey) || [];
        existing.push(row);
        grouped.set(groupKey, existing);
    }

    const allDuplicateGroups = Array.from(grouped.entries())
        .map(([groupKey, members]) => {
            if (members.length < 2) return null;
            const normalizedName = groupKey.split('::').slice(1).join('::');
            const preferred = choosePreferredTeamRecord(members);
            const orderedMembers = [...members].sort((left, right) => {
                if (preferred) {
                    if (left.id === preferred.id) return -1;
                    if (right.id === preferred.id) return 1;
                }
                const scoreDiff = scoreTeamIdentityRecord(right) - scoreTeamIdentityRecord(left);
                if (scoreDiff !== 0) return scoreDiff;
                if (left.isActive !== right.isActive) return left.isActive ? -1 : 1;
                return left.name.localeCompare(right.name);
            });

            return {
                leagueId: members[0]?.leagueId || null,
                leagueName: members[0]?.leagueName || null,
                normalizedName,
                memberCount: members.length,
                activeCount: members.filter((member) => member.isActive).length,
                preferredTeamId: preferred?.id || null,
                preferredTeamName: preferred?.name || null,
                members: orderedMembers.map((member) => ({
                    id: member.id,
                    name: member.name,
                    slug: member.slug,
                    shortName: member.shortName,
                    aliases: member.aliases || [],
                    externalId: member.externalId,
                    crestUrl: member.crestUrl,
                    isActive: member.isActive,
                    createdAt: member.createdAt,
                    identityScore: scoreTeamIdentityRecord(member),
                })),
            };
        })
        .filter((group): group is NonNullable<typeof group> => Boolean(group))
        .sort((left, right) => (
            right.memberCount - left.memberCount
            || right.activeCount - left.activeCount
            || (left.leagueName || '').localeCompare(right.leagueName || '')
            || left.normalizedName.localeCompare(right.normalizedName)
        ));

    const duplicateGroups = allDuplicateGroups.slice(0, parsed.data.limit);

    return c.json(apiResponse({
        groups: duplicateGroups,
        totalGroups: allDuplicateGroups.length,
    }));
});

superAdminRoutes.post('/teams', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = createTeamSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    if (parsed.data.leagueId) {
        const [league] = await db.select({ id: leagues.id }).from(leagues)
            .where(and(eq(leagues.id, parsed.data.leagueId), eq(leagues.isActive, true)))
            .limit(1);
        if (!league) return c.json(apiError('NOT_FOUND', 'League not found'), 404);
    }

    const primaryStadiumId = parsed.data.primaryStadiumId || null;
    const secondaryStadiumIds = uniqueUuidList(parsed.data.secondaryStadiumIds || []).filter((stadiumId) => stadiumId !== primaryStadiumId);
    const rosterMembers = normalizeRosterMembers(parsed.data.rosterMembers);
    try {
        await assertActiveStadiumIds(uniqueUuidList([primaryStadiumId, ...secondaryStadiumIds]));
        await assertActivePlayerIds(rosterMembers.map((member) => member.playerId));
    } catch (error) {
        return c.json(apiError('NOT_FOUND', error instanceof Error ? error.message : 'Related records not found'), 404);
    }

    const trimmedName = parsed.data.name.trim();
    const [existingTeam] = await db.select({
        id: teams.id,
        leagueId: teams.leagueId,
        name: teams.name,
        shortName: teams.shortName,
        crestUrl: teams.crestUrl,
    }).from(teams)
        .where(and(
            eq(teams.isActive, true),
            eq(teams.name, trimmedName),
            parsed.data.leagueId ? eq(teams.leagueId, parsed.data.leagueId) : sql`${teams.leagueId} IS NULL`,
        ))
        .limit(1);
    if (existingTeam) return c.json(apiResponse(existingTeam), 200);

    const [created] = await db.transaction(async (tx) => {
        const [createdTeam] = await tx.insert(teams).values({
            leagueId: parsed.data.leagueId || null,
            primaryStadiumId,
            name: trimmedName,
            slug: await allocateCanonicalSlug('team', trimmedName, { shortName: parsed.data.shortName?.trim() || null }),
            shortName: parsed.data.shortName?.trim() || null,
            crestUrl: parsed.data.crestUrl?.trim() || null,
            heroImageUrl: parsed.data.heroImageUrl?.trim() || null,
            website: parsed.data.website?.trim() || null,
            country: parsed.data.country?.trim() || null,
            shortDescription: parsed.data.shortDescription?.trim() || null,
            description: parsed.data.description?.trim() || null,
            aliases: parsed.data.aliases?.map((item) => item.trim()).filter(Boolean) || [],
            shortDescriptionSource: parsed.data.shortDescription?.trim() ? 'MANUAL' : 'NONE',
            descriptionSource: parsed.data.description?.trim() ? 'MANUAL' : 'NONE',
            crestSource: parsed.data.crestUrl?.trim() ? 'MANUAL' : 'NONE',
            heroImageSource: parsed.data.heroImageUrl?.trim() ? 'MANUAL' : 'NONE',
            websiteSource: parsed.data.website?.trim() ? 'MANUAL' : 'NONE',
            externalId: parsed.data.externalId?.trim() || null,
            isActive: parsed.data.isActive,
        }).returning({
            id: teams.id,
            leagueId: teams.leagueId,
            slug: teams.slug,
            name: teams.name,
            shortName: teams.shortName,
            crestUrl: teams.crestUrl,
        });

        await syncTeamStadiumState(tx, createdTeam.id, primaryStadiumId, secondaryStadiumIds);
        await syncTeamRosterState(tx, createdTeam.id, rosterMembers);
        return [createdTeam];
    });

    return c.json(apiResponse(created), 201);
});

superAdminRoutes.patch('/teams/:teamId', async (c) => {
    const teamId = c.req.param('teamId');
    const body = await c.req.json().catch(() => ({}));
    const parsed = updateTeamSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const [existing] = await db.select({
        id: teams.id,
        primaryStadiumId: teams.primaryStadiumId,
        crestUrl: teams.crestUrl,
        crestSource: teams.crestSource,
        heroImageUrl: teams.heroImageUrl,
        heroImageSource: teams.heroImageSource,
        website: teams.website,
        websiteSource: teams.websiteSource,
        shortDescription: teams.shortDescription,
        shortDescriptionSource: teams.shortDescriptionSource,
        description: teams.description,
        descriptionSource: teams.descriptionSource,
    }).from(teams).where(eq(teams.id, teamId)).limit(1);
    if (!existing) return c.json(apiError('NOT_FOUND', 'Team not found'), 404);

    if (parsed.data.leagueId) {
        const [league] = await db.select({ id: leagues.id }).from(leagues)
            .where(and(eq(leagues.id, parsed.data.leagueId), eq(leagues.isActive, true)))
            .limit(1);
        if (!league) return c.json(apiError('NOT_FOUND', 'League not found'), 404);
    }

    const currentLinkRows = (parsed.data.primaryStadiumId !== undefined || parsed.data.secondaryStadiumIds !== undefined)
        ? await db.select({ stadiumId: teamStadiumLinks.stadiumId, isPrimary: teamStadiumLinks.isPrimary })
            .from(teamStadiumLinks)
            .where(and(eq(teamStadiumLinks.teamId, teamId), eq(teamStadiumLinks.isActive, true)))
        : [];
    const currentSecondaryStadiumIds = currentLinkRows.filter((row) => !row.isPrimary).map((row) => row.stadiumId);
    const nextPrimaryStadiumId = parsed.data.primaryStadiumId !== undefined
        ? (parsed.data.primaryStadiumId || null)
        : (existing.primaryStadiumId || null);
    const nextSecondaryStadiumIds = parsed.data.secondaryStadiumIds !== undefined
        ? uniqueUuidList(parsed.data.secondaryStadiumIds).filter((stadiumId) => stadiumId !== nextPrimaryStadiumId)
        : currentSecondaryStadiumIds.filter((stadiumId) => stadiumId !== nextPrimaryStadiumId);
    const nextRosterMembers = parsed.data.rosterMembers !== undefined
        ? normalizeRosterMembers(parsed.data.rosterMembers)
        : null;

    try {
        if (parsed.data.primaryStadiumId !== undefined || parsed.data.secondaryStadiumIds !== undefined) {
            await assertActiveStadiumIds(uniqueUuidList([nextPrimaryStadiumId, ...nextSecondaryStadiumIds]));
        }
        if (nextRosterMembers) {
            await assertActivePlayerIds(nextRosterMembers.map((member) => member.playerId));
        }
    } catch (error) {
        return c.json(apiError('NOT_FOUND', error instanceof Error ? error.message : 'Related records not found'), 404);
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.leagueId !== undefined) updates.leagueId = parsed.data.leagueId || null;
    if (parsed.data.primaryStadiumId !== undefined) updates.primaryStadiumId = nextPrimaryStadiumId;
    if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
    if (parsed.data.shortName !== undefined) updates.shortName = parsed.data.shortName?.trim() || null;
    if (parsed.data.crestUrl !== undefined) {
        updates.crestUrl = parsed.data.crestUrl?.trim() || null;
        updates.crestSource = resolveUpdatedFieldSource(parsed.data.crestUrl, existing.crestUrl, existing.crestSource);
    }
    if (parsed.data.heroImageUrl !== undefined) {
        updates.heroImageUrl = parsed.data.heroImageUrl?.trim() || null;
        updates.heroImageSource = resolveUpdatedFieldSource(parsed.data.heroImageUrl, existing.heroImageUrl, existing.heroImageSource);
    }
    if (parsed.data.website !== undefined) {
        updates.website = parsed.data.website?.trim() || null;
        updates.websiteSource = resolveUpdatedFieldSource(parsed.data.website, existing.website, existing.websiteSource);
    }
    if (parsed.data.country !== undefined) updates.country = parsed.data.country?.trim() || null;
    if (parsed.data.shortDescription !== undefined) {
        updates.shortDescription = parsed.data.shortDescription?.trim() || null;
        updates.shortDescriptionSource = resolveUpdatedFieldSource(parsed.data.shortDescription, existing.shortDescription, existing.shortDescriptionSource);
    }
    if (parsed.data.description !== undefined) {
        updates.description = parsed.data.description?.trim() || null;
        updates.descriptionSource = resolveUpdatedFieldSource(parsed.data.description, existing.description, existing.descriptionSource);
    }
    if (parsed.data.aliases !== undefined) updates.aliases = parsed.data.aliases.map((item) => item.trim()).filter(Boolean);
    if (parsed.data.externalId !== undefined) updates.externalId = parsed.data.externalId?.trim() || null;
    if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

    await db.transaction(async (tx) => {
        await tx.update(teams).set(updates).where(eq(teams.id, teamId));
        if (parsed.data.primaryStadiumId !== undefined || parsed.data.secondaryStadiumIds !== undefined) {
            await syncTeamStadiumState(tx, teamId, nextPrimaryStadiumId, nextSecondaryStadiumIds);
        }
        if (nextRosterMembers) {
            await syncTeamRosterState(tx, teamId, nextRosterMembers);
        }
    });
    return c.json(apiResponse({ message: 'Team updated' }));
});

superAdminRoutes.post('/teams/:teamId/seed-roster', async (c) => {
    const teamId = c.req.param('teamId');
    const body = await c.req.json().catch(() => ({}));
    const parsed = seedTeamRosterSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const [team] = await db.select({ id: teams.id, name: teams.name }).from(teams).where(eq(teams.id, teamId)).limit(1);
    if (!team) return c.json(apiError('NOT_FOUND', 'Team not found'), 404);

    const [existingRosterRows, participantRows] = await Promise.all([
        db.select({
            playerId: teamRosterMembers.playerId,
            shirtNumber: teamRosterMembers.shirtNumber,
            position: teamRosterMembers.position,
            isCaptain: teamRosterMembers.isCaptain,
            sortOrder: teamRosterMembers.sortOrder,
            isActive: teamRosterMembers.isActive,
        }).from(teamRosterMembers).where(eq(teamRosterMembers.teamId, teamId)).orderBy(teamRosterMembers.sortOrder, teamRosterMembers.createdAt),
        db.select({
            playerId: matchParticipants.playerId,
            playerName: players.name,
            matchDateUtc: matches.matchDateUtc,
            participantMetadata: matchParticipants.metadata,
            displayOrder: matchParticipants.displayOrder,
        })
            .from(matchParticipants)
            .innerJoin(matches, eq(matchParticipants.matchId, matches.id))
            .innerJoin(players, eq(matchParticipants.playerId, players.id))
            .where(and(
                eq(matchParticipants.teamId, teamId),
                eq(matches.eventFormat, 'HEAD_TO_HEAD'),
                eq(players.isActive, true),
            ))
            .orderBy(desc(matches.matchDateUtc), asc(matchParticipants.displayOrder), players.name),
    ]);

    const seedMap = new Map<string, {
        playerId: string;
        shirtNumber: string | null;
        position: string | null;
        latestMatchDate: number;
        appearances: number;
    }>();

    for (const row of participantRows) {
        if (!row.playerId) continue;
        const metadata = (row.participantMetadata && typeof row.participantMetadata === 'object' ? row.participantMetadata as Record<string, unknown> : {}) || {};
        const shirtNumber = typeof metadata.shirtNumber === 'string'
            ? metadata.shirtNumber.trim() || null
            : typeof metadata.jerseyNumber === 'string'
                ? metadata.jerseyNumber.trim() || null
                : typeof metadata.number === 'string'
                    ? metadata.number.trim() || null
                    : null;
        const position = typeof metadata.position === 'string'
            ? metadata.position.trim() || null
            : typeof metadata.role === 'string'
                ? metadata.role.trim() || null
                : null;
        const existing = seedMap.get(row.playerId);
        if (!existing) {
            seedMap.set(row.playerId, {
                playerId: row.playerId,
                shirtNumber,
                position,
                latestMatchDate: row.matchDateUtc?.getTime?.() || 0,
                appearances: 1,
            });
            continue;
        }
        existing.appearances += 1;
        existing.latestMatchDate = Math.max(existing.latestMatchDate, row.matchDateUtc?.getTime?.() || 0);
        if (!existing.shirtNumber && shirtNumber) existing.shirtNumber = shirtNumber;
        if (!existing.position && position) existing.position = position;
    }

    const seededRoster = Array.from(seedMap.values())
        .sort((a, b) => b.appearances - a.appearances || b.latestMatchDate - a.latestMatchDate)
        .map((row, index) => ({
            playerId: row.playerId,
            shirtNumber: row.shirtNumber,
            position: row.position,
            isCaptain: false,
            sortOrder: index,
            isActive: true,
        }));

    const existingRoster = existingRosterRows.map((row, index) => ({
        playerId: row.playerId,
        shirtNumber: row.shirtNumber,
        position: row.position,
        isCaptain: row.isCaptain,
        sortOrder: row.sortOrder ?? index,
        isActive: row.isActive,
    }));

    const nextRoster = parsed.data.mode === 'replace'
        ? seededRoster
        : [
            ...existingRoster,
            ...seededRoster
                .filter((member) => !existingRoster.some((existing) => existing.playerId === member.playerId))
                .map((member, index) => ({ ...member, sortOrder: existingRoster.length + index })),
        ];

    await db.transaction(async (tx) => {
        await syncTeamRosterState(tx, teamId, nextRoster);
    });

    return c.json(apiResponse({
        message: 'Roster seeded from match participants',
        teamId,
        mode: parsed.data.mode,
        seededPlayers: seededRoster.length,
        totalRosterMembers: nextRoster.length,
    }));
});

superAdminRoutes.post('/teams/:teamId/merge', async (c) => {
    const sourceTeamId = c.req.param('teamId');
    const body = await c.req.json().catch(() => ({}));
    const parsed = mergeTeamSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const targetTeamId = parsed.data.targetTeamId;
    if (sourceTeamId === targetTeamId) {
        return c.json(apiError('VALIDATION_ERROR', 'Source and target teams must be different'), 400);
    }

    const [[source], [target]] = await Promise.all([
        db.select({
            id: teams.id,
            leagueId: teams.leagueId,
            primaryStadiumId: teams.primaryStadiumId,
            slug: teams.slug,
            name: teams.name,
            shortName: teams.shortName,
            crestUrl: teams.crestUrl,
            crestSource: teams.crestSource,
            heroImageUrl: teams.heroImageUrl,
            heroImageSource: teams.heroImageSource,
            website: teams.website,
            websiteSource: teams.websiteSource,
            country: teams.country,
            aliases: teams.aliases,
            shortDescription: teams.shortDescription,
            shortDescriptionSource: teams.shortDescriptionSource,
            description: teams.description,
            descriptionSource: teams.descriptionSource,
            externalId: teams.externalId,
            isActive: teams.isActive,
        }).from(teams).where(eq(teams.id, sourceTeamId)).limit(1),
        db.select({
            id: teams.id,
            leagueId: teams.leagueId,
            primaryStadiumId: teams.primaryStadiumId,
            slug: teams.slug,
            name: teams.name,
            shortName: teams.shortName,
            crestUrl: teams.crestUrl,
            crestSource: teams.crestSource,
            heroImageUrl: teams.heroImageUrl,
            heroImageSource: teams.heroImageSource,
            website: teams.website,
            websiteSource: teams.websiteSource,
            country: teams.country,
            aliases: teams.aliases,
            shortDescription: teams.shortDescription,
            shortDescriptionSource: teams.shortDescriptionSource,
            description: teams.description,
            descriptionSource: teams.descriptionSource,
            externalId: teams.externalId,
            isActive: teams.isActive,
        }).from(teams).where(eq(teams.id, targetTeamId)).limit(1),
    ]);

    if (!source || !target) {
        return c.json(apiError('NOT_FOUND', 'Source or target team not found'), 404);
    }

    if ((source.leagueId || null) !== (target.leagueId || null)) {
        return c.json(apiError('VALIDATION_ERROR', 'Teams must belong to the same league to merge'), 400);
    }

    const normalizedSourceName = normalizeDuplicateTeamName(source.name);
    const normalizedTargetName = normalizeDuplicateTeamName(target.name);
    if (!normalizedSourceName || normalizedSourceName !== normalizedTargetName) {
        return c.json(apiError('VALIDATION_ERROR', 'Teams must share the same normalized name to merge'), 400);
    }

    const mergedAliases = Array.from(new Set([
        ...(target.aliases || []),
        ...(source.aliases || []),
        source.name,
        source.shortName || '',
    ].map((value) => value.trim()).filter(Boolean)));

    const targetUpdates: Record<string, unknown> = {
        aliases: mergedAliases,
        isActive: target.isActive || source.isActive,
    };

    if (!normalizeOptionalText(target.shortName) && normalizeOptionalText(source.shortName)) {
        targetUpdates.shortName = source.shortName?.trim() || null;
    }
    if (!normalizeOptionalText(target.crestUrl) && normalizeOptionalText(source.crestUrl)) {
        targetUpdates.crestUrl = source.crestUrl;
        targetUpdates.crestSource = source.crestSource;
    }
    if (!normalizeOptionalText(target.heroImageUrl) && normalizeOptionalText(source.heroImageUrl)) {
        targetUpdates.heroImageUrl = source.heroImageUrl;
        targetUpdates.heroImageSource = source.heroImageSource;
    }
    if (!normalizeOptionalText(target.website) && normalizeOptionalText(source.website)) {
        targetUpdates.website = source.website;
        targetUpdates.websiteSource = source.websiteSource;
    }
    if (!normalizeOptionalText(target.country) && normalizeOptionalText(source.country)) {
        targetUpdates.country = source.country;
    }
    if (!normalizeOptionalText(target.shortDescription) && normalizeOptionalText(source.shortDescription)) {
        targetUpdates.shortDescription = source.shortDescription;
        targetUpdates.shortDescriptionSource = source.shortDescriptionSource;
    }
    if (!normalizeOptionalText(target.description) && normalizeOptionalText(source.description)) {
        targetUpdates.description = source.description;
        targetUpdates.descriptionSource = source.descriptionSource;
    }
    if (!normalizeOptionalText(target.externalId) && normalizeOptionalText(source.externalId)) {
        targetUpdates.externalId = source.externalId;
    }

    const [sourceLinkRows, targetLinkRows, sourceRosterRows, targetRosterRows] = await Promise.all([
        db.select({
            stadiumId: teamStadiumLinks.stadiumId,
            isPrimary: teamStadiumLinks.isPrimary,
            sortOrder: teamStadiumLinks.sortOrder,
        }).from(teamStadiumLinks).where(and(eq(teamStadiumLinks.teamId, sourceTeamId), eq(teamStadiumLinks.isActive, true))),
        db.select({
            stadiumId: teamStadiumLinks.stadiumId,
            isPrimary: teamStadiumLinks.isPrimary,
            sortOrder: teamStadiumLinks.sortOrder,
        }).from(teamStadiumLinks).where(and(eq(teamStadiumLinks.teamId, targetTeamId), eq(teamStadiumLinks.isActive, true))),
        db.select({
            playerId: teamRosterMembers.playerId,
            shirtNumber: teamRosterMembers.shirtNumber,
            position: teamRosterMembers.position,
            isCaptain: teamRosterMembers.isCaptain,
            sortOrder: teamRosterMembers.sortOrder,
            isActive: teamRosterMembers.isActive,
        }).from(teamRosterMembers).where(eq(teamRosterMembers.teamId, sourceTeamId)).orderBy(teamRosterMembers.sortOrder, teamRosterMembers.createdAt),
        db.select({
            playerId: teamRosterMembers.playerId,
            shirtNumber: teamRosterMembers.shirtNumber,
            position: teamRosterMembers.position,
            isCaptain: teamRosterMembers.isCaptain,
            sortOrder: teamRosterMembers.sortOrder,
            isActive: teamRosterMembers.isActive,
        }).from(teamRosterMembers).where(eq(teamRosterMembers.teamId, targetTeamId)).orderBy(teamRosterMembers.sortOrder, teamRosterMembers.createdAt),
    ]);

    const mergedPrimaryStadiumId = target.primaryStadiumId || source.primaryStadiumId || null;
    const mergedSecondaryStadiumIds = Array.from(new Set([
        ...targetLinkRows.filter((row) => !row.isPrimary).map((row) => row.stadiumId),
        ...sourceLinkRows.filter((row) => !row.isPrimary && row.stadiumId !== mergedPrimaryStadiumId).map((row) => row.stadiumId),
        ...sourceLinkRows.filter((row) => row.isPrimary && row.stadiumId !== mergedPrimaryStadiumId).map((row) => row.stadiumId),
    ]));
    const targetPlayerIds = new Set(targetRosterRows.map((row) => row.playerId));
    const mergedRosterMembers = [
        ...targetRosterRows.map((row, index) => ({
            playerId: row.playerId,
            shirtNumber: row.shirtNumber,
            position: row.position,
            isCaptain: row.isCaptain,
            sortOrder: row.sortOrder ?? index,
            isActive: row.isActive,
        })),
        ...sourceRosterRows
            .filter((row) => !targetPlayerIds.has(row.playerId))
            .map((row, index) => ({
                playerId: row.playerId,
                shirtNumber: row.shirtNumber,
                position: row.position,
                isCaptain: row.isCaptain,
                sortOrder: targetRosterRows.length + index,
                isActive: row.isActive,
            })),
    ];

    targetUpdates.primaryStadiumId = mergedPrimaryStadiumId;

    const sourceArchivedSlug = await allocateCanonicalSlug('team', `${source.name} archived`, {
        shortName: source.shortName,
        excludeId: source.id,
    });

    await db.transaction(async (tx) => {
        await tx.update(matches).set({ homeTeamId: targetTeamId }).where(eq(matches.homeTeamId, sourceTeamId));
        await tx.update(matches).set({ awayTeamId: targetTeamId }).where(eq(matches.awayTeamId, sourceTeamId));
        await tx.update(matchParticipants).set({ teamId: targetTeamId }).where(eq(matchParticipants.teamId, sourceTeamId));
        await tx.update(standingsRows).set({ teamId: targetTeamId }).where(eq(standingsRows.teamId, sourceTeamId));

        await tx.execute(sql`
            delete from user_team_interests as source_interest
            using user_team_interests as target_interest
            where source_interest.user_id = target_interest.user_id
              and source_interest.team_id = ${sourceTeamId}
              and target_interest.team_id = ${targetTeamId}
        `);
        await tx.update(userTeamInterests).set({ teamId: targetTeamId }).where(eq(userTeamInterests.teamId, sourceTeamId));

        await tx.update(teams).set(targetUpdates).where(eq(teams.id, targetTeamId));
        await syncTeamStadiumState(tx, targetTeamId, mergedPrimaryStadiumId, mergedSecondaryStadiumIds);
        await syncTeamRosterState(tx, targetTeamId, mergedRosterMembers);
        await tx.delete(teamStadiumLinks).where(eq(teamStadiumLinks.teamId, sourceTeamId));
        await tx.delete(teamRosterMembers).where(eq(teamRosterMembers.teamId, sourceTeamId));

        if (source.slug && source.slug !== target.slug) {
            await tx.insert(entitySlugRedirects).values({
                entityType: 'team',
                entityId: targetTeamId,
                slug: source.slug,
                updatedAt: new Date(),
            }).onConflictDoNothing();
        }

        await tx.update(teams).set({
            slug: sourceArchivedSlug,
            externalId: null,
            isActive: false,
        }).where(eq(teams.id, sourceTeamId));
    });

    return c.json(apiResponse({
        message: 'Team merged',
        sourceTeamId,
        targetTeamId,
        targetSlug: target.slug,
    }));
});

superAdminRoutes.delete('/teams/:teamId', async (c) => {
    const teamId = c.req.param('teamId');
    const [existing] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, teamId)).limit(1);
    if (!existing) return c.json(apiError('NOT_FOUND', 'Team not found'), 404);

    await db.update(teams).set({ isActive: false }).where(eq(teams.id, teamId));
    return c.json(apiResponse({ message: 'Team archived' }));
});

superAdminRoutes.get('/stadiums', async (c) => {
    const parsed = stadiumSearchQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid query', parsed.error.issues), 400);
    }

    const search = parsed.data.search.trim();
    const filters = [];
    if (!parsed.data.includeInactive) filters.push(eq(stadiums.isActive, true));
    if (search) {
        filters.push(or(
            ilike(stadiums.name, `%${search}%`),
            ilike(stadiums.shortName, `%${search}%`),
            ilike(stadiums.slug, `%${search}%`),
            ilike(stadiums.city, `%${search}%`),
            ilike(stadiums.country, `%${search}%`),
        )!);
    }
    const where = filters.length > 0 ? and(...filters) : undefined;

    if (!parsed.data.page) {
        const rows = await db.select({
            id: stadiums.id,
            name: stadiums.name,
            city: stadiums.city,
            country: stadiums.country,
        }).from(stadiums).where(where).orderBy(stadiums.name).limit(parsed.data.limit);

        return c.json(apiResponse(rows));
    }

    const page = parsed.data.page;
    const offset = paginationOffset(page, parsed.data.limit);
    const [rows, [totalResult]] = await Promise.all([
        db.select({
            id: stadiums.id,
            slug: stadiums.slug,
            name: stadiums.name,
            shortName: stadiums.shortName,
            imageUrl: stadiums.imageUrl,
            heroImageUrl: stadiums.heroImageUrl,
            shortDescription: stadiums.shortDescription,
            description: stadiums.description,
            website: stadiums.website,
            addressLine1: stadiums.addressLine1,
            city: stadiums.city,
            stateProvince: stadiums.stateProvince,
            country: stadiums.country,
            postalCode: stadiums.postalCode,
            lat: stadiums.lat,
            lng: stadiums.lng,
            capacity: stadiums.capacity,
            openedYear: stadiums.openedYear,
            surface: stadiums.surface,
            aliases: stadiums.aliases,
            googlePlaceId: stadiums.googlePlaceId,
            googleSourceSnapshot: stadiums.googleSourceSnapshot,
            googleLastSyncedAt: stadiums.googleLastSyncedAt,
            googleSyncStatus: stadiums.googleSyncStatus,
            googleSyncError: stadiums.googleSyncError,
            enrichmentSnapshot: stadiums.enrichmentSnapshot,
            enrichedAt: stadiums.enrichedAt,
            enrichmentStatus: stadiums.enrichmentStatus,
            enrichmentError: stadiums.enrichmentError,
            imageSource: stadiums.imageSource,
            heroImageSource: stadiums.heroImageSource,
            websiteSource: stadiums.websiteSource,
            shortDescriptionSource: stadiums.shortDescriptionSource,
            descriptionSource: stadiums.descriptionSource,
            externalId: stadiums.externalId,
            isActive: stadiums.isActive,
            createdAt: stadiums.createdAt,
            updatedAt: stadiums.updatedAt,
        }).from(stadiums).where(where).orderBy(stadiums.name).limit(parsed.data.limit).offset(offset),
        db.select({ count: count() }).from(stadiums).where(where),
    ]);

    if (rows.length === 0) {
        return c.json(apiResponse([], paginationMeta(page, parsed.data.limit, Number(totalResult?.count || 0))));
    }

    const [teamCounts, linkedTeams] = await Promise.all([
        db.select({
            stadiumId: matches.stadiumId,
            count: count(),
        }).from(matches).where(and(inArray(matches.stadiumId, rows.map((row) => row.id)), eq(matches.status, 'FINISHED'))).groupBy(matches.stadiumId),
        db.select({
            stadiumId: teamStadiumLinks.stadiumId,
            teamId: teams.id,
            teamName: teams.name,
            teamSlug: teams.slug,
            isPrimary: teamStadiumLinks.isPrimary,
        }).from(teamStadiumLinks)
            .innerJoin(teams, eq(teamStadiumLinks.teamId, teams.id))
            .where(and(
                inArray(teamStadiumLinks.stadiumId, rows.map((row) => row.id)),
                eq(teamStadiumLinks.isActive, true),
                eq(teams.isActive, true),
            ))
            .orderBy(teamStadiumLinks.sortOrder, teams.name),
    ]);
    const teamCountByStadiumId = new Map(teamCounts.map((row) => [row.stadiumId, Number(row.count || 0)]));
    const linkedTeamsByStadiumId = new Map<string, Array<{ id: string; name: string; slug: string; isPrimary: boolean }>>();
    for (const row of linkedTeams) {
        const existing = linkedTeamsByStadiumId.get(row.stadiumId) || [];
        existing.push({ id: row.teamId, name: row.teamName, slug: row.teamSlug, isPrimary: row.isPrimary });
        linkedTeamsByStadiumId.set(row.stadiumId, existing);
    }

    return c.json(apiResponse(rows.map((row) => ({
        ...row,
        teamCount: teamCountByStadiumId.get(row.id) || 0,
        linkedTeams: linkedTeamsByStadiumId.get(row.id) || [],
    })), paginationMeta(page, parsed.data.limit, Number(totalResult?.count || 0))));
});

superAdminRoutes.post('/stadiums', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = createStadiumSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const trimmedName = parsed.data.name.trim();
    const trimmedCity = parsed.data.city?.trim() || null;
    const trimmedCountry = parsed.data.country?.trim() || null;
    const [existingStadium] = await db.select({
        id: stadiums.id,
        name: stadiums.name,
        city: stadiums.city,
        country: stadiums.country,
    }).from(stadiums)
        .where(and(
            eq(stadiums.isActive, true),
            eq(stadiums.name, trimmedName),
            trimmedCity ? eq(stadiums.city, trimmedCity) : sql`${stadiums.city} IS NULL`,
            trimmedCountry ? eq(stadiums.country, trimmedCountry) : sql`${stadiums.country} IS NULL`,
        ))
        .limit(1);
    if (existingStadium) return c.json(apiResponse(existingStadium), 200);

    const [created] = await db.insert(stadiums).values({
        name: trimmedName,
        slug: await allocateCanonicalSlug('stadium', trimmedName, { shortName: parsed.data.shortName?.trim() || null }),
        shortName: parsed.data.shortName?.trim() || null,
        imageUrl: parsed.data.imageUrl?.trim() || null,
        heroImageUrl: parsed.data.heroImageUrl?.trim() || null,
        shortDescription: parsed.data.shortDescription?.trim() || null,
        description: parsed.data.description?.trim() || null,
        website: parsed.data.website?.trim() || null,
        addressLine1: parsed.data.addressLine1?.trim() || null,
        city: trimmedCity,
        stateProvince: parsed.data.stateProvince?.trim() || null,
        country: trimmedCountry,
        postalCode: parsed.data.postalCode?.trim() || null,
        lat: parsed.data.lat != null ? String(parsed.data.lat) : null,
        lng: parsed.data.lng != null ? String(parsed.data.lng) : null,
        capacity: parsed.data.capacity ?? null,
        openedYear: parsed.data.openedYear ?? null,
        surface: parsed.data.surface?.trim() || null,
        aliases: parsed.data.aliases?.map((item) => item.trim()).filter(Boolean) || [],
        shortDescriptionSource: parsed.data.shortDescription?.trim() ? 'MANUAL' : 'NONE',
        descriptionSource: parsed.data.description?.trim() ? 'MANUAL' : 'NONE',
        imageSource: parsed.data.imageUrl?.trim() ? 'MANUAL' : 'NONE',
        heroImageSource: parsed.data.heroImageUrl?.trim() ? 'MANUAL' : 'NONE',
        websiteSource: parsed.data.website?.trim() ? 'MANUAL' : 'NONE',
        googlePlaceId: parsed.data.googlePlaceId?.trim() || null,
        googleSourceSnapshot: parsed.data.googleSourceSnapshot || {},
        googleLastSyncedAt: parsed.data.googlePlaceId ? new Date() : null,
        googleSyncStatus: parsed.data.googlePlaceId ? 'SYNCED' : 'NEVER_SYNCED',
        googleSyncError: null,
        externalId: parsed.data.externalId?.trim() || null,
        isActive: parsed.data.isActive,
    }).returning({
        id: stadiums.id,
        slug: stadiums.slug,
        name: stadiums.name,
        shortName: stadiums.shortName,
        imageUrl: stadiums.imageUrl,
        heroImageUrl: stadiums.heroImageUrl,
        shortDescription: stadiums.shortDescription,
        description: stadiums.description,
        website: stadiums.website,
        city: stadiums.city,
        country: stadiums.country,
        isActive: stadiums.isActive,
    });

    return c.json(apiResponse(created), 201);
});

superAdminRoutes.patch('/stadiums/:stadiumId', async (c) => {
    const stadiumId = c.req.param('stadiumId');
    const body = await c.req.json().catch(() => ({}));
    const parsed = updateStadiumSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const [existing] = await db.select({
        id: stadiums.id,
        imageUrl: stadiums.imageUrl,
        imageSource: stadiums.imageSource,
        heroImageUrl: stadiums.heroImageUrl,
        heroImageSource: stadiums.heroImageSource,
        website: stadiums.website,
        websiteSource: stadiums.websiteSource,
        shortDescription: stadiums.shortDescription,
        shortDescriptionSource: stadiums.shortDescriptionSource,
        description: stadiums.description,
        descriptionSource: stadiums.descriptionSource,
        googlePlaceId: stadiums.googlePlaceId,
        googleSourceSnapshot: stadiums.googleSourceSnapshot,
    }).from(stadiums).where(eq(stadiums.id, stadiumId)).limit(1);
    if (!existing) return c.json(apiError('NOT_FOUND', 'Stadium not found'), 404);

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
    if (parsed.data.shortName !== undefined) updates.shortName = parsed.data.shortName?.trim() || null;
    if (parsed.data.imageUrl !== undefined) {
        updates.imageUrl = parsed.data.imageUrl?.trim() || null;
        updates.imageSource = resolveUpdatedFieldSource(parsed.data.imageUrl, existing.imageUrl, existing.imageSource);
    }
    if (parsed.data.heroImageUrl !== undefined) {
        updates.heroImageUrl = parsed.data.heroImageUrl?.trim() || null;
        updates.heroImageSource = resolveUpdatedFieldSource(parsed.data.heroImageUrl, existing.heroImageUrl, existing.heroImageSource);
    }
    if (parsed.data.website !== undefined) {
        updates.website = parsed.data.website?.trim() || null;
        updates.websiteSource = resolveUpdatedFieldSource(parsed.data.website, existing.website, existing.websiteSource);
    }
    if (parsed.data.shortDescription !== undefined) {
        updates.shortDescription = parsed.data.shortDescription?.trim() || null;
        updates.shortDescriptionSource = resolveUpdatedFieldSource(parsed.data.shortDescription, existing.shortDescription, existing.shortDescriptionSource);
    }
    if (parsed.data.description !== undefined) {
        updates.description = parsed.data.description?.trim() || null;
        updates.descriptionSource = resolveUpdatedFieldSource(parsed.data.description, existing.description, existing.descriptionSource);
    }
    if (parsed.data.addressLine1 !== undefined) updates.addressLine1 = parsed.data.addressLine1?.trim() || null;
    if (parsed.data.city !== undefined) updates.city = parsed.data.city?.trim() || null;
    if (parsed.data.stateProvince !== undefined) updates.stateProvince = parsed.data.stateProvince?.trim() || null;
    if (parsed.data.country !== undefined) updates.country = parsed.data.country?.trim() || null;
    if (parsed.data.postalCode !== undefined) updates.postalCode = parsed.data.postalCode?.trim() || null;
    if (parsed.data.lat !== undefined) updates.lat = parsed.data.lat != null ? String(parsed.data.lat) : null;
    if (parsed.data.lng !== undefined) updates.lng = parsed.data.lng != null ? String(parsed.data.lng) : null;
    if (parsed.data.capacity !== undefined) updates.capacity = parsed.data.capacity ?? null;
    if (parsed.data.openedYear !== undefined) updates.openedYear = parsed.data.openedYear ?? null;
    if (parsed.data.surface !== undefined) updates.surface = parsed.data.surface?.trim() || null;
    if (parsed.data.aliases !== undefined) updates.aliases = parsed.data.aliases.map((item) => item.trim()).filter(Boolean);
    if (parsed.data.externalId !== undefined) updates.externalId = parsed.data.externalId?.trim() || null;
    if (parsed.data.googlePlaceId !== undefined) {
        updates.googlePlaceId = parsed.data.googlePlaceId?.trim() || null;
        updates.googleLastSyncedAt = parsed.data.googlePlaceId ? new Date() : null;
        updates.googleSyncStatus = parsed.data.googlePlaceId ? 'SYNCED' : 'NEVER_SYNCED';
        updates.googleSyncError = null;
    }
    if (parsed.data.googleSourceSnapshot !== undefined) {
        updates.googleSourceSnapshot = parsed.data.googleSourceSnapshot || {};
        updates.googleLastSyncedAt = parsed.data.googleSourceSnapshot ? new Date() : null;
        updates.googleSyncStatus = parsed.data.googleSourceSnapshot ? 'SYNCED' : (parsed.data.googlePlaceId || existing.googlePlaceId ? 'SYNCED' : 'NEVER_SYNCED');
        updates.googleSyncError = null;
    }
    if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

    await db.update(stadiums).set(updates).where(eq(stadiums.id, stadiumId));
    return c.json(apiResponse({ message: 'Stadium updated' }));
});

superAdminRoutes.post('/stadiums/:stadiumId/merge', async (c) => {
    const sourceStadiumId = c.req.param('stadiumId');
    const body = await c.req.json().catch(() => ({}));
    const parsed = mergeStadiumSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const targetStadiumId = parsed.data.targetStadiumId;
    if (sourceStadiumId === targetStadiumId) {
        return c.json(apiError('VALIDATION_ERROR', 'Source and target stadiums must be different'), 400);
    }

    const [[source], [target]] = await Promise.all([
        db.select().from(stadiums).where(eq(stadiums.id, sourceStadiumId)).limit(1),
        db.select().from(stadiums).where(eq(stadiums.id, targetStadiumId)).limit(1),
    ]);

    if (!source || !target) {
        return c.json(apiError('NOT_FOUND', 'Source or target stadium not found'), 404);
    }

    const sourceKey = normalizeDuplicateStadiumKey(source.name, source.city, source.country);
    const targetKey = normalizeDuplicateStadiumKey(target.name, target.city, target.country);
    if (!sourceKey || sourceKey !== targetKey) {
        return c.json(apiError('VALIDATION_ERROR', 'Stadiums must share the same normalized name and location to merge'), 400);
    }

    const mergedAliases = Array.from(new Set([
        ...(target.aliases || []),
        ...(source.aliases || []),
        source.name,
        source.shortName || '',
    ].map((value) => value.trim()).filter(Boolean)));

    const targetUpdates: Record<string, unknown> = {
        aliases: mergedAliases,
        isActive: target.isActive || source.isActive,
        updatedAt: new Date(),
    };

    if (!normalizeOptionalText(target.shortName) && normalizeOptionalText(source.shortName)) targetUpdates.shortName = source.shortName;
    if (!normalizeOptionalText(target.imageUrl) && normalizeOptionalText(source.imageUrl)) {
        targetUpdates.imageUrl = source.imageUrl;
        targetUpdates.imageSource = source.imageSource;
    }
    if (!normalizeOptionalText(target.heroImageUrl) && normalizeOptionalText(source.heroImageUrl)) {
        targetUpdates.heroImageUrl = source.heroImageUrl;
        targetUpdates.heroImageSource = source.heroImageSource;
    }
    if (!normalizeOptionalText(target.website) && normalizeOptionalText(source.website)) {
        targetUpdates.website = source.website;
        targetUpdates.websiteSource = source.websiteSource;
    }
    if (!normalizeOptionalText(target.shortDescription) && normalizeOptionalText(source.shortDescription)) {
        targetUpdates.shortDescription = source.shortDescription;
        targetUpdates.shortDescriptionSource = source.shortDescriptionSource;
    }
    if (!normalizeOptionalText(target.description) && normalizeOptionalText(source.description)) {
        targetUpdates.description = source.description;
        targetUpdates.descriptionSource = source.descriptionSource;
    }
    if (!normalizeOptionalText(target.addressLine1) && normalizeOptionalText(source.addressLine1)) targetUpdates.addressLine1 = source.addressLine1;
    if (!normalizeOptionalText(target.city) && normalizeOptionalText(source.city)) targetUpdates.city = source.city;
    if (!normalizeOptionalText(target.stateProvince) && normalizeOptionalText(source.stateProvince)) targetUpdates.stateProvince = source.stateProvince;
    if (!normalizeOptionalText(target.country) && normalizeOptionalText(source.country)) targetUpdates.country = source.country;
    if (!normalizeOptionalText(target.postalCode) && normalizeOptionalText(source.postalCode)) targetUpdates.postalCode = source.postalCode;
    if (target.lat == null && source.lat != null) targetUpdates.lat = source.lat;
    if (target.lng == null && source.lng != null) targetUpdates.lng = source.lng;
    if (target.capacity == null && source.capacity != null) targetUpdates.capacity = source.capacity;
    if (target.openedYear == null && source.openedYear != null) targetUpdates.openedYear = source.openedYear;
    if (!normalizeOptionalText(target.surface) && normalizeOptionalText(source.surface)) targetUpdates.surface = source.surface;
    if (!normalizeOptionalText(target.externalId) && normalizeOptionalText(source.externalId)) targetUpdates.externalId = source.externalId;
    if (!normalizeOptionalText(target.googlePlaceId) && normalizeOptionalText(source.googlePlaceId)) {
        targetUpdates.googlePlaceId = source.googlePlaceId;
        targetUpdates.googleSourceSnapshot = source.googleSourceSnapshot;
        targetUpdates.googleLastSyncedAt = source.googleLastSyncedAt || new Date();
        targetUpdates.googleSyncStatus = source.googleSyncStatus;
        targetUpdates.googleSyncError = source.googleSyncError;
    }
    if ((target.enrichmentStatus === 'NEVER_SYNCED' || !target.enrichedAt) && source.enrichmentStatus === 'SYNCED') {
        targetUpdates.enrichmentSnapshot = source.enrichmentSnapshot;
        targetUpdates.enrichedAt = source.enrichedAt;
        targetUpdates.enrichmentStatus = source.enrichmentStatus;
        targetUpdates.enrichmentError = source.enrichmentError;
    }

    const sourceArchivedSlug = await allocateCanonicalSlug('stadium', `${source.name} archived`, {
        shortName: source.shortName,
        excludeId: source.id,
    });

    await db.transaction(async (tx) => {
        const sourceLinkedTeamRows = await tx.select({ teamId: teamStadiumLinks.teamId }).from(teamStadiumLinks).where(eq(teamStadiumLinks.stadiumId, sourceStadiumId));
        const targetLinkedTeamRows = await tx.select({ teamId: teamStadiumLinks.teamId }).from(teamStadiumLinks).where(eq(teamStadiumLinks.stadiumId, targetStadiumId));
        const sourcePrimaryTeamRows = await tx.select({ id: teams.id }).from(teams).where(eq(teams.primaryStadiumId, sourceStadiumId));
        const targetPrimaryTeamRows = await tx.select({ id: teams.id }).from(teams).where(eq(teams.primaryStadiumId, targetStadiumId));
        const affectedTeamIds = Array.from(new Set([
            ...sourceLinkedTeamRows.map((row) => row.teamId),
            ...targetLinkedTeamRows.map((row) => row.teamId),
            ...sourcePrimaryTeamRows.map((row) => row.id),
            ...targetPrimaryTeamRows.map((row) => row.id),
        ]));

        await tx.update(matches).set({ stadiumId: targetStadiumId, updatedAt: new Date() }).where(eq(matches.stadiumId, sourceStadiumId));

        await tx.execute(sql`
            delete from team_stadium_links as source_link
            using team_stadium_links as target_link
            where source_link.team_id = target_link.team_id
              and source_link.stadium_id = ${sourceStadiumId}
              and target_link.stadium_id = ${targetStadiumId}
        `);
        await tx.update(teamStadiumLinks).set({ stadiumId: targetStadiumId, updatedAt: new Date() }).where(eq(teamStadiumLinks.stadiumId, sourceStadiumId));
        await tx.update(teams).set({ primaryStadiumId: targetStadiumId }).where(eq(teams.primaryStadiumId, sourceStadiumId));
        await tx.update(stadiums).set(targetUpdates).where(eq(stadiums.id, targetStadiumId));

        for (const teamId of affectedTeamIds) {
            const [team] = await tx.select({ primaryStadiumId: teams.primaryStadiumId }).from(teams).where(eq(teams.id, teamId)).limit(1);
            if (!team) continue;
            const links = await tx.select({ stadiumId: teamStadiumLinks.stadiumId, isPrimary: teamStadiumLinks.isPrimary })
                .from(teamStadiumLinks)
                .where(and(eq(teamStadiumLinks.teamId, teamId), eq(teamStadiumLinks.isActive, true)));
            const secondaryStadiumIds = links
                .map((row) => row.stadiumId)
                .filter((stadiumId) => stadiumId !== team.primaryStadiumId);
            await syncTeamStadiumState(tx, teamId, team.primaryStadiumId || null, secondaryStadiumIds);
        }

        if (source.slug && source.slug !== target.slug) {
            await tx.insert(entitySlugRedirects).values({
                entityType: 'stadium',
                entityId: targetStadiumId,
                slug: source.slug,
                updatedAt: new Date(),
            }).onConflictDoNothing();
        }

        await tx.update(stadiums).set({
            slug: sourceArchivedSlug,
            externalId: null,
            googlePlaceId: null,
            isActive: false,
            updatedAt: new Date(),
        }).where(eq(stadiums.id, sourceStadiumId));
    });

    return c.json(apiResponse({
        message: 'Stadium merged',
        sourceStadiumId,
        targetStadiumId,
        targetSlug: target.slug,
    }));
});

superAdminRoutes.delete('/stadiums/:stadiumId', async (c) => {
    const stadiumId = c.req.param('stadiumId');
    const [existing] = await db.select({ id: stadiums.id }).from(stadiums).where(eq(stadiums.id, stadiumId)).limit(1);
    if (!existing) return c.json(apiError('NOT_FOUND', 'Stadium not found'), 404);

    await db.update(stadiums).set({ isActive: false, updatedAt: new Date() }).where(eq(stadiums.id, stadiumId));
    return c.json(apiResponse({ message: 'Stadium archived' }));
});

// Sports
superAdminRoutes.get('/sports', async (c) => {
    const parsed = paginationQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid query', parsed.error.issues), 400);
    }
    const { page, limit, search } = parsed.data;
    const offset = paginationOffset(page, limit);
    const where = search
        ? or(
            ilike(sports.name, `%${search}%`),
            ilike(sports.slug, `%${search}%`),
            ilike(sports.shortName, `%${search}%`),
        )
        : undefined;

    const [rows, [totalResult]] = await Promise.all([
        db.select({
            id: sports.id,
            name: sports.name,
            slug: sports.slug,
            shortName: sports.shortName,
            sortOrder: sports.sortOrder,
            isActive: sports.isActive,
            createdAt: sports.createdAt,
            updatedAt: sports.updatedAt,
        }).from(sports).where(where).orderBy(sports.sortOrder, sports.name).limit(limit).offset(offset),
        db.select({ count: count() }).from(sports).where(where),
    ]);

    return c.json(apiResponse(rows, paginationMeta(page, limit, Number(totalResult?.count || 0))));
});

superAdminRoutes.post('/sports', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = createSportSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const [existing] = await db.select({ id: sports.id }).from(sports).where(or(
        eq(sports.slug, parsed.data.slug),
        eq(sports.name, parsed.data.name),
    )).limit(1);
    if (existing) return c.json(apiError('CONFLICT', 'Sport already exists'), 409);

    const [created] = await db.insert(sports).values({
        name: parsed.data.name.trim(),
        slug: parsed.data.slug.trim(),
        shortName: parsed.data.shortName?.trim() || null,
        sortOrder: parsed.data.sortOrder,
        isActive: parsed.data.isActive,
    }).returning();

    return c.json(apiResponse(created), 201);
});

superAdminRoutes.patch('/sports/:sportId', async (c) => {
    const sportId = c.req.param('sportId');
    const body = await c.req.json().catch(() => ({}));
    const parsed = updateSportSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const [existing] = await db.select({ id: sports.id }).from(sports).where(eq(sports.id, sportId)).limit(1);
    if (!existing) return c.json(apiError('NOT_FOUND', 'Sport not found'), 404);

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.slug !== undefined) updates.slug = parsed.data.slug;
    if (parsed.data.shortName !== undefined) updates.shortName = parsed.data.shortName;
    if (parsed.data.sortOrder !== undefined) updates.sortOrder = parsed.data.sortOrder;
    if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

    await db.update(sports).set(updates).where(eq(sports.id, sportId));
    return c.json(apiResponse({ message: 'Sport updated' }));
});

superAdminRoutes.delete('/sports/:sportId', async (c) => {
    const sportId = c.req.param('sportId');
    const [existing] = await db.select({ id: sports.id }).from(sports).where(eq(sports.id, sportId)).limit(1);
    if (!existing) return c.json(apiError('NOT_FOUND', 'Sport not found'), 404);

    const [linkedLeagues] = await db.select({ count: count() }).from(leagues).where(and(eq(leagues.sportId, sportId), eq(leagues.isActive, true)));
    if (Number(linkedLeagues?.count || 0) > 0) {
        return c.json(apiError('CONFLICT', 'Sport has active leagues. Reassign or deactivate leagues first.'), 409);
    }

    await db.update(sports).set({
        isActive: false,
        updatedAt: new Date(),
    }).where(eq(sports.id, sportId));
    return c.json(apiResponse({ message: 'Sport archived' }));
});

// Leagues
superAdminRoutes.get('/leagues', async (c) => {
    const parsed = paginationQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid query', parsed.error.issues), 400);
    }
    const { page, limit, search } = parsed.data;
    const offset = paginationOffset(page, limit);
    const where = search
        ? or(
            ilike(leagues.name, `%${search}%`),
            ilike(leagues.shortName, `%${search}%`),
            ilike(leagues.externalId, `%${search}%`),
            ilike(sports.name, `%${search}%`),
        )
        : undefined;

    const [rows, [totalResult]] = await Promise.all([
        db.select({
            id: leagues.id,
            sportId: leagues.sportId,
            sportName: sports.name,
            sportSlug: sports.slug,
            slug: leagues.slug,
            name: leagues.name,
            shortName: leagues.shortName,
            logoUrl: leagues.logoUrl,
            externalId: leagues.externalId,
            country: leagues.country,
            enrichedAt: leagues.enrichedAt,
            enrichmentStatus: leagues.enrichmentStatus,
            enrichmentError: leagues.enrichmentError,
            sortOrder: leagues.sortOrder,
            isActive: leagues.isActive,
            createdAt: leagues.createdAt,
            updatedAt: leagues.updatedAt,
        })
            .from(leagues)
            .leftJoin(sports, eq(leagues.sportId, sports.id))
            .where(where)
            .orderBy(leagues.sortOrder, leagues.name)
            .limit(limit)
            .offset(offset),
        db.select({ count: count() })
            .from(leagues)
            .leftJoin(sports, eq(leagues.sportId, sports.id))
            .where(where),
    ]);

    return c.json(apiResponse(rows, paginationMeta(page, limit, Number(totalResult?.count || 0))));
});

superAdminRoutes.post('/leagues', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = createLeagueSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const [sport] = await db.select({ id: sports.id }).from(sports).where(and(eq(sports.id, parsed.data.sportId), eq(sports.isActive, true))).limit(1);
    if (!sport) return c.json(apiError('NOT_FOUND', 'Sport not found'), 404);

    const trimmedName = parsed.data.name.trim();
    const [created] = await db.insert(leagues).values({
        sportId: parsed.data.sportId,
        name: trimmedName,
        slug: await allocateCanonicalSlug('league', trimmedName, { shortName: parsed.data.shortName?.trim() || null }),
        shortName: parsed.data.shortName?.trim() || null,
        logoUrl: parsed.data.logoUrl || null,
        logoSource: parsed.data.logoUrl?.trim() ? 'MANUAL' : 'NONE',
        externalId: parsed.data.externalId?.trim() || null,
        country: parsed.data.country?.trim() || null,
        sortOrder: parsed.data.sortOrder,
        isActive: parsed.data.isActive,
    }).returning();

    return c.json(apiResponse(created), 201);
});

superAdminRoutes.patch('/leagues/:leagueId', async (c) => {
    const leagueId = c.req.param('leagueId');
    const body = await c.req.json().catch(() => ({}));
    const parsed = updateLeagueSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const [existingLeague] = await db.select({
        id: leagues.id,
        logoUrl: leagues.logoUrl,
        logoSource: leagues.logoSource,
    }).from(leagues).where(eq(leagues.id, leagueId)).limit(1);
    if (!existingLeague) return c.json(apiError('NOT_FOUND', 'League not found'), 404);

    if (parsed.data.sportId) {
        const [sport] = await db.select({ id: sports.id }).from(sports).where(and(eq(sports.id, parsed.data.sportId), eq(sports.isActive, true))).limit(1);
        if (!sport) return c.json(apiError('NOT_FOUND', 'Sport not found'), 404);
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.sportId !== undefined) updates.sportId = parsed.data.sportId;
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.shortName !== undefined) updates.shortName = parsed.data.shortName;
    if (parsed.data.logoUrl !== undefined) {
        updates.logoUrl = parsed.data.logoUrl;
        updates.logoSource = resolveUpdatedFieldSource(parsed.data.logoUrl, existingLeague.logoUrl, existingLeague.logoSource);
    }
    if (parsed.data.externalId !== undefined) updates.externalId = parsed.data.externalId;
    if (parsed.data.country !== undefined) updates.country = parsed.data.country;
    if (parsed.data.sortOrder !== undefined) updates.sortOrder = parsed.data.sortOrder;
    if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

    await db.update(leagues).set(updates).where(eq(leagues.id, leagueId));
    return c.json(apiResponse({ message: 'League updated' }));
});

superAdminRoutes.delete('/leagues/:leagueId', async (c) => {
    const leagueId = c.req.param('leagueId');
    const [existingLeague] = await db.select({ id: leagues.id }).from(leagues).where(eq(leagues.id, leagueId)).limit(1);
    if (!existingLeague) return c.json(apiError('NOT_FOUND', 'League not found'), 404);

    await db.update(leagues).set({
        isActive: false,
        updatedAt: new Date(),
    }).where(eq(leagues.id, leagueId));

    return c.json(apiResponse({ message: 'League archived' }));
});

// Users
superAdminRoutes.get('/users', async (c) => {
    const parsed = paginationQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid query', parsed.error.issues), 400);
    }
    const { page, limit, search } = parsed.data;
    const offset = paginationOffset(page, limit);
    const where = search
        ? or(
            ilike(users.email, `%${search}%`),
            ilike(users.name, `%${search}%`),
        )
        : undefined;

    const [rows, [totalResult]] = await Promise.all([
        db.select({
            id: users.id,
            email: users.email,
            name: users.name,
            role: users.role,
            isActive: users.isActive,
            isSuspended: users.isSuspended,
            emailVerified: users.emailVerified,
            createdAt: users.createdAt,
            lastLoginAt: users.lastLoginAt,
            avatarUrl: users.avatarUrl,
        }).from(users).where(where).orderBy(desc(users.createdAt)).limit(limit).offset(offset),
        db.select({ count: count() }).from(users).where(where),
    ]);

    return c.json(apiResponse(rows, paginationMeta(page, limit, Number(totalResult?.count || 0))));
});

superAdminRoutes.post('/users', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const email = parsed.data.email.trim().toLowerCase();
    const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existingUser) {
        return c.json(apiError('CONFLICT', 'User with this email already exists'), 409);
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const [created] = await db.insert(users).values({
        email,
        passwordHash,
        name: parsed.data.name.trim(),
        role: parsed.data.role,
        emailVerified: true,
        isActive: true,
        timezone: 'UTC',
        locale: 'en',
    }).returning({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
    });

    return c.json(apiResponse(created), 201);
});

superAdminRoutes.patch('/users/:userId', async (c) => {
    const userId = c.req.param('userId');
    const body = await c.req.json().catch(() => ({}));
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
    if (!existingUser) {
        return c.json(apiError('NOT_FOUND', 'User not found'), 404);
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.email) updates.email = parsed.data.email.trim().toLowerCase();
    if (parsed.data.name) updates.name = parsed.data.name.trim();
    if (parsed.data.role) updates.role = parsed.data.role;
    if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;
    if (parsed.data.isSuspended !== undefined) updates.isSuspended = parsed.data.isSuspended;
    if (parsed.data.password) {
        updates.passwordHash = await hashPassword(parsed.data.password);
        updates.failedLoginAttempts = 0;
        updates.lockedUntil = null;
    }

    await db.update(users).set(updates).where(eq(users.id, userId));

    return c.json(apiResponse({ message: 'User updated' }));
});

superAdminRoutes.delete('/users/:userId', async (c) => {
    const userId = c.req.param('userId');
    const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
    if (!existingUser) return c.json(apiError('NOT_FOUND', 'User not found'), 404);

    await db.update(users).set({
        isActive: false,
        isSuspended: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
    }).where(eq(users.id, userId));

    return c.json(apiResponse({ message: 'User deactivated' }));
});

// Venues
superAdminRoutes.get('/venues', async (c) => {
    const parsed = paginationQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid query', parsed.error.issues), 400);
    }
    const { page, limit, search } = parsed.data;
    const offset = paginationOffset(page, limit);

    const where = search
        ? or(
            ilike(venues.name, `%${search}%`),
            ilike(venues.city, `%${search}%`),
            ilike(venues.addressLine1, `%${search}%`),
        )
        : undefined;

    const [rows, [totalResult]] = await Promise.all([
        db.select({
            id: venues.id,
            ownerId: venues.ownerId,
            ownerEmail: users.email,
            ownerName: users.name,
            name: venues.name,
            slug: venues.slug,
            description: venues.description,
            descriptionSource: venues.descriptionSource,
            shortDescription: venues.shortDescription,
            shortDescriptionSource: venues.shortDescriptionSource,
            addressLine1: venues.addressLine1,
            addressLine2: venues.addressLine2,
            city: venues.city,
            stateProvince: venues.stateProvince,
            country: venues.country,
            postalCode: venues.postalCode,
            lat: venues.lat,
            lng: venues.lng,
            timezone: venues.timezone,
            coverImageUrl: venues.coverImageUrl,
            coverImageS3Key: venues.coverImageS3Key,
            galleryS3Keys: venues.galleryS3Keys,
            phone: venues.phone,
            website: venues.website,
            instagramHandle: venues.instagramHandle,
            googleMapsUrl: venues.googleMapsUrl,
            googlePlaceId: venues.googlePlaceId,
            approvalStatus: venues.approvalStatus,
            approvalNotes: venues.approvalNotes,
            menuSource: venues.menuSource,
            capacity: venues.capacity,
            amenities: venues.amenities,
            vibes: venues.vibes,
            cuisineTags: venues.cuisineTags,
            priceRange: venues.priceRange,
            priceRangeSource: venues.priceRangeSource,
            ratingOverride: venues.ratingOverride,
            reviewCountOverride: venues.reviewCountOverride,
            googleSourceSnapshot: venues.googleSourceSnapshot,
            metadata: venues.metadata,
            isActive: venues.isActive,
            isVerified: venues.isVerified,
            isFeatured: venues.isFeatured,
            createdAt: venues.createdAt,
            updatedAt: venues.updatedAt,
        })
            .from(venues)
            .leftJoin(users, eq(venues.ownerId, users.id))
            .where(where)
            .orderBy(desc(venues.createdAt))
            .limit(limit)
            .offset(offset),
        db.select({ count: count() }).from(venues).where(where),
    ]);

    const mapped = rows.map(mapVenueRow);

    return c.json(apiResponse(mapped, paginationMeta(page, limit, Number(totalResult?.count || 0))));
});

superAdminRoutes.post('/venues', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = createVenueSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const owner = await resolveVenueOwner(parsed.data.ownerId, parsed.data.ownerEmail);
    if (!owner) {
        return c.json(apiError('NOT_FOUND', 'Owner user not found'), 404);
    }

    if (owner.role === 'USER' || owner.role === 'VENUE_OWNER') {
        await db.update(users).set({
            role: 'BUSINESS',
            updatedAt: new Date(),
        }).where(eq(users.id, owner.id));
    }

    let created: { id: string; slug: string; name: string };
    try {
        const moderationState = normalizeVenueModerationState(parsed.data, parsed.data.approvalStatus, parsed.data.isActive);
        [created] = await db.insert(venues).values({
            ownerId: owner.id,
            name: parsed.data.name.trim(),
            slug: parsed.data.slug?.trim() || generateUniqueSlug(parsed.data.name),
            description: parsed.data.description?.trim() || null,
            descriptionSource: parsed.data.description?.trim() ? 'MANUAL' : 'NONE',
            shortDescription: parsed.data.shortDescription?.trim() || null,
            shortDescriptionSource: parsed.data.shortDescription?.trim() ? 'MANUAL' : 'NONE',
            addressLine1: parsed.data.addressLine1.trim(),
            addressLine2: parsed.data.addressLine2?.trim() || null,
            city: parsed.data.city.trim(),
            stateProvince: parsed.data.stateProvince?.trim() || null,
            country: parsed.data.country.trim(),
            postalCode: parsed.data.postalCode?.trim() || null,
            lat: String(parsed.data.lat),
            lng: String(parsed.data.lng),
            timezone: parsed.data.timezone.trim(),
            phone: parsed.data.phone?.trim() || null,
            website: parsed.data.website?.trim() || null,
            instagramHandle: parsed.data.instagramHandle?.trim() || null,
            googleMapsUrl: parsed.data.googleMapsUrl?.trim() || null,
            googlePlaceId: parsed.data.googlePlaceId?.trim() || null,
            coverImageUrl: parsed.data.coverImageUrl || null,
            coverImageS3Key: parsed.data.coverImageS3Key?.trim() || null,
            galleryS3Keys: sanitizeGalleryKeys(parsed.data.galleryS3Keys),
            amenities: parsed.data.amenities,
            vibes: parsed.data.vibes,
            cuisineTags: parsed.data.cuisineTags,
            priceRange: parsed.data.priceRange,
            priceRangeSource: parsed.data.priceRange ? 'MANUAL' : 'NONE',
            capacity: parsed.data.capacity || null,
            isVerified: parsed.data.isVerified,
            isActive: moderationState.isActive,
            isFeatured: parsed.data.isFeatured,
            approvalStatus: moderationState.approvalStatus,
            approvalNotes: parsed.data.approvalNotes?.trim() || null,
            approvedAt: moderationState.approvalStatus === 'APPROVED' ? new Date() : null,
            ratingOverride: null,
            reviewCountOverride: null,
            metadata: {
                galleryImageUrls: sanitizeGalleryUrls(parsed.data.galleryImageUrls),
            },
        }).returning({
            id: venues.id,
            slug: venues.slug,
            name: venues.name,
        });
    } catch (error) {
        const formatted = formatVenueMutationError(error);
        return c.json(formatted.body, formatted.status);
    }

    return c.json(apiResponse(created), 201);
});

superAdminRoutes.patch('/venues/:venueId', async (c) => {
    const venueId = c.req.param('venueId');
    const body = await c.req.json().catch(() => ({}));
    const parsed = updateVenueSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const [existingVenue] = await db.select({
        id: venues.id,
        slug: venues.slug,
        metadata: venues.metadata,
        coverImageS3Key: venues.coverImageS3Key,
        galleryS3Keys: venues.galleryS3Keys,
        approvalStatus: venues.approvalStatus,
        isActive: venues.isActive,
    }).from(venues).where(eq(venues.id, venueId)).limit(1);
    if (!existingVenue) return c.json(apiError('NOT_FOUND', 'Venue not found'), 404);

    if (parsed.data.ownerId) {
        const owner = await resolveVenueOwner(parsed.data.ownerId, undefined);
        if (!owner) return c.json(apiError('NOT_FOUND', 'Owner user not found'), 404);
        if (owner.role === 'USER' || owner.role === 'VENUE_OWNER') {
            await db.update(users).set({
                role: 'BUSINESS',
                updatedAt: new Date(),
            }).where(eq(users.id, owner.id));
        }
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const [key, value] of Object.entries(parsed.data)) {
        if (value === undefined) continue;
        if (key === 'galleryImageUrls') continue;
        if (key === 'lat' || key === 'lng') {
            updates[key] = String(value);
        } else {
            updates[key] = value;
        }
    }
    if (parsed.data.ownerId !== undefined) {
        updates.ownerId = parsed.data.ownerId;
    }
    if (parsed.data.slug !== undefined) {
        updates.slug = parsed.data.slug.trim();
    }
    if (parsed.data.amenities !== undefined) updates.amenities = parsed.data.amenities;
    if (parsed.data.vibes !== undefined) updates.vibes = parsed.data.vibes;
    if (parsed.data.cuisineTags !== undefined) updates.cuisineTags = parsed.data.cuisineTags;
    if (parsed.data.description !== undefined) {
        updates.description = parsed.data.description?.trim() || null;
        updates.descriptionSource = parsed.data.description?.trim() ? 'MANUAL' : 'NONE';
    }
    if (parsed.data.shortDescription !== undefined) {
        updates.shortDescription = parsed.data.shortDescription?.trim() || null;
        updates.shortDescriptionSource = parsed.data.shortDescription?.trim() ? 'MANUAL' : 'NONE';
    }
    if (parsed.data.priceRange !== undefined) {
        updates.priceRange = parsed.data.priceRange;
        updates.priceRangeSource = parsed.data.priceRange ? 'MANUAL' : 'NONE';
    }
    if (parsed.data.galleryS3Keys !== undefined) {
        updates.galleryS3Keys = sanitizeGalleryKeys(parsed.data.galleryS3Keys);
    }
    if (parsed.data.galleryImageUrls !== undefined) {
        const currentMetadata = metadataRecord(existingVenue.metadata);
        updates.metadata = {
            ...currentMetadata,
            galleryImageUrls: sanitizeGalleryUrls(parsed.data.galleryImageUrls),
        };
    }
    if (parsed.data.ratingOverride !== undefined) {
        updates.ratingOverride = parsed.data.ratingOverride;
    }
    if (parsed.data.reviewCountOverride !== undefined) {
        updates.reviewCountOverride = parsed.data.reviewCountOverride;
    }
    if (parsed.data.googlePlaceId !== undefined) {
        updates.googlePlaceId = parsed.data.googlePlaceId?.trim() || null;
    }
    if (parsed.data.approvalStatus !== undefined) {
        updates.approvalStatus = parsed.data.approvalStatus;
        updates.approvedAt = parsed.data.approvalStatus === 'APPROVED' ? new Date() : null;
    }
    if (parsed.data.approvalNotes !== undefined) {
        updates.approvalNotes = parsed.data.approvalNotes;
    }
    if (parsed.data.approvalStatus !== undefined || parsed.data.isActive !== undefined) {
        const moderationState = normalizeVenueModerationState(
            parsed.data,
            existingVenue.approvalStatus,
            existingVenue.isActive,
        );
        updates.approvalStatus = moderationState.approvalStatus;
        updates.isActive = moderationState.isActive;
        if (parsed.data.approvalStatus !== undefined) {
            updates.approvedAt = moderationState.approvalStatus === 'APPROVED' ? new Date() : null;
        }
    }

    try {
        await db.update(venues).set(updates).where(eq(venues.id, venueId));
    } catch (error) {
        const formatted = formatVenueMutationError(error);
        return c.json(formatted.body, formatted.status);
    }
    await cleanupRemovedVenueMedia({
        previousCoverKey: existingVenue.coverImageS3Key,
        previousGalleryKeys: existingVenue.galleryS3Keys,
        nextCoverKey: parsed.data.coverImageS3Key !== undefined ? parsed.data.coverImageS3Key : existingVenue.coverImageS3Key,
        nextGalleryKeys: parsed.data.galleryS3Keys !== undefined ? sanitizeGalleryKeys(parsed.data.galleryS3Keys) : existingVenue.galleryS3Keys,
    });
    return c.json(apiResponse({ message: 'Venue updated' }));
});

superAdminRoutes.delete('/venues/:venueId', async (c) => {
    const venueId = c.req.param('venueId');
    const [existingVenue] = await db.select({ id: venues.id }).from(venues).where(eq(venues.id, venueId)).limit(1);
    if (!existingVenue) return c.json(apiError('NOT_FOUND', 'Venue not found'), 404);

    await db.transaction(async (tx) => {
        await tx.update(venueEvents).set({
            isActive: false,
            updatedAt: new Date(),
        }).where(eq(venueEvents.venueId, venueId));

        await tx.update(venueCustomEvents).set({
            isActive: false,
            updatedAt: new Date(),
        }).where(eq(venueCustomEvents.venueId, venueId));

        await tx.update(menuCategories).set({
            isActive: false,
        }).where(eq(menuCategories.venueId, venueId));

        await tx.update(venues).set({
            isActive: false,
            deletedAt: new Date(),
            updatedAt: new Date(),
        }).where(eq(venues.id, venueId));
    });

    return c.json(apiResponse({ message: 'Venue archived' }));
});

// Match events
superAdminRoutes.get('/events', async (c) => {
    const parsed = paginationQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid query', parsed.error.issues), 400);
    }
    const { page, limit, search } = parsed.data;
    const offset = paginationOffset(page, limit);

    const where = search
        ? or(
            ilike(venues.name, `%${search}%`),
            ilike(matches.homeTeamName, `%${search}%`),
            ilike(matches.awayTeamName, `%${search}%`),
        )
        : undefined;

    const [rows, [totalResult]] = await Promise.all([
        db.select({
            id: venueEvents.id,
            venueId: venueEvents.venueId,
            matchId: venueEvents.matchId,
            isActive: venueEvents.isActive,
            bookingLimit: venueEvents.bookingLimit,
            confirmedBookingsCount: venueEvents.confirmedBookingsCount,
            specialNotes: venueEvents.specialNotes,
            customPrice: venueEvents.customPrice,
            currency: venueEvents.currency,
            doorsOpenAt: venueEvents.doorsOpenAt,
            requiresApproval: venueEvents.requiresApproval,
            createdAt: venueEvents.createdAt,
            venueName: venues.name,
            homeTeamName: matches.homeTeamName,
            awayTeamName: matches.awayTeamName,
            matchDateUtc: matches.matchDateUtc,
        })
            .from(venueEvents)
            .innerJoin(venues, eq(venueEvents.venueId, venues.id))
            .innerJoin(matches, eq(venueEvents.matchId, matches.id))
            .where(where)
            .orderBy(desc(venueEvents.createdAt))
            .limit(limit)
            .offset(offset),
        db.select({ count: count() })
            .from(venueEvents)
            .innerJoin(venues, eq(venueEvents.venueId, venues.id))
            .innerJoin(matches, eq(venueEvents.matchId, matches.id))
            .where(where),
    ]);

    return c.json(apiResponse(rows, paginationMeta(page, limit, Number(totalResult?.count || 0))));
});

superAdminRoutes.post('/events', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = createMatchEventSchema.safeParse(body);
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);

    const [existingVenue] = await db.select({ id: venues.id }).from(venues).where(eq(venues.id, parsed.data.venueId)).limit(1);
    if (!existingVenue) return c.json(apiError('NOT_FOUND', 'Venue not found'), 404);

    const [existingMatch] = await db.select({ id: matches.id }).from(matches).where(eq(matches.id, parsed.data.matchId)).limit(1);
    if (!existingMatch) return c.json(apiError('NOT_FOUND', 'Match not found'), 404);

    const [duplicate] = await db.select({ id: venueEvents.id }).from(venueEvents).where(and(
        eq(venueEvents.venueId, parsed.data.venueId),
        eq(venueEvents.matchId, parsed.data.matchId),
    )).limit(1);

    if (duplicate) {
        return c.json(apiError('CONFLICT', 'Event already exists for this venue and match'), 409);
    }

    const [created] = await db.insert(venueEvents).values({
        venueId: parsed.data.venueId,
        matchId: parsed.data.matchId,
        bookingLimit: parsed.data.bookingLimit || null,
        specialNotes: parsed.data.specialNotes || null,
        customPrice: parsed.data.customPrice != null ? String(parsed.data.customPrice) : null,
        currency: parsed.data.currency,
        doorsOpenAt: parsed.data.doorsOpenAt ? new Date(parsed.data.doorsOpenAt) : null,
        requiresApproval: parsed.data.requiresApproval,
    }).returning({
        id: venueEvents.id,
        venueId: venueEvents.venueId,
        matchId: venueEvents.matchId,
    });

    return c.json(apiResponse(created), 201);
});

superAdminRoutes.patch('/events/:eventId', async (c) => {
    const eventId = c.req.param('eventId');
    const body = await c.req.json().catch(() => ({}));
    const parsed = updateMatchEventSchema.safeParse(body);
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);

    const [existingEvent] = await db.select({ id: venueEvents.id }).from(venueEvents).where(eq(venueEvents.id, eventId)).limit(1);
    if (!existingEvent) return c.json(apiError('NOT_FOUND', 'Event not found'), 404);

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;
    if (parsed.data.bookingLimit !== undefined) updates.bookingLimit = parsed.data.bookingLimit;
    if (parsed.data.specialNotes !== undefined) updates.specialNotes = parsed.data.specialNotes;
    if (parsed.data.customPrice !== undefined) updates.customPrice = parsed.data.customPrice != null ? String(parsed.data.customPrice) : null;
    if (parsed.data.currency !== undefined) updates.currency = parsed.data.currency;
    if (parsed.data.doorsOpenAt !== undefined) updates.doorsOpenAt = parsed.data.doorsOpenAt ? new Date(parsed.data.doorsOpenAt) : null;
    if (parsed.data.requiresApproval !== undefined) updates.requiresApproval = parsed.data.requiresApproval;

    await db.update(venueEvents).set(updates).where(eq(venueEvents.id, eventId));
    return c.json(apiResponse({ message: 'Event updated' }));
});

superAdminRoutes.delete('/events/:eventId', async (c) => {
    const eventId = c.req.param('eventId');
    const [existingEvent] = await db.select({ id: venueEvents.id }).from(venueEvents).where(eq(venueEvents.id, eventId)).limit(1);
    if (!existingEvent) return c.json(apiError('NOT_FOUND', 'Event not found'), 404);

    await db.update(venueEvents).set({
        isActive: false,
        updatedAt: new Date(),
    }).where(eq(venueEvents.id, eventId));

    return c.json(apiResponse({ message: 'Event archived' }));
});

// Custom events
superAdminRoutes.get('/custom-events', async (c) => {
    const parsed = paginationQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid query', parsed.error.issues), 400);
    }
    const { page, limit, search } = parsed.data;
    const offset = paginationOffset(page, limit);
    const where = search
        ? or(
            ilike(venueCustomEvents.title, `%${search}%`),
            ilike(venues.name, `%${search}%`),
        )
        : undefined;

    const [rows, [totalResult]] = await Promise.all([
        db.select({
            id: venueCustomEvents.id,
            venueId: venueCustomEvents.venueId,
            title: venueCustomEvents.title,
            description: venueCustomEvents.description,
            eventTypeTags: venueCustomEvents.eventTypeTags,
            startsAt: venueCustomEvents.startsAt,
            endsAt: venueCustomEvents.endsAt,
            imageUrl: venueCustomEvents.imageUrl,
            imageS3Key: venueCustomEvents.imageS3Key,
            bookingNotes: venueCustomEvents.bookingNotes,
            isActive: venueCustomEvents.isActive,
            venueName: venues.name,
            createdAt: venueCustomEvents.createdAt,
        })
            .from(venueCustomEvents)
            .innerJoin(venues, eq(venueCustomEvents.venueId, venues.id))
            .where(where)
            .orderBy(desc(venueCustomEvents.createdAt))
            .limit(limit)
            .offset(offset),
        db.select({ count: count() })
            .from(venueCustomEvents)
            .innerJoin(venues, eq(venueCustomEvents.venueId, venues.id))
            .where(where),
    ]);

    return c.json(apiResponse(rows, paginationMeta(page, limit, Number(totalResult?.count || 0))));
});

superAdminRoutes.post('/custom-events', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = createCustomEventSchema.safeParse(body);
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);

    if (new Date(parsed.data.endsAt).getTime() <= new Date(parsed.data.startsAt).getTime()) {
        return c.json(apiError('VALIDATION_ERROR', 'endsAt must be after startsAt'), 400);
    }

    const [existingVenue] = await db.select({ id: venues.id }).from(venues).where(eq(venues.id, parsed.data.venueId)).limit(1);
    if (!existingVenue) return c.json(apiError('NOT_FOUND', 'Venue not found'), 404);

    const [created] = await db.insert(venueCustomEvents).values({
        venueId: parsed.data.venueId,
        title: parsed.data.title.trim(),
        description: parsed.data.description || null,
        eventTypeTags: parsed.data.eventTypeTags,
        startsAt: new Date(parsed.data.startsAt),
        endsAt: new Date(parsed.data.endsAt),
        imageUrl: parsed.data.imageUrl || null,
        imageS3Key: parsed.data.imageS3Key || null,
        bookingNotes: parsed.data.bookingNotes || null,
        isActive: true,
    }).returning({
        id: venueCustomEvents.id,
        title: venueCustomEvents.title,
    });

    return c.json(apiResponse(created), 201);
});

superAdminRoutes.patch('/custom-events/:eventId', async (c) => {
    const eventId = c.req.param('eventId');
    const body = await c.req.json().catch(() => ({}));
    const parsed = updateCustomEventSchema.safeParse(body);
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);

    const [existingEvent] = await db.select({ id: venueCustomEvents.id }).from(venueCustomEvents).where(eq(venueCustomEvents.id, eventId)).limit(1);
    if (!existingEvent) return c.json(apiError('NOT_FOUND', 'Custom event not found'), 404);

    if (parsed.data.startsAt && parsed.data.endsAt) {
        if (new Date(parsed.data.endsAt).getTime() <= new Date(parsed.data.startsAt).getTime()) {
            return c.json(apiError('VALIDATION_ERROR', 'endsAt must be after startsAt'), 400);
        }
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.title !== undefined) updates.title = parsed.data.title;
    if (parsed.data.description !== undefined) updates.description = parsed.data.description;
    if (parsed.data.eventTypeTags !== undefined) updates.eventTypeTags = parsed.data.eventTypeTags;
    if (parsed.data.startsAt !== undefined) updates.startsAt = new Date(parsed.data.startsAt);
    if (parsed.data.endsAt !== undefined) updates.endsAt = new Date(parsed.data.endsAt);
    if (parsed.data.imageUrl !== undefined) updates.imageUrl = parsed.data.imageUrl;
    if (parsed.data.imageS3Key !== undefined) updates.imageS3Key = parsed.data.imageS3Key;
    if (parsed.data.bookingNotes !== undefined) updates.bookingNotes = parsed.data.bookingNotes;
    if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

    await db.update(venueCustomEvents).set(updates).where(eq(venueCustomEvents.id, eventId));
    return c.json(apiResponse({ message: 'Custom event updated' }));
});

superAdminRoutes.delete('/custom-events/:eventId', async (c) => {
    const eventId = c.req.param('eventId');
    const [existingEvent] = await db.select({ id: venueCustomEvents.id }).from(venueCustomEvents).where(eq(venueCustomEvents.id, eventId)).limit(1);
    if (!existingEvent) return c.json(apiError('NOT_FOUND', 'Custom event not found'), 404);

    await db.update(venueCustomEvents).set({
        isActive: false,
        updatedAt: new Date(),
    }).where(eq(venueCustomEvents.id, eventId));

    return c.json(apiResponse({ message: 'Custom event archived' }));
});

// Matches
superAdminRoutes.get('/matches', async (c) => {
    const parsed = paginationQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid query', parsed.error.issues), 400);
    }
    const { page, limit, search } = parsed.data;
    const offset = paginationOffset(page, limit);

    const where = search
        ? or(
            ilike(matches.homeTeamName, `%${search}%`),
            ilike(matches.awayTeamName, `%${search}%`),
            ilike(matches.eventTitle, `%${search}%`),
            ilike(leagues.name, `%${search}%`),
        )
        : undefined;

    const [rows, [totalResult]] = await Promise.all([
        db.select({
            id: matches.id,
            leagueId: matches.leagueId,
            leagueName: leagues.name,
            isFeatured: matches.isFeatured,
            eventFormat: matches.eventFormat,
            eventTitle: matches.eventTitle,
            eventSubtitle: matches.eventSubtitle,
            homeTeamId: matches.homeTeamId,
            awayTeamId: matches.awayTeamId,
            stadiumId: matches.stadiumId,
            homeTeamName: matches.homeTeamName,
            awayTeamName: matches.awayTeamName,
            homeTeamCrestUrl: matches.homeTeamCrestUrl,
            awayTeamCrestUrl: matches.awayTeamCrestUrl,
            matchDateUtc: matches.matchDateUtc,
            status: matches.status,
            stage: matches.stage,
            venueName: matches.venueName,
            createdAt: matches.createdAt,
        })
            .from(matches)
            .leftJoin(leagues, eq(matches.leagueId, leagues.id))
            .where(where)
            .orderBy(desc(matches.matchDateUtc))
            .limit(limit)
            .offset(offset),
        db.select({ count: count() })
            .from(matches)
            .leftJoin(leagues, eq(matches.leagueId, leagues.id))
            .where(where),
    ]);

    return c.json(apiResponse(rows, paginationMeta(page, limit, Number(totalResult?.count || 0))));
});

superAdminRoutes.post('/matches', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = createMatchSchema.safeParse(body);
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);

    const normalized = await buildMatchValues(parsed.data);
    if ('error' in normalized) {
        return c.json(normalized.error, normalized.status);
    }

    if (!normalized.values.matchDateUtc) {
        return c.json(apiError('VALIDATION_ERROR', 'Match requires kickoff time'), 400);
    }
    if (normalized.values.eventFormat === 'HEAD_TO_HEAD' && (!normalized.values.homeTeamName || !normalized.values.awayTeamName)) {
        return c.json(apiError('VALIDATION_ERROR', 'Match requires teams and kickoff time'), 400);
    }
    if (normalized.values.eventFormat === 'SINGLE_EVENT' && !normalized.values.eventTitle) {
        return c.json(apiError('VALIDATION_ERROR', 'Single event requires an event title'), 400);
    }

    const [created] = await db.insert(matches).values({
        isFeatured: normalized.values.isFeatured ?? false,
        eventFormat: normalized.values.eventFormat || 'HEAD_TO_HEAD',
        eventTitle: normalized.values.eventTitle ?? null,
        eventSubtitle: normalized.values.eventSubtitle ?? null,
        leagueId: normalized.values.leagueId ?? null,
        homeTeamId: normalized.values.homeTeamId ?? null,
        awayTeamId: normalized.values.awayTeamId ?? null,
        stadiumId: normalized.values.stadiumId ?? null,
        homeTeamName: normalized.values.homeTeamName,
        awayTeamName: normalized.values.awayTeamName,
        homeTeamCrestUrl: normalized.values.homeTeamCrestUrl || null,
        awayTeamCrestUrl: normalized.values.awayTeamCrestUrl || null,
        matchDateUtc: normalized.values.matchDateUtc,
        status: normalized.values.status || 'SCHEDULED',
        matchDay: normalized.values.matchDay ?? null,
        stage: normalized.values.stage ?? null,
        venueName: normalized.values.venueName ?? null,
        externalMatchId: normalized.values.externalMatchId ?? null,
    }).returning({
        id: matches.id,
        eventTitle: matches.eventTitle,
        homeTeamName: matches.homeTeamName,
        awayTeamName: matches.awayTeamName,
    });

    return c.json(apiResponse(created), 201);
});

superAdminRoutes.post('/matches/import', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = matchImportSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const rows = parseCsvRows(parsed.data.csv);
    if (rows.length === 0) {
        return c.json(apiError('VALIDATION_ERROR', 'CSV must include a header and at least one data row'), 400);
    }

    const errors: Array<{ row: number; message: string }> = [];
    let imported = 0;
    let updated = 0;

    for (let idx = 0; idx < rows.length; idx += 1) {
        const source = rows[idx];
        const rowNumber = idx + 2; // header = line 1
        const parsedRow = matchImportRowSchema.safeParse({
            homeTeamName: source.homeTeamName,
            awayTeamName: source.awayTeamName,
            matchDateUtc: source.matchDateUtc,
            status: source.status,
            leagueId: source.leagueId || undefined,
            leagueName: source.leagueName || undefined,
            stage: source.stage || undefined,
            venueName: source.venueName || undefined,
            externalMatchId: source.externalMatchId || undefined,
        });

        if (!parsedRow.success) {
            errors.push({
                row: rowNumber,
                message: parsedRow.error.issues.map((issue) => issue.message).join('; '),
            });
            continue;
        }

        let leagueId: string | null = parsedRow.data.leagueId ?? null;
        if (!leagueId && parsedRow.data.leagueName) {
            const [matchedLeague] = await db.select({ id: leagues.id }).from(leagues)
                .where(and(eq(leagues.name, parsedRow.data.leagueName), eq(leagues.isActive, true)))
                .limit(1);
            leagueId = matchedLeague?.id ?? null;
        }

        if (!leagueId) {
            errors.push({
                row: rowNumber,
                message: 'leagueId or valid leagueName is required',
            });
            continue;
        }

        if (parsed.data.dryRun) {
            imported += 1;
            continue;
        }

        try {
            const values = {
                leagueId,
                homeTeamName: parsedRow.data.homeTeamName.trim(),
                awayTeamName: parsedRow.data.awayTeamName.trim(),
                matchDateUtc: new Date(parsedRow.data.matchDateUtc),
                status: parsedRow.data.status || 'SCHEDULED',
                stage: parsedRow.data.stage || null,
                venueName: parsedRow.data.venueName || null,
                externalMatchId: parsedRow.data.externalMatchId || null,
            };

            if (values.externalMatchId) {
                await db.insert(matches).values(values).onConflictDoUpdate({
                    target: matches.externalMatchId,
                    set: {
                        leagueId: values.leagueId,
                        homeTeamName: values.homeTeamName,
                        awayTeamName: values.awayTeamName,
                        matchDateUtc: values.matchDateUtc,
                        status: values.status,
                        stage: values.stage,
                        venueName: values.venueName,
                        updatedAt: new Date(),
                    },
                });
                updated += 1;
            } else {
                await db.insert(matches).values(values);
                imported += 1;
            }
        } catch (err) {
            errors.push({
                row: rowNumber,
                message: err instanceof Error ? err.message : 'Failed importing row',
            });
        }
    }

    return c.json(apiResponse({
        dryRun: parsed.data.dryRun,
        rowsRead: rows.length,
        imported,
        updated,
        failed: errors.length,
        errors,
    }));
});

superAdminRoutes.patch('/matches/:matchId', async (c) => {
    const matchId = c.req.param('matchId');
    const body = await c.req.json().catch(() => ({}));
    const parsed = updateMatchSchema.safeParse(body);
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);

    const [existingMatch] = await db.select({ id: matches.id }).from(matches).where(eq(matches.id, matchId)).limit(1);
    if (!existingMatch) return c.json(apiError('NOT_FOUND', 'Match not found'), 404);

    const normalized = await buildMatchValues(parsed.data);
    if ('error' in normalized) {
        return c.json(normalized.error, normalized.status);
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const [key, value] of Object.entries(normalized.values)) {
        if (value === undefined) continue;
        updates[key] = value;
    }

    await db.update(matches).set(updates).where(eq(matches.id, matchId));
    return c.json(apiResponse({ message: 'Match updated' }));
});

superAdminRoutes.delete('/matches/:matchId', async (c) => {
    const matchId = c.req.param('matchId');
    const [existingMatch] = await db.select({ id: matches.id }).from(matches).where(eq(matches.id, matchId)).limit(1);
    if (!existingMatch) return c.json(apiError('NOT_FOUND', 'Match not found'), 404);

    const [linkedEvents] = await db.select({ count: count() }).from(venueEvents).where(eq(venueEvents.matchId, matchId));
    if (Number(linkedEvents?.count || 0) > 0) {
        await db.update(matches).set({
            status: 'CANCELLED',
            updatedAt: new Date(),
        }).where(eq(matches.id, matchId));
        return c.json(apiResponse({
            message: 'Match has linked venue events, so it was marked as CANCELLED instead of hard deleted.',
            mode: 'cancelled',
        }));
    }

    await db.delete(matches).where(eq(matches.id, matchId));
    return c.json(apiResponse({
        message: 'Match deleted',
        mode: 'deleted',
    }));
});

superAdminRoutes.get('/motorsport-entries', async (c) => {
    const parsed = motorsportEntryQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid query', parsed.error.issues), 400);
    }

    const { page, limit, search, matchId } = parsed.data;
    const offset = paginationOffset(page, limit);

    const conditions = [];
    if (matchId) conditions.push(eq(eventEntries.matchId, matchId));
    if (search?.trim()) {
        conditions.push(or(
            ilike(drivers.name, `%${search.trim()}%`),
            ilike(entrants.name, `%${search.trim()}%`),
            ilike(manufacturers.name, `%${search.trim()}%`),
            ilike(eventEntries.displayName, `%${search.trim()}%`),
            ilike(eventEntries.carNumber, `%${search.trim()}%`),
        ));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [totalResult]] = await Promise.all([
        listMotorsportEntries(where).then((data) => data.slice(offset, offset + limit)),
        db.select({ count: count() })
            .from(eventEntries)
            .innerJoin(matches, eq(eventEntries.matchId, matches.id))
            .leftJoin(drivers, eq(eventEntries.driverId, drivers.id))
            .leftJoin(entrants, eq(eventEntries.entrantId, entrants.id))
            .leftJoin(manufacturers, eq(eventEntries.manufacturerId, manufacturers.id))
            .where(where),
    ]);

    return c.json(apiResponse(rows.map((row) => ({
        id: row.id,
        matchId: row.matchId,
        matchLabel: row.matchEventTitle || [row.matchHomeTeamName, row.matchAwayTeamName].filter(Boolean).join(' vs '),
        matchSubtitle: row.matchEventSubtitle,
        externalId: row.externalId,
        carNumber: row.carNumber,
        displayName: row.displayName,
        gridPosition: row.gridPosition,
        startPosition: row.startPosition,
        finishPosition: row.finishPosition,
        status: row.status,
        points: row.points,
        metadata: row.metadata,
        driverId: row.driverId,
        driverName: row.driverName,
        driverShortName: row.driverShortName,
        driverNationality: row.driverNationality,
        driverCountryCode: row.driverCountryCode,
        driverHeadshotUrl: row.driverHeadshotUrl,
        entrantId: row.entrantId,
        entrantName: row.entrantName,
        entrantShortName: row.entrantShortName,
        entrantBrandColor: row.entrantBrandColor,
        entrantLogoUrl: row.entrantLogoUrl,
        manufacturerId: row.manufacturerId,
        manufacturerName: row.manufacturerName,
        manufacturerShortName: row.manufacturerShortName,
        manufacturerLogoUrl: row.manufacturerLogoUrl,
    })), paginationMeta(page, limit, Number(totalResult?.count || 0))));
});

superAdminRoutes.post('/motorsport-entries', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = createMotorsportEntrySchema.safeParse(body);
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);

    const normalized = await buildMotorsportEntryValues(parsed.data);
    if ('error' in normalized) {
        return c.json(normalized.error, normalized.status);
    }

    const [created] = await db.insert(eventEntries).values({
        matchId: normalized.values.matchId,
        externalId: normalized.values.externalId ?? null,
        carNumber: normalized.values.carNumber ?? null,
        driverId: normalized.values.driverId ?? null,
        entrantId: normalized.values.entrantId ?? null,
        manufacturerId: normalized.values.manufacturerId ?? null,
        displayName: normalized.values.displayName ?? null,
        gridPosition: normalized.values.gridPosition ?? null,
        startPosition: normalized.values.startPosition ?? null,
        finishPosition: normalized.values.finishPosition ?? null,
        status: normalized.values.status ?? 'ENTERED',
        points: normalized.values.points ?? null,
        metadata: normalized.values.metadata ?? null,
    }).returning({ id: eventEntries.id });

    return c.json(apiResponse(created), 201);
});

superAdminRoutes.patch('/motorsport-entries/:entryId', async (c) => {
    const entryId = c.req.param('entryId');
    const body = await c.req.json().catch(() => ({}));
    const parsed = updateMotorsportEntrySchema.safeParse(body);
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);

    const [existing] = await db.select({
        id: eventEntries.id,
        matchId: eventEntries.matchId,
    }).from(eventEntries).where(eq(eventEntries.id, entryId)).limit(1);
    if (!existing) return c.json(apiError('NOT_FOUND', 'Motorsport entry not found'), 404);

    const normalized = await buildMotorsportEntryValues(parsed.data, existing.matchId);
    if ('error' in normalized) {
        return c.json(normalized.error, normalized.status);
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const [key, value] of Object.entries(normalized.values)) {
        if (value === undefined) continue;
        updates[key] = value;
    }

    await db.update(eventEntries).set(updates).where(eq(eventEntries.id, entryId));
    return c.json(apiResponse({ message: 'Motorsport entry updated' }));
});

superAdminRoutes.delete('/motorsport-entries/:entryId', async (c) => {
    const entryId = c.req.param('entryId');
    const [existing] = await db.select({ id: eventEntries.id }).from(eventEntries).where(eq(eventEntries.id, entryId)).limit(1);
    if (!existing) return c.json(apiError('NOT_FOUND', 'Motorsport entry not found'), 404);

    await db.delete(eventEntries).where(eq(eventEntries.id, entryId));
    return c.json(apiResponse({ message: 'Motorsport entry deleted' }));
});

superAdminRoutes.get('/blog/categories', async (c) => {
    const rows = await db.select({
        id: blogCategories.id,
        name: blogCategories.name,
        slug: blogCategories.slug,
        description: blogCategories.description,
        sortOrder: blogCategories.sortOrder,
        isActive: blogCategories.isActive,
        createdAt: blogCategories.createdAt,
        updatedAt: blogCategories.updatedAt,
    }).from(blogCategories).orderBy(blogCategories.sortOrder, blogCategories.name);

    return c.json(apiResponse(rows));
});

superAdminRoutes.post('/blog/categories', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = createBlogCategorySchema.safeParse(body);
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);

    const slug = slugifyValue(parsed.data.slug?.trim() || parsed.data.name);
    const [existing] = await db.select({ id: blogCategories.id }).from(blogCategories).where(eq(blogCategories.slug, slug)).limit(1);
    if (existing) return c.json(apiError('CONFLICT', 'Blog category slug already exists'), 409);

    const [created] = await db.insert(blogCategories).values({
        name: parsed.data.name.trim(),
        slug,
        description: parsed.data.description?.trim() || null,
        sortOrder: parsed.data.sortOrder,
        isActive: parsed.data.isActive,
    }).returning();

    return c.json(apiResponse(created), 201);
});

superAdminRoutes.patch('/blog/categories/:categoryId', async (c) => {
    const categoryId = c.req.param('categoryId');
    const body = await c.req.json().catch(() => ({}));
    const parsed = updateBlogCategorySchema.safeParse(body);
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);

    const [existing] = await db.select({ id: blogCategories.id }).from(blogCategories).where(eq(blogCategories.id, categoryId)).limit(1);
    if (!existing) return c.json(apiError('NOT_FOUND', 'Blog category not found'), 404);

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
    if (parsed.data.slug !== undefined) updates.slug = slugifyValue(parsed.data.slug);
    if (parsed.data.description !== undefined) updates.description = parsed.data.description?.trim() || null;
    if (parsed.data.sortOrder !== undefined) updates.sortOrder = parsed.data.sortOrder;
    if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

    await db.update(blogCategories).set(updates).where(eq(blogCategories.id, categoryId));
    return c.json(apiResponse({ message: 'Blog category updated' }));
});

superAdminRoutes.delete('/blog/categories/:categoryId', async (c) => {
    const categoryId = c.req.param('categoryId');
    const [existing] = await db.select({ id: blogCategories.id }).from(blogCategories).where(eq(blogCategories.id, categoryId)).limit(1);
    if (!existing) return c.json(apiError('NOT_FOUND', 'Blog category not found'), 404);

    await db.update(blogCategories).set({ isActive: false, updatedAt: new Date() }).where(eq(blogCategories.id, categoryId));
    return c.json(apiResponse({ message: 'Blog category archived' }));
});

superAdminRoutes.get('/blog/posts', async (c) => {
    const parsed = paginationQuerySchema.safeParse(c.req.query());
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid query', parsed.error.issues), 400);

    const { page, limit, search } = parsed.data;
    const offset = paginationOffset(page, limit);
    const where = search
        ? or(
            ilike(blogPosts.title, `%${search}%`),
            ilike(blogPosts.slug, `%${search}%`),
            ilike(blogPosts.excerpt, `%${search}%`),
        )
        : undefined;

    const [rows, [totalResult]] = await Promise.all([
        db.select({
            id: blogPosts.id,
            slug: blogPosts.slug,
            title: blogPosts.title,
            excerpt: blogPosts.excerpt,
            featuredImageUrl: blogPosts.featuredImageUrl,
            status: blogPosts.status,
            publishedAt: blogPosts.publishedAt,
            createdAt: blogPosts.createdAt,
            updatedAt: blogPosts.updatedAt,
            authorId: blogPosts.authorId,
            authorName: users.name,
        })
            .from(blogPosts)
            .leftJoin(users, eq(blogPosts.authorId, users.id))
            .where(where)
            .orderBy(desc(blogPosts.createdAt))
            .limit(limit)
            .offset(offset),
        db.select({ count: count() }).from(blogPosts).where(where),
    ]);

    const postIds = rows.map((row) => row.id);
    const categoriesByPost = new Map<string, Array<{ id: string; name: string; slug: string }>>();
    if (postIds.length > 0) {
        const categoryRows = await db.select({
            postId: blogPostCategories.postId,
            id: blogCategories.id,
            name: blogCategories.name,
            slug: blogCategories.slug,
        })
            .from(blogPostCategories)
            .innerJoin(blogCategories, eq(blogPostCategories.categoryId, blogCategories.id))
            .where(inArray(blogPostCategories.postId, postIds));
        for (const row of categoryRows) {
            if (!categoriesByPost.has(row.postId)) categoriesByPost.set(row.postId, []);
            categoriesByPost.get(row.postId)?.push({ id: row.id, name: row.name, slug: row.slug });
        }
    }

    return c.json(apiResponse(rows.map((row) => ({
        ...row,
        categories: categoriesByPost.get(row.id) || [],
    })), paginationMeta(page, limit, Number(totalResult?.count || 0))));
});

superAdminRoutes.get('/blog/posts/:postId', async (c) => {
    const postId = c.req.param('postId');
    const [row] = await db.select().from(blogPosts).where(eq(blogPosts.id, postId)).limit(1);
    if (!row) return c.json(apiError('NOT_FOUND', 'Blog post not found'), 404);

    const categoryRows = await db.select({
        id: blogCategories.id,
        name: blogCategories.name,
        slug: blogCategories.slug,
    })
        .from(blogPostCategories)
        .innerJoin(blogCategories, eq(blogPostCategories.categoryId, blogCategories.id))
        .where(eq(blogPostCategories.postId, postId));

    return c.json(apiResponse({
        ...row,
        categories: categoryRows,
        categoryIds: categoryRows.map((category) => category.id),
    }));
});

superAdminRoutes.post('/blog/posts', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = createBlogPostSchema.safeParse(body);
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);

    const categoryIds = Array.from(new Set(parsed.data.categoryIds));
    if (categoryIds.length > 0) {
        const found = await db.select({ id: blogCategories.id }).from(blogCategories).where(inArray(blogCategories.id, categoryIds));
        if (found.length !== categoryIds.length) return c.json(apiError('NOT_FOUND', 'One or more categories were not found'), 404);
    }

    const title = parsed.data.title.trim();
    const slug = slugifyValue(parsed.data.slug?.trim() || title);
    const [existing] = await db.select({ id: blogPosts.id }).from(blogPosts).where(eq(blogPosts.slug, slug)).limit(1);
    if (existing) return c.json(apiError('CONFLICT', 'Blog post slug already exists'), 409);

    const [author] = await db.select({ id: users.id }).from(users)
        .where(and(
            eq(users.isActive, true),
            inArray(users.role, ['SUPER_ADMIN', 'ADMIN']),
        ))
        .orderBy(users.createdAt)
        .limit(1);
    if (!author) return c.json(apiError('NOT_FOUND', 'No admin user found to own blog posts'), 404);

    const [created] = await db.insert(blogPosts).values({
        title,
        slug,
        excerpt: parsed.data.excerpt?.trim() || null,
        featuredImageUrl: parsed.data.featuredImageUrl?.trim() || null,
        featuredImageS3Key: parsed.data.featuredImageS3Key?.trim() || null,
        contentJson: parsed.data.contentJson ?? null,
        contentHtml: sanitizeBlogHtml(parsed.data.renderedHtml),
        status: parsed.data.status,
        publishedAt: parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : parsed.data.status === 'PUBLISHED' ? new Date() : null,
        authorId: author.id,
    }).returning({ id: blogPosts.id });

    await syncBlogPostCategoryIds(created.id, categoryIds);
    return c.json(apiResponse({ id: created.id }), 201);
});

superAdminRoutes.patch('/blog/posts/:postId', async (c) => {
    const postId = c.req.param('postId');
    const body = await c.req.json().catch(() => ({}));
    const parsed = updateBlogPostSchema.safeParse(body);
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);

    const [existing] = await db.select({ id: blogPosts.id }).from(blogPosts).where(eq(blogPosts.id, postId)).limit(1);
    if (!existing) return c.json(apiError('NOT_FOUND', 'Blog post not found'), 404);

    if (parsed.data.categoryIds) {
        const found = await db.select({ id: blogCategories.id }).from(blogCategories).where(inArray(blogCategories.id, parsed.data.categoryIds));
        if (found.length !== parsed.data.categoryIds.length) return c.json(apiError('NOT_FOUND', 'One or more categories were not found'), 404);
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.title !== undefined) updates.title = parsed.data.title.trim();
    if (parsed.data.slug !== undefined) updates.slug = slugifyValue(parsed.data.slug);
    if (parsed.data.excerpt !== undefined) updates.excerpt = parsed.data.excerpt?.trim() || null;
    if (parsed.data.featuredImageUrl !== undefined) updates.featuredImageUrl = parsed.data.featuredImageUrl?.trim() || null;
    if (parsed.data.featuredImageS3Key !== undefined) updates.featuredImageS3Key = parsed.data.featuredImageS3Key?.trim() || null;
    if (parsed.data.contentJson !== undefined) updates.contentJson = parsed.data.contentJson ?? null;
    if (parsed.data.renderedHtml !== undefined) updates.contentHtml = sanitizeBlogHtml(parsed.data.renderedHtml);
    if (parsed.data.status !== undefined) updates.status = parsed.data.status;
    if (parsed.data.publishedAt !== undefined) updates.publishedAt = parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : null;

    await db.update(blogPosts).set(updates).where(eq(blogPosts.id, postId));
    if (parsed.data.categoryIds) {
        await syncBlogPostCategoryIds(postId, Array.from(new Set(parsed.data.categoryIds)));
    }

    return c.json(apiResponse({ message: 'Blog post updated' }));
});

superAdminRoutes.delete('/blog/posts/:postId', async (c) => {
    const postId = c.req.param('postId');
    const [existing] = await db.select({ id: blogPosts.id }).from(blogPosts).where(eq(blogPosts.id, postId)).limit(1);
    if (!existing) return c.json(apiError('NOT_FOUND', 'Blog post not found'), 404);

    await db.delete(blogPostCategories).where(eq(blogPostCategories.postId, postId));
    await db.delete(blogComments).where(eq(blogComments.postId, postId));
    await db.delete(blogPosts).where(eq(blogPosts.id, postId));
    return c.json(apiResponse({ message: 'Blog post deleted' }));
});

superAdminRoutes.get('/blog/comments', async (c) => {
    const status = c.req.query('status');
    const rows = await db.select({
        id: blogComments.id,
        postId: blogComments.postId,
        postTitle: blogPosts.title,
        userId: blogComments.userId,
        userName: users.name,
        content: blogComments.content,
        status: blogComments.status,
        createdAt: blogComments.createdAt,
    })
        .from(blogComments)
        .innerJoin(blogPosts, eq(blogComments.postId, blogPosts.id))
        .innerJoin(users, eq(blogComments.userId, users.id))
        .where(status ? eq(blogComments.status, status as 'PENDING' | 'APPROVED' | 'REJECTED') : undefined)
        .orderBy(desc(blogComments.createdAt))
        .limit(200);

    return c.json(apiResponse(rows));
});

superAdminRoutes.patch('/blog/comments/:commentId', async (c) => {
    const commentId = c.req.param('commentId');
    const body = await c.req.json().catch(() => ({}));
    const parsed = updateBlogCommentSchema.safeParse(body);
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);

    const [existing] = await db.select({ id: blogComments.id }).from(blogComments).where(eq(blogComments.id, commentId)).limit(1);
    if (!existing) return c.json(apiError('NOT_FOUND', 'Blog comment not found'), 404);

    await db.update(blogComments).set({
        status: parsed.data.status,
        moderatedBy: null,
        moderatedAt: new Date(),
        updatedAt: new Date(),
    }).where(eq(blogComments.id, commentId));

    return c.json(apiResponse({ message: 'Blog comment updated' }));
});

superAdminRoutes.get('/approval/businesses', async (c) => {
    const parsed = paginationQuerySchema.safeParse(c.req.query());
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid query', parsed.error.issues), 400);

    const { page, limit, search } = parsed.data;
    const offset = paginationOffset(page, limit);
    const where = and(
        or(eq(users.role, 'BUSINESS'), eq(users.role, 'VENUE_OWNER')),
        ...(search ? [or(ilike(users.name, `%${search}%`), ilike(users.email, `%${search}%`))] : []),
    );

    const [rows, [totalResult]] = await Promise.all([
        db.select({
            id: users.id,
            email: users.email,
            name: users.name,
            role: users.role,
            businessApprovalStatus: users.businessApprovalStatus,
            businessApprovalNotes: users.businessApprovalNotes,
            businessApprovedAt: users.businessApprovedAt,
            createdAt: users.createdAt,
        }).from(users).where(where).orderBy(desc(users.createdAt)).limit(limit).offset(offset),
        db.select({ count: count() }).from(users).where(where),
    ]);

    return c.json(apiResponse(rows, paginationMeta(page, limit, Number(totalResult?.count ?? 0))));
});

superAdminRoutes.patch('/users/:userId/business-approval', async (c) => {
    const userId = c.req.param('userId');
    const body = await c.req.json().catch(() => ({}));
    const parsed = reviewBusinessApprovalSchema.safeParse(body);
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);

    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
    if (!existing) return c.json(apiError('NOT_FOUND', 'User not found'), 404);

    await db.update(users).set({
        businessApprovalStatus: parsed.data.status,
        businessApprovalNotes: parsed.data.notes ?? null,
        businessApprovedAt: parsed.data.status === 'APPROVED' ? new Date() : null,
        updatedAt: new Date(),
    }).where(eq(users.id, userId));

    return c.json(apiResponse({ message: 'Business approval updated' }));
});

superAdminRoutes.get('/approval/venues', async (c) => {
    const parsed = paginationQuerySchema.safeParse(c.req.query());
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid query', parsed.error.issues), 400);

    const { page, limit, search } = parsed.data;
    const offset = paginationOffset(page, limit);
    const where = search
        ? or(ilike(venues.name, `%${search}%`), ilike(venues.city, `%${search}%`))
        : undefined;

    const [rows, [totalResult]] = await Promise.all([
        db.select({
            id: venues.id,
            name: venues.name,
            slug: venues.slug,
            city: venues.city,
            country: venues.country,
            ownerId: venues.ownerId,
            ownerEmail: users.email,
            ownerName: users.name,
            approvalStatus: venues.approvalStatus,
            approvalNotes: venues.approvalNotes,
            isVerified: venues.isVerified,
            googlePlaceId: venues.googlePlaceId,
            createdAt: venues.createdAt,
        })
            .from(venues)
            .leftJoin(users, eq(venues.ownerId, users.id))
            .where(where)
            .orderBy(desc(venues.createdAt))
            .limit(limit)
            .offset(offset),
        db.select({ count: count() }).from(venues).where(where),
    ]);

    return c.json(apiResponse(rows, paginationMeta(page, limit, Number(totalResult?.count ?? 0))));
});

superAdminRoutes.patch('/venues/:venueId/approval', async (c) => {
    const venueId = c.req.param('venueId');
    const body = await c.req.json().catch(() => ({}));
    const parsed = reviewVenueApprovalSchema.safeParse(body);
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);

    const [existing] = await db.select({ id: venues.id, isActive: venues.isActive }).from(venues).where(eq(venues.id, venueId)).limit(1);
    if (!existing) return c.json(apiError('NOT_FOUND', 'Venue not found'), 404);

    const moderationState = normalizeVenueModerationState({
        approvalStatus: parsed.data.status,
        isActive: existing.isActive,
    }, parsed.data.status, existing.isActive);

    await db.update(venues).set({
        approvalStatus: moderationState.approvalStatus,
        approvalNotes: parsed.data.notes ?? null,
        approvedAt: moderationState.approvalStatus === 'APPROVED' ? new Date() : null,
        isVerified: parsed.data.isVerified ?? (parsed.data.status === 'APPROVED'),
        isActive: moderationState.isActive,
        updatedAt: new Date(),
    }).where(eq(venues.id, venueId));

    return c.json(apiResponse({ message: 'Venue approval updated' }));
});

superAdminRoutes.get('/venue-claims', async (c) => {
    const parsed = paginationQuerySchema.safeParse(c.req.query());
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid query', parsed.error.issues), 400);

    const { page, limit } = parsed.data;
    const offset = paginationOffset(page, limit);

    const [rows, [totalResult]] = await Promise.all([
        db.select({
            id: venueClaims.id,
            status: venueClaims.status,
            notes: venueClaims.notes,
            adminNotes: venueClaims.adminNotes,
            verificationDocuments: venueClaims.verificationDocuments,
            reviewedAt: venueClaims.reviewedAt,
            createdAt: venueClaims.createdAt,
            venueId: venues.id,
            venueName: venues.name,
            venueSlug: venues.slug,
            venueOwnerId: venues.ownerId,
            claimantUserId: venueClaims.claimantUserId,
            claimantName: users.name,
            claimantEmail: users.email,
        })
            .from(venueClaims)
            .innerJoin(venues, eq(venueClaims.venueId, venues.id))
            .innerJoin(users, eq(venueClaims.claimantUserId, users.id))
            .orderBy(desc(venueClaims.createdAt))
            .limit(limit)
            .offset(offset),
        db.select({ count: count() }).from(venueClaims),
    ]);

    const ownerIds = Array.from(new Set(rows.map((row) => row.venueOwnerId).filter((value): value is string => Boolean(value))));
    const ownerRows = ownerIds.length
        ? await db.select({
            id: users.id,
            name: users.name,
            email: users.email,
        }).from(users).where(inArray(users.id, ownerIds))
        : [];
    const ownerMap = new Map(ownerRows.map((row) => [row.id, row]));

    return c.json(apiResponse(rows.map((row) => {
        const owner = row.venueOwnerId ? ownerMap.get(row.venueOwnerId) : null;
        return {
            ...row,
            venueOwnerName: owner?.name ?? null,
            venueOwnerEmail: owner?.email ?? null,
        };
    }), paginationMeta(page, limit, Number(totalResult?.count ?? 0))));
});

superAdminRoutes.patch('/venue-claims/:claimId', async (c) => {
    const claimId = c.req.param('claimId');
    const body = await c.req.json().catch(() => ({}));
    const parsed = reviewVenueClaimSchema.safeParse(body);
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);

    const [claim] = await db.select({
        id: venueClaims.id,
        venueId: venueClaims.venueId,
        claimantUserId: venueClaims.claimantUserId,
    }).from(venueClaims).where(eq(venueClaims.id, claimId)).limit(1);
    if (!claim) return c.json(apiError('NOT_FOUND', 'Claim not found'), 404);

    await db.transaction(async (tx) => {
        await tx.update(venueClaims).set({
            status: parsed.data.status,
            adminNotes: parsed.data.adminNotes ?? null,
            reviewedAt: new Date(),
        }).where(eq(venueClaims.id, claimId));

        if (parsed.data.status === 'APPROVED') {
            await tx.update(venues).set({
                ownerId: claim.claimantUserId,
                updatedAt: new Date(),
            }).where(eq(venues.id, claim.venueId));
        }
    });

    return c.json(apiResponse({ message: 'Venue claim reviewed' }));
});

superAdminRoutes.post('/venues/:venueId/google/refresh', async (c) => {
    const venueId = c.req.param('venueId');
    const [venue] = await db.select({
        id: venues.id,
        slug: venues.slug,
        name: venues.name,
        description: venues.description,
        shortDescription: venues.shortDescription,
        googlePlaceId: venues.googlePlaceId,
        googleSourceSnapshot: venues.googleSourceSnapshot,
        googleLastSyncedAt: venues.googleLastSyncedAt,
        googleSyncStatus: venues.googleSyncStatus,
        googleSyncError: venues.googleSyncError,
        amenities: venues.amenities,
        menuSource: venues.menuSource,
        descriptionSource: venues.descriptionSource,
        shortDescriptionSource: venues.shortDescriptionSource,
        priceRange: venues.priceRange,
        priceRangeSource: venues.priceRangeSource,
        phone: venues.phone,
        website: venues.website,
        googleMapsUrl: venues.googleMapsUrl,
        ratingOverride: venues.ratingOverride,
        reviewCountOverride: venues.reviewCountOverride,
    }).from(venues).where(eq(venues.id, venueId)).limit(1);
    if (!venue) return c.json(apiError('NOT_FOUND', 'Venue not found'), 404);
    if (!venue.googlePlaceId) return c.json(apiError('VALIDATION_ERROR', 'Venue is not linked to a Google Place'), 400);

    const { snapshot, defaults } = await refreshVenueFromGoogle(venue);
    return c.json(apiResponse({ message: 'Google venue data refreshed', snapshot, defaults }));
});

superAdminRoutes.post('/venues/:venueId/google/revert', async (c) => {
    const venueId = c.req.param('venueId');
    const body = await c.req.json().catch(() => ({}));
    const parsed = revertVenueGoogleSchema.safeParse(body);
    if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);

    const [venue] = await db.select({
        id: venues.id,
        slug: venues.slug,
        name: venues.name,
        menuSource: venues.menuSource,
        googleSourceSnapshot: venues.googleSourceSnapshot,
    }).from(venues).where(eq(venues.id, venueId)).limit(1);
    if (!venue) return c.json(apiError('NOT_FOUND', 'Venue not found'), 404);
    if (!venue.googleSourceSnapshot || typeof venue.googleSourceSnapshot !== 'object' || Array.isArray(venue.googleSourceSnapshot)) {
        return c.json(apiError('NOT_FOUND', 'No Google defaults stored for this venue'), 404);
    }

    const snapshot = await enrichGoogleMenuSnapshot(venue.googleSourceSnapshot as Parameters<typeof applyGoogleMenuSnapshot>[2]);
    const googleFields = buildGoogleVenueFields(snapshot);
    const googleAmenities = await getAllowedGoogleAmenities(snapshot as GoogleSourceSnapshot);
    const googleDefaults = await buildGoogleSyncUpdates({
        ...venue,
        googleSourceSnapshot: snapshot,
        description: null,
        shortDescription: null,
        descriptionSource: 'NONE',
        shortDescriptionSource: 'NONE',
        priceRange: null,
        priceRangeSource: 'NONE',
        amenities: [],
        googlePlaceId: snapshot.placeId,
        googleLastSyncedAt: null,
        googleSyncStatus: 'NEVER_SYNCED',
        googleSyncError: null,
        phone: null,
        website: null,
        googleMapsUrl: null,
        ratingOverride: null,
        reviewCountOverride: null,
    }, snapshot);
    const revertedDescription = typeof googleDefaults.updates.description === 'string'
        ? googleDefaults.updates.description
        : null;
    const revertedShortDescription = typeof googleDefaults.updates.shortDescription === 'string'
        ? googleDefaults.updates.shortDescription
        : null;
    const revertedPriceRange = typeof googleDefaults.updates.priceRange === 'string'
        ? googleDefaults.updates.priceRange as 'BUDGET' | 'MID' | 'UPSCALE' | 'LUXURY'
        : null;

    await db.transaction(async (tx) => {
        await tx.update(venues).set({
            name: snapshot.displayName,
            addressLine1: googleFields.addressLine1,
            city: googleFields.city,
            stateProvince: googleFields.stateProvince,
            country: googleFields.country,
            postalCode: googleFields.postalCode,
            ...(googleFields.lat !== null ? { lat: googleFields.lat } : {}),
            ...(googleFields.lng !== null ? { lng: googleFields.lng } : {}),
            timezone: googleFields.timezone,
            phone: googleFields.phone,
            website: googleFields.website,
            googleMapsUrl: googleFields.googleMapsUrl,
            ratingOverride: googleFields.ratingOverride,
            reviewCountOverride: googleFields.reviewCountOverride,
            amenities: await sanitizeAmenities(googleAmenities),
            description: revertedDescription,
            shortDescription: revertedShortDescription,
            descriptionSource: revertedDescription ? 'GOOGLE' : 'NONE',
            shortDescriptionSource: revertedShortDescription ? 'GOOGLE' : 'NONE',
            priceRange: revertedPriceRange,
            priceRangeSource: revertedPriceRange ? 'GOOGLE' : 'NONE',
            menuSource: parsed.data.includeMenu ? (snapshot.menu?.categories?.length ? 'GOOGLE' : 'NONE') : venue.menuSource,
            googleSourceSnapshot: snapshot,
            updatedAt: new Date(),
        }).where(eq(venues.id, venueId));

        if (parsed.data.includeMenu) {
            await applyGoogleMenuSnapshot(tx, venueId, snapshot);
        }
    });

    return c.json(apiResponse({ message: 'Venue reverted to Google defaults', snapshot, defaults: googleDefaults.defaults }));
});

const createPlayerSchema = z.object({
    sportId: z.string().uuid().nullable().optional(),
    leagueId: z.string().uuid().nullable().optional(),
    name: z.string().min(2).max(150),
    shortName: z.string().max(60).nullable().optional(),
    nationality: z.string().max(80).nullable().optional(),
    countryCode: z.string().max(3).nullable().optional(),
    headshotUrl: z.string().url().nullable().optional(),
    heroImageUrl: z.string().url().nullable().optional(),
    website: z.string().url().nullable().optional(),
    shortDescription: z.string().max(280).nullable().optional(),
    description: z.string().max(4000).nullable().optional(),
    aliases: z.array(z.string().max(120)).max(10).optional(),
    externalId: z.string().max(80).nullable().optional(),
    isActive: z.boolean().default(true),
});

const updatePlayerSchema = z.object({
    sportId: z.string().uuid().nullable().optional(),
    leagueId: z.string().uuid().nullable().optional(),
    name: z.string().min(2).max(150).optional(),
    shortName: z.string().max(60).nullable().optional(),
    nationality: z.string().max(80).nullable().optional(),
    countryCode: z.string().max(3).nullable().optional(),
    headshotUrl: z.string().url().nullable().optional(),
    heroImageUrl: z.string().url().nullable().optional(),
    website: z.string().url().nullable().optional(),
    shortDescription: z.string().max(280).nullable().optional(),
    description: z.string().max(4000).nullable().optional(),
    aliases: z.array(z.string().max(120)).max(10).optional(),
    externalId: z.string().max(80).nullable().optional(),
    isActive: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });

type EntitySourceValue = 'NONE' | 'GOOGLE' | 'MANUAL' | null | undefined;

function normalizeOptionalText(value: unknown) {
    return typeof value === 'string' ? value.trim() || null : null;
}

function resolveUpdatedFieldSource(
    nextValue: unknown,
    currentValue: unknown,
    currentSource: EntitySourceValue,
): Exclude<EntitySourceValue, null | undefined> {
    const normalizedNext = normalizeOptionalText(nextValue);
    const normalizedCurrent = normalizeOptionalText(currentValue);

    if (normalizedNext === normalizedCurrent) {
        return currentSource || (normalizedNext ? 'GOOGLE' : 'NONE');
    }

    return normalizedNext ? 'MANUAL' : 'NONE';
}

function normalizeDuplicateTeamName(value: string) {
    return value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function normalizeDuplicateStadiumKey(name: string, city?: string | null, country?: string | null) {
    const normalizedName = normalizeDuplicateTeamName(name);
    const normalizedCity = normalizeDuplicateTeamName(city || '');
    const normalizedCountry = normalizeDuplicateTeamName(country || '');
    if (!normalizedName) return '';
    return `${normalizedName}::${normalizedCity || 'unknown-city'}::${normalizedCountry || 'unknown-country'}`;
}

function uniqueUuidList(values: Array<string | null | undefined>) {
    return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

async function assertActiveStadiumIds(stadiumIds: string[]) {
    if (stadiumIds.length === 0) return;
    const rows = await db.select({ id: stadiums.id }).from(stadiums).where(and(inArray(stadiums.id, stadiumIds), eq(stadiums.isActive, true)));
    if (rows.length !== stadiumIds.length) {
        throw new Error('One or more stadiums were not found');
    }
}

async function assertActivePlayerIds(playerIds: string[]) {
    if (playerIds.length === 0) return;
    const rows = await db.select({ id: players.id }).from(players).where(and(inArray(players.id, playerIds), eq(players.isActive, true)));
    if (rows.length !== playerIds.length) {
        throw new Error('One or more players were not found');
    }
}

function normalizeRosterMembers(input?: Array<{
    playerId: string;
    shirtNumber?: string | null;
    position?: string | null;
    isCaptain?: boolean;
    sortOrder?: number;
    isActive?: boolean;
}>) {
    return (input || [])
        .map((member, index) => ({
            playerId: member.playerId,
            shirtNumber: member.shirtNumber?.trim() || null,
            position: member.position?.trim() || null,
            isCaptain: Boolean(member.isCaptain),
            sortOrder: member.sortOrder ?? index,
            isActive: member.isActive ?? true,
        }))
        .filter((member, index, rows) => rows.findIndex((row) => row.playerId === member.playerId) === index);
}

async function syncTeamStadiumState(tx: any, teamId: string, primaryStadiumId: string | null, secondaryStadiumIds: string[]) {
    const linkRows = uniqueUuidList([primaryStadiumId, ...secondaryStadiumIds])
        .map((stadiumId, index) => ({
            teamId,
            stadiumId,
            isPrimary: primaryStadiumId === stadiumId,
            sortOrder: primaryStadiumId === stadiumId ? 0 : index + 1,
            isActive: true,
            updatedAt: new Date(),
        }));

    await tx.delete(teamStadiumLinks).where(eq(teamStadiumLinks.teamId, teamId));
    if (linkRows.length > 0) {
        await tx.insert(teamStadiumLinks).values(linkRows);
    }
}

async function syncTeamRosterState(tx: any, teamId: string, rosterMembers: ReturnType<typeof normalizeRosterMembers>) {
    await tx.delete(teamRosterMembers).where(eq(teamRosterMembers.teamId, teamId));
    if (rosterMembers.length > 0) {
        await tx.insert(teamRosterMembers).values(rosterMembers.map((member) => ({
            teamId,
            playerId: member.playerId,
            shirtNumber: member.shirtNumber,
            position: member.position,
            isCaptain: member.isCaptain,
            sortOrder: member.sortOrder,
            isActive: member.isActive,
            updatedAt: new Date(),
        })));
    }
}

const staticPageSchema = z.object({
    slug: z.string().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().min(2).max(200),
    excerpt: z.string().max(500).nullable().optional(),
    contentHtml: z.string().max(100_000).default(''),
    contentJson: z.unknown().optional(),
    status: z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT'),
    seoTitle: z.string().max(220).nullable().optional(),
    seoDescription: z.string().max(320).nullable().optional(),
});

const staticPageUpdateSchema = staticPageSchema.partial().refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });
const enrichmentKindSchema = z.enum(['league', 'team', 'player', 'driver', 'entrant', 'manufacturer', 'stadium']);
const enrichmentBatchSchema = z.object({
    includeLeague: z.boolean().optional(),
    includeTeams: z.boolean().optional(),
    includePlayers: z.boolean().optional(),
    includeEntrants: z.boolean().optional(),
    includeManufacturers: z.boolean().optional(),
});
const recommendationQuerySchema = z.object({
    entityType: z.enum(['team', 'player', 'driver', 'entrant', 'manufacturer']),
    leagueId: z.string().uuid().optional(),
    q: z.string().trim().optional(),
});
const recommendationPreviewSchema = recommendationQuerySchema.extend({
    recommendationId: z.string().min(1),
});
const createDriverSchema = z.object({
    name: z.string().min(2).max(150),
    shortName: z.string().max(60).nullable().optional(),
    nationality: z.string().max(80).nullable().optional(),
    countryCode: z.string().max(3).nullable().optional(),
    headshotUrl: z.string().url().nullable().optional(),
    heroImageUrl: z.string().url().nullable().optional(),
    website: z.string().url().nullable().optional(),
    shortDescription: z.string().max(280).nullable().optional(),
    description: z.string().max(4000).nullable().optional(),
    aliases: z.array(z.string().max(120)).max(10).optional(),
    externalId: z.string().max(80).nullable().optional(),
    isActive: z.boolean().default(true),
});
const updateDriverSchema = createDriverSchema.partial().refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });
const createEntrantSchema = z.object({
    leagueId: z.string().uuid().nullable().optional(),
    name: z.string().min(2).max(150),
    shortName: z.string().max(60).nullable().optional(),
    brandColor: z.string().max(20).nullable().optional(),
    logoUrl: z.string().url().nullable().optional(),
    heroImageUrl: z.string().url().nullable().optional(),
    website: z.string().url().nullable().optional(),
    shortDescription: z.string().max(280).nullable().optional(),
    description: z.string().max(4000).nullable().optional(),
    aliases: z.array(z.string().max(120)).max(10).optional(),
    externalId: z.string().max(80).nullable().optional(),
    isActive: z.boolean().default(true),
});
const updateEntrantSchema = createEntrantSchema.partial().refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });
const createManufacturerSchema = z.object({
    leagueId: z.string().uuid().nullable().optional(),
    name: z.string().min(2).max(150),
    shortName: z.string().max(60).nullable().optional(),
    logoUrl: z.string().url().nullable().optional(),
    heroImageUrl: z.string().url().nullable().optional(),
    website: z.string().url().nullable().optional(),
    shortDescription: z.string().max(280).nullable().optional(),
    description: z.string().max(4000).nullable().optional(),
    aliases: z.array(z.string().max(120)).max(10).optional(),
    externalId: z.string().max(80).nullable().optional(),
    isActive: z.boolean().default(true),
});
const updateManufacturerSchema = createManufacturerSchema.partial().refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });

superAdminRoutes.get('/players', async (c) => {
    const parsed = paginationQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid query', parsed.error.issues), 400);
    }

    const { page, limit, search } = parsed.data;
    const offset = paginationOffset(page, limit);
    const where = search
        ? or(
            ilike(players.name, `%${search}%`),
            ilike(players.shortName, `%${search}%`),
            ilike(players.slug, `%${search}%`),
            ilike(players.nationality, `%${search}%`),
        )
        : undefined;

    const [rows, [totalResult]] = await Promise.all([
        db.select({
            id: players.id,
            sportId: players.sportId,
            sportName: sports.name,
            leagueId: players.leagueId,
            leagueName: leagues.name,
            name: players.name,
            slug: players.slug,
            shortName: players.shortName,
            nationality: players.nationality,
            countryCode: players.countryCode,
            headshotUrl: players.headshotUrl,
            heroImageUrl: players.heroImageUrl,
            website: players.website,
            aliases: players.aliases,
            shortDescription: players.shortDescription,
            description: players.description,
            shortDescriptionSource: players.shortDescriptionSource,
            descriptionSource: players.descriptionSource,
            primaryImageSource: players.headshotSource,
            heroImageSource: players.heroImageSource,
            websiteSource: players.websiteSource,
            enrichmentSnapshot: players.enrichmentSnapshot,
            enrichedAt: players.enrichedAt,
            enrichmentStatus: players.enrichmentStatus,
            enrichmentError: players.enrichmentError,
            isActive: players.isActive,
            createdAt: players.createdAt,
            updatedAt: players.updatedAt,
        })
            .from(players)
            .leftJoin(sports, eq(players.sportId, sports.id))
            .leftJoin(leagues, eq(players.leagueId, leagues.id))
            .where(where)
            .orderBy(players.name)
            .limit(limit)
            .offset(offset),
        db.select({ count: count() }).from(players).where(where),
    ]);

    return c.json(apiResponse(rows, paginationMeta(page, limit, Number(totalResult?.count || 0))));
});

superAdminRoutes.post('/players', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = createPlayerSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const trimmedName = parsed.data.name.trim();
    const [created] = await db.insert(players).values({
        sportId: parsed.data.sportId || null,
        leagueId: parsed.data.leagueId || null,
        name: trimmedName,
        slug: await allocateCanonicalSlug('player', trimmedName, { shortName: parsed.data.shortName?.trim() || null }),
        shortName: parsed.data.shortName?.trim() || null,
        nationality: parsed.data.nationality?.trim() || null,
        countryCode: parsed.data.countryCode?.trim().toUpperCase() || null,
        headshotUrl: parsed.data.headshotUrl?.trim() || null,
        heroImageUrl: parsed.data.heroImageUrl?.trim() || null,
        website: parsed.data.website?.trim() || null,
        shortDescription: parsed.data.shortDescription?.trim() || null,
        description: parsed.data.description?.trim() || null,
        aliases: parsed.data.aliases?.map((item) => item.trim()).filter(Boolean) || [],
        shortDescriptionSource: parsed.data.shortDescription?.trim() ? 'MANUAL' : 'NONE',
        descriptionSource: parsed.data.description?.trim() ? 'MANUAL' : 'NONE',
        headshotSource: parsed.data.headshotUrl?.trim() ? 'MANUAL' : 'NONE',
        heroImageSource: parsed.data.heroImageUrl?.trim() ? 'MANUAL' : 'NONE',
        websiteSource: parsed.data.website?.trim() ? 'MANUAL' : 'NONE',
        externalId: parsed.data.externalId?.trim() || null,
        isActive: parsed.data.isActive,
    }).returning();

    return c.json(apiResponse(created), 201);
});

superAdminRoutes.patch('/players/:playerId', async (c) => {
    const playerId = c.req.param('playerId');
    const body = await c.req.json().catch(() => ({}));
    const parsed = updatePlayerSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const [existing] = await db.select({
        id: players.id,
        headshotUrl: players.headshotUrl,
        headshotSource: players.headshotSource,
        heroImageUrl: players.heroImageUrl,
        heroImageSource: players.heroImageSource,
        website: players.website,
        websiteSource: players.websiteSource,
        shortDescription: players.shortDescription,
        shortDescriptionSource: players.shortDescriptionSource,
        description: players.description,
        descriptionSource: players.descriptionSource,
    }).from(players).where(eq(players.id, playerId)).limit(1);
    if (!existing) return c.json(apiError('NOT_FOUND', 'Player not found'), 404);

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.sportId !== undefined) updates.sportId = parsed.data.sportId || null;
    if (parsed.data.leagueId !== undefined) updates.leagueId = parsed.data.leagueId || null;
    if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
    if (parsed.data.shortName !== undefined) updates.shortName = parsed.data.shortName?.trim() || null;
    if (parsed.data.nationality !== undefined) updates.nationality = parsed.data.nationality?.trim() || null;
    if (parsed.data.countryCode !== undefined) updates.countryCode = parsed.data.countryCode?.trim().toUpperCase() || null;
    if (parsed.data.headshotUrl !== undefined) {
        updates.headshotUrl = parsed.data.headshotUrl?.trim() || null;
        updates.headshotSource = resolveUpdatedFieldSource(parsed.data.headshotUrl, existing.headshotUrl, existing.headshotSource);
    }
    if (parsed.data.heroImageUrl !== undefined) {
        updates.heroImageUrl = parsed.data.heroImageUrl?.trim() || null;
        updates.heroImageSource = resolveUpdatedFieldSource(parsed.data.heroImageUrl, existing.heroImageUrl, existing.heroImageSource);
    }
    if (parsed.data.website !== undefined) {
        updates.website = parsed.data.website?.trim() || null;
        updates.websiteSource = resolveUpdatedFieldSource(parsed.data.website, existing.website, existing.websiteSource);
    }
    if (parsed.data.shortDescription !== undefined) {
        updates.shortDescription = parsed.data.shortDescription?.trim() || null;
        updates.shortDescriptionSource = resolveUpdatedFieldSource(parsed.data.shortDescription, existing.shortDescription, existing.shortDescriptionSource);
    }
    if (parsed.data.description !== undefined) {
        updates.description = parsed.data.description?.trim() || null;
        updates.descriptionSource = resolveUpdatedFieldSource(parsed.data.description, existing.description, existing.descriptionSource);
    }
    if (parsed.data.aliases !== undefined) updates.aliases = parsed.data.aliases.map((item) => item.trim()).filter(Boolean);
    if (parsed.data.externalId !== undefined) updates.externalId = parsed.data.externalId?.trim() || null;
    if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

    await db.update(players).set(updates).where(eq(players.id, playerId));
    return c.json(apiResponse({ message: 'Player updated' }));
});

superAdminRoutes.get('/drivers', async (c) => {
    const parsed = paginationQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid query', parsed.error.issues), 400);
    }
    const { page, limit, search } = parsed.data;
    const offset = paginationOffset(page, limit);
    const where = search
        ? or(
            ilike(drivers.name, `%${search}%`),
            ilike(drivers.shortName, `%${search}%`),
            ilike(drivers.slug, `%${search}%`),
            ilike(drivers.nationality, `%${search}%`),
        )
        : undefined;

    const [rows, [totalResult]] = await Promise.all([
        db.select({
            id: drivers.id,
            name: drivers.name,
            slug: drivers.slug,
            shortName: drivers.shortName,
            nationality: drivers.nationality,
            countryCode: drivers.countryCode,
            headshotUrl: drivers.headshotUrl,
            heroImageUrl: drivers.heroImageUrl,
            website: drivers.website,
            aliases: drivers.aliases,
            shortDescription: drivers.shortDescription,
            description: drivers.description,
            shortDescriptionSource: drivers.shortDescriptionSource,
            descriptionSource: drivers.descriptionSource,
            primaryImageSource: drivers.headshotSource,
            heroImageSource: drivers.heroImageSource,
            websiteSource: drivers.websiteSource,
            enrichmentSnapshot: drivers.enrichmentSnapshot,
            enrichmentStatus: drivers.enrichmentStatus,
            enrichedAt: drivers.enrichedAt,
            enrichmentError: drivers.enrichmentError,
            isActive: drivers.isActive,
            createdAt: drivers.createdAt,
            updatedAt: drivers.updatedAt,
        }).from(drivers).where(where).orderBy(drivers.name).limit(limit).offset(offset),
        db.select({ count: count() }).from(drivers).where(where),
    ]);

    return c.json(apiResponse(rows, paginationMeta(page, limit, Number(totalResult?.count || 0))));
});

superAdminRoutes.post('/drivers', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = createDriverSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const trimmedName = parsed.data.name.trim();
    const [created] = await db.insert(drivers).values({
        name: trimmedName,
        slug: await allocateCanonicalSlug('driver', trimmedName, { shortName: parsed.data.shortName?.trim() || null }),
        shortName: parsed.data.shortName?.trim() || null,
        nationality: parsed.data.nationality?.trim() || null,
        countryCode: parsed.data.countryCode?.trim().toUpperCase() || null,
        headshotUrl: parsed.data.headshotUrl?.trim() || null,
        heroImageUrl: parsed.data.heroImageUrl?.trim() || null,
        website: parsed.data.website?.trim() || null,
        shortDescription: parsed.data.shortDescription?.trim() || null,
        description: parsed.data.description?.trim() || null,
        aliases: parsed.data.aliases?.map((item) => item.trim()).filter(Boolean) || [],
        shortDescriptionSource: parsed.data.shortDescription?.trim() ? 'MANUAL' : 'NONE',
        descriptionSource: parsed.data.description?.trim() ? 'MANUAL' : 'NONE',
        headshotSource: parsed.data.headshotUrl?.trim() ? 'MANUAL' : 'NONE',
        heroImageSource: parsed.data.heroImageUrl?.trim() ? 'MANUAL' : 'NONE',
        websiteSource: parsed.data.website?.trim() ? 'MANUAL' : 'NONE',
        externalId: parsed.data.externalId?.trim() || null,
        isActive: parsed.data.isActive,
    }).returning();

    return c.json(apiResponse(created), 201);
});

superAdminRoutes.patch('/drivers/:driverId', async (c) => {
    const driverId = c.req.param('driverId');
    const body = await c.req.json().catch(() => ({}));
    const parsed = updateDriverSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const [existing] = await db.select({
        id: drivers.id,
        headshotUrl: drivers.headshotUrl,
        headshotSource: drivers.headshotSource,
        heroImageUrl: drivers.heroImageUrl,
        heroImageSource: drivers.heroImageSource,
        website: drivers.website,
        websiteSource: drivers.websiteSource,
        shortDescription: drivers.shortDescription,
        shortDescriptionSource: drivers.shortDescriptionSource,
        description: drivers.description,
        descriptionSource: drivers.descriptionSource,
    }).from(drivers).where(eq(drivers.id, driverId)).limit(1);
    if (!existing) return c.json(apiError('NOT_FOUND', 'Driver not found'), 404);

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
    if (parsed.data.shortName !== undefined) updates.shortName = parsed.data.shortName?.trim() || null;
    if (parsed.data.nationality !== undefined) updates.nationality = parsed.data.nationality?.trim() || null;
    if (parsed.data.countryCode !== undefined) updates.countryCode = parsed.data.countryCode?.trim().toUpperCase() || null;
    if (parsed.data.headshotUrl !== undefined) {
        updates.headshotUrl = parsed.data.headshotUrl?.trim() || null;
        updates.headshotSource = resolveUpdatedFieldSource(parsed.data.headshotUrl, existing.headshotUrl, existing.headshotSource);
    }
    if (parsed.data.heroImageUrl !== undefined) {
        updates.heroImageUrl = parsed.data.heroImageUrl?.trim() || null;
        updates.heroImageSource = resolveUpdatedFieldSource(parsed.data.heroImageUrl, existing.heroImageUrl, existing.heroImageSource);
    }
    if (parsed.data.website !== undefined) {
        updates.website = parsed.data.website?.trim() || null;
        updates.websiteSource = resolveUpdatedFieldSource(parsed.data.website, existing.website, existing.websiteSource);
    }
    if (parsed.data.shortDescription !== undefined) {
        updates.shortDescription = parsed.data.shortDescription?.trim() || null;
        updates.shortDescriptionSource = resolveUpdatedFieldSource(parsed.data.shortDescription, existing.shortDescription, existing.shortDescriptionSource);
    }
    if (parsed.data.description !== undefined) {
        updates.description = parsed.data.description?.trim() || null;
        updates.descriptionSource = resolveUpdatedFieldSource(parsed.data.description, existing.description, existing.descriptionSource);
    }
    if (parsed.data.aliases !== undefined) updates.aliases = parsed.data.aliases.map((item) => item.trim()).filter(Boolean);
    if (parsed.data.externalId !== undefined) updates.externalId = parsed.data.externalId?.trim() || null;
    if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

    await db.update(drivers).set(updates).where(eq(drivers.id, driverId));
    return c.json(apiResponse({ message: 'Driver updated' }));
});

superAdminRoutes.get('/entrants', async (c) => {
    const parsed = paginationQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid query', parsed.error.issues), 400);
    }
    const { page, limit, search } = parsed.data;
    const offset = paginationOffset(page, limit);
    const where = search
        ? or(
            ilike(entrants.name, `%${search}%`),
            ilike(entrants.shortName, `%${search}%`),
            ilike(entrants.slug, `%${search}%`),
        )
        : undefined;

    const [rows, [totalResult]] = await Promise.all([
        db.select({
            id: entrants.id,
            leagueId: entrants.leagueId,
            leagueName: leagues.name,
            name: entrants.name,
            slug: entrants.slug,
            shortName: entrants.shortName,
            logoUrl: entrants.logoUrl,
            brandColor: entrants.brandColor,
            heroImageUrl: entrants.heroImageUrl,
            website: entrants.website,
            aliases: entrants.aliases,
            shortDescription: entrants.shortDescription,
            description: entrants.description,
            shortDescriptionSource: entrants.shortDescriptionSource,
            descriptionSource: entrants.descriptionSource,
            primaryImageSource: entrants.logoSource,
            heroImageSource: entrants.heroImageSource,
            websiteSource: entrants.websiteSource,
            enrichmentSnapshot: entrants.enrichmentSnapshot,
            enrichmentStatus: entrants.enrichmentStatus,
            enrichedAt: entrants.enrichedAt,
            enrichmentError: entrants.enrichmentError,
            isActive: entrants.isActive,
            createdAt: entrants.createdAt,
            updatedAt: entrants.updatedAt,
        }).from(entrants).leftJoin(leagues, eq(entrants.leagueId, leagues.id)).where(where).orderBy(entrants.name).limit(limit).offset(offset),
        db.select({ count: count() }).from(entrants).where(where),
    ]);

    return c.json(apiResponse(rows, paginationMeta(page, limit, Number(totalResult?.count || 0))));
});

superAdminRoutes.post('/entrants', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = createEntrantSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }
    const trimmedName = parsed.data.name.trim();
    const [created] = await db.insert(entrants).values({
        leagueId: parsed.data.leagueId || null,
        name: trimmedName,
        slug: await allocateCanonicalSlug('entrant', trimmedName, { shortName: parsed.data.shortName?.trim() || null }),
        shortName: parsed.data.shortName?.trim() || null,
        brandColor: parsed.data.brandColor?.trim() || null,
        logoUrl: parsed.data.logoUrl?.trim() || null,
        heroImageUrl: parsed.data.heroImageUrl?.trim() || null,
        website: parsed.data.website?.trim() || null,
        shortDescription: parsed.data.shortDescription?.trim() || null,
        description: parsed.data.description?.trim() || null,
        aliases: parsed.data.aliases?.map((item) => item.trim()).filter(Boolean) || [],
        shortDescriptionSource: parsed.data.shortDescription?.trim() ? 'MANUAL' : 'NONE',
        descriptionSource: parsed.data.description?.trim() ? 'MANUAL' : 'NONE',
        logoSource: parsed.data.logoUrl?.trim() ? 'MANUAL' : 'NONE',
        heroImageSource: parsed.data.heroImageUrl?.trim() ? 'MANUAL' : 'NONE',
        websiteSource: parsed.data.website?.trim() ? 'MANUAL' : 'NONE',
        externalId: parsed.data.externalId?.trim() || null,
        isActive: parsed.data.isActive,
    }).returning();
    return c.json(apiResponse(created), 201);
});

superAdminRoutes.patch('/entrants/:entrantId', async (c) => {
    const entrantId = c.req.param('entrantId');
    const body = await c.req.json().catch(() => ({}));
    const parsed = updateEntrantSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }
    const [existing] = await db.select({
        id: entrants.id,
        logoUrl: entrants.logoUrl,
        logoSource: entrants.logoSource,
        heroImageUrl: entrants.heroImageUrl,
        heroImageSource: entrants.heroImageSource,
        website: entrants.website,
        websiteSource: entrants.websiteSource,
        shortDescription: entrants.shortDescription,
        shortDescriptionSource: entrants.shortDescriptionSource,
        description: entrants.description,
        descriptionSource: entrants.descriptionSource,
    }).from(entrants).where(eq(entrants.id, entrantId)).limit(1);
    if (!existing) return c.json(apiError('NOT_FOUND', 'Motorsport team not found'), 404);

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.leagueId !== undefined) updates.leagueId = parsed.data.leagueId || null;
    if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
    if (parsed.data.shortName !== undefined) updates.shortName = parsed.data.shortName?.trim() || null;
    if (parsed.data.brandColor !== undefined) updates.brandColor = parsed.data.brandColor?.trim() || null;
    if (parsed.data.logoUrl !== undefined) {
        updates.logoUrl = parsed.data.logoUrl?.trim() || null;
        updates.logoSource = resolveUpdatedFieldSource(parsed.data.logoUrl, existing.logoUrl, existing.logoSource);
    }
    if (parsed.data.heroImageUrl !== undefined) {
        updates.heroImageUrl = parsed.data.heroImageUrl?.trim() || null;
        updates.heroImageSource = resolveUpdatedFieldSource(parsed.data.heroImageUrl, existing.heroImageUrl, existing.heroImageSource);
    }
    if (parsed.data.website !== undefined) {
        updates.website = parsed.data.website?.trim() || null;
        updates.websiteSource = resolveUpdatedFieldSource(parsed.data.website, existing.website, existing.websiteSource);
    }
    if (parsed.data.shortDescription !== undefined) {
        updates.shortDescription = parsed.data.shortDescription?.trim() || null;
        updates.shortDescriptionSource = resolveUpdatedFieldSource(parsed.data.shortDescription, existing.shortDescription, existing.shortDescriptionSource);
    }
    if (parsed.data.description !== undefined) {
        updates.description = parsed.data.description?.trim() || null;
        updates.descriptionSource = resolveUpdatedFieldSource(parsed.data.description, existing.description, existing.descriptionSource);
    }
    if (parsed.data.aliases !== undefined) updates.aliases = parsed.data.aliases.map((item) => item.trim()).filter(Boolean);
    if (parsed.data.externalId !== undefined) updates.externalId = parsed.data.externalId?.trim() || null;
    if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

    await db.update(entrants).set(updates).where(eq(entrants.id, entrantId));
    return c.json(apiResponse({ message: 'Motorsport team updated' }));
});

superAdminRoutes.get('/manufacturers', async (c) => {
    const parsed = paginationQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid query', parsed.error.issues), 400);
    }
    const { page, limit, search } = parsed.data;
    const offset = paginationOffset(page, limit);
    const where = search
        ? or(
            ilike(manufacturers.name, `%${search}%`),
            ilike(manufacturers.shortName, `%${search}%`),
            ilike(manufacturers.slug, `%${search}%`),
        )
        : undefined;

    const [rows, [totalResult]] = await Promise.all([
        db.select({
            id: manufacturers.id,
            leagueId: manufacturers.leagueId,
            leagueName: leagues.name,
            name: manufacturers.name,
            slug: manufacturers.slug,
            shortName: manufacturers.shortName,
            logoUrl: manufacturers.logoUrl,
            heroImageUrl: manufacturers.heroImageUrl,
            website: manufacturers.website,
            aliases: manufacturers.aliases,
            shortDescription: manufacturers.shortDescription,
            description: manufacturers.description,
            shortDescriptionSource: manufacturers.shortDescriptionSource,
            descriptionSource: manufacturers.descriptionSource,
            primaryImageSource: manufacturers.logoSource,
            heroImageSource: manufacturers.heroImageSource,
            websiteSource: manufacturers.websiteSource,
            enrichmentSnapshot: manufacturers.enrichmentSnapshot,
            enrichmentStatus: manufacturers.enrichmentStatus,
            enrichedAt: manufacturers.enrichedAt,
            enrichmentError: manufacturers.enrichmentError,
            isActive: manufacturers.isActive,
            createdAt: manufacturers.createdAt,
            updatedAt: manufacturers.updatedAt,
        }).from(manufacturers).leftJoin(leagues, eq(manufacturers.leagueId, leagues.id)).where(where).orderBy(manufacturers.name).limit(limit).offset(offset),
        db.select({ count: count() }).from(manufacturers).where(where),
    ]);

    return c.json(apiResponse(rows, paginationMeta(page, limit, Number(totalResult?.count || 0))));
});

superAdminRoutes.post('/manufacturers', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = createManufacturerSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }
    const trimmedName = parsed.data.name.trim();
    const [created] = await db.insert(manufacturers).values({
        leagueId: parsed.data.leagueId || null,
        name: trimmedName,
        slug: await allocateCanonicalSlug('manufacturer', trimmedName, { shortName: parsed.data.shortName?.trim() || null }),
        shortName: parsed.data.shortName?.trim() || null,
        logoUrl: parsed.data.logoUrl?.trim() || null,
        heroImageUrl: parsed.data.heroImageUrl?.trim() || null,
        website: parsed.data.website?.trim() || null,
        shortDescription: parsed.data.shortDescription?.trim() || null,
        description: parsed.data.description?.trim() || null,
        aliases: parsed.data.aliases?.map((item) => item.trim()).filter(Boolean) || [],
        shortDescriptionSource: parsed.data.shortDescription?.trim() ? 'MANUAL' : 'NONE',
        descriptionSource: parsed.data.description?.trim() ? 'MANUAL' : 'NONE',
        logoSource: parsed.data.logoUrl?.trim() ? 'MANUAL' : 'NONE',
        heroImageSource: parsed.data.heroImageUrl?.trim() ? 'MANUAL' : 'NONE',
        websiteSource: parsed.data.website?.trim() ? 'MANUAL' : 'NONE',
        externalId: parsed.data.externalId?.trim() || null,
        isActive: parsed.data.isActive,
    }).returning();
    return c.json(apiResponse(created), 201);
});

superAdminRoutes.patch('/manufacturers/:manufacturerId', async (c) => {
    const manufacturerId = c.req.param('manufacturerId');
    const body = await c.req.json().catch(() => ({}));
    const parsed = updateManufacturerSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }
    const [existing] = await db.select({
        id: manufacturers.id,
        logoUrl: manufacturers.logoUrl,
        logoSource: manufacturers.logoSource,
        heroImageUrl: manufacturers.heroImageUrl,
        heroImageSource: manufacturers.heroImageSource,
        website: manufacturers.website,
        websiteSource: manufacturers.websiteSource,
        shortDescription: manufacturers.shortDescription,
        shortDescriptionSource: manufacturers.shortDescriptionSource,
        description: manufacturers.description,
        descriptionSource: manufacturers.descriptionSource,
    }).from(manufacturers).where(eq(manufacturers.id, manufacturerId)).limit(1);
    if (!existing) return c.json(apiError('NOT_FOUND', 'Manufacturer not found'), 404);

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.leagueId !== undefined) updates.leagueId = parsed.data.leagueId || null;
    if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
    if (parsed.data.shortName !== undefined) updates.shortName = parsed.data.shortName?.trim() || null;
    if (parsed.data.logoUrl !== undefined) {
        updates.logoUrl = parsed.data.logoUrl?.trim() || null;
        updates.logoSource = resolveUpdatedFieldSource(parsed.data.logoUrl, existing.logoUrl, existing.logoSource);
    }
    if (parsed.data.heroImageUrl !== undefined) {
        updates.heroImageUrl = parsed.data.heroImageUrl?.trim() || null;
        updates.heroImageSource = resolveUpdatedFieldSource(parsed.data.heroImageUrl, existing.heroImageUrl, existing.heroImageSource);
    }
    if (parsed.data.website !== undefined) {
        updates.website = parsed.data.website?.trim() || null;
        updates.websiteSource = resolveUpdatedFieldSource(parsed.data.website, existing.website, existing.websiteSource);
    }
    if (parsed.data.shortDescription !== undefined) {
        updates.shortDescription = parsed.data.shortDescription?.trim() || null;
        updates.shortDescriptionSource = resolveUpdatedFieldSource(parsed.data.shortDescription, existing.shortDescription, existing.shortDescriptionSource);
    }
    if (parsed.data.description !== undefined) {
        updates.description = parsed.data.description?.trim() || null;
        updates.descriptionSource = resolveUpdatedFieldSource(parsed.data.description, existing.description, existing.descriptionSource);
    }
    if (parsed.data.aliases !== undefined) updates.aliases = parsed.data.aliases.map((item) => item.trim()).filter(Boolean);
    if (parsed.data.externalId !== undefined) updates.externalId = parsed.data.externalId?.trim() || null;
    if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

    await db.update(manufacturers).set(updates).where(eq(manufacturers.id, manufacturerId));
    return c.json(apiResponse({ message: 'Manufacturer updated' }));
});

superAdminRoutes.get('/recommendations', async (c) => {
    const parsed = recommendationQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid recommendation query', parsed.error.issues), 400);
    }

    try {
        const recommendations = await getRecommendations(parsed.data);
        return c.json(apiResponse(recommendations));
    } catch (error) {
        return c.json(apiError('INTERNAL_ERROR', error instanceof Error ? error.message : 'Failed to load recommendations'), 500);
    }
});

superAdminRoutes.post('/recommendations/preview', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = recommendationPreviewSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid recommendation preview request', parsed.error.issues), 400);
    }

    try {
        const preview = await getRecommendationPreview(parsed.data);
        if (!preview) {
            return c.json(apiError('NOT_FOUND', 'Recommendation not found'), 404);
        }
        return c.json(apiResponse(preview));
    } catch (error) {
        return c.json(apiError('INTERNAL_ERROR', error instanceof Error ? error.message : 'Failed to preview recommendation'), 500);
    }
});

superAdminRoutes.get('/pages', async () => {
    const rows = await db.select().from(staticPages).orderBy(staticPages.slug);
    return new Response(JSON.stringify(apiResponse(rows)), { headers: { 'Content-Type': 'application/json' } });
});

superAdminRoutes.get('/pages/:slug', async (c) => {
    const slug = c.req.param('slug');
    const [page] = await db.select().from(staticPages).where(eq(staticPages.slug, slug)).limit(1);
    if (!page) return c.json(apiError('NOT_FOUND', 'Page not found'), 404);
    return c.json(apiResponse(page));
});

superAdminRoutes.post('/pages', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = staticPageSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const [created] = await db.insert(staticPages).values({
        slug: parsed.data.slug,
        title: parsed.data.title.trim(),
        excerpt: parsed.data.excerpt?.trim() || null,
        contentHtml: DOMPurify.sanitize(parsed.data.contentHtml || ''),
        contentJson: parsed.data.contentJson ?? {},
        status: parsed.data.status,
        seoTitle: parsed.data.seoTitle?.trim() || null,
        seoDescription: parsed.data.seoDescription?.trim() || null,
        updatedBy: null,
        publishedAt: parsed.data.status === 'PUBLISHED' ? new Date() : null,
    }).onConflictDoUpdate({
        target: staticPages.slug,
        set: {
            title: parsed.data.title.trim(),
            excerpt: parsed.data.excerpt?.trim() || null,
            contentHtml: DOMPurify.sanitize(parsed.data.contentHtml || ''),
            contentJson: parsed.data.contentJson ?? {},
            status: parsed.data.status,
            seoTitle: parsed.data.seoTitle?.trim() || null,
            seoDescription: parsed.data.seoDescription?.trim() || null,
            updatedAt: new Date(),
            publishedAt: parsed.data.status === 'PUBLISHED' ? new Date() : null,
        },
    }).returning();

    return c.json(apiResponse(created), 201);
});

superAdminRoutes.patch('/pages/:slug', async (c) => {
    const slug = c.req.param('slug');
    const body = await c.req.json().catch(() => ({}));
    const parsed = staticPageUpdateSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const [existing] = await db.select({ id: staticPages.id }).from(staticPages).where(eq(staticPages.slug, slug)).limit(1);
    if (!existing) return c.json(apiError('NOT_FOUND', 'Page not found'), 404);

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.title !== undefined) updates.title = parsed.data.title.trim();
    if (parsed.data.excerpt !== undefined) updates.excerpt = parsed.data.excerpt?.trim() || null;
    if (parsed.data.contentHtml !== undefined) updates.contentHtml = DOMPurify.sanitize(parsed.data.contentHtml || '');
    if (parsed.data.contentJson !== undefined) updates.contentJson = parsed.data.contentJson ?? {};
    if (parsed.data.status !== undefined) updates.status = parsed.data.status;
    if (parsed.data.seoTitle !== undefined) updates.seoTitle = parsed.data.seoTitle?.trim() || null;
    if (parsed.data.seoDescription !== undefined) updates.seoDescription = parsed.data.seoDescription?.trim() || null;
    if (parsed.data.status !== undefined) updates.publishedAt = parsed.data.status === 'PUBLISHED' ? new Date() : null;

    await db.update(staticPages).set(updates).where(eq(staticPages.slug, slug));
    const [updated] = await db.select().from(staticPages).where(eq(staticPages.slug, slug)).limit(1);
    return c.json(apiResponse(updated));
});

superAdminRoutes.get('/standings/:leagueId', async (c) => {
    const leagueId = c.req.param('leagueId');
    const [existing] = await db.select({ id: leagues.id }).from(leagues).where(eq(leagues.id, leagueId)).limit(1);
    if (!existing) return c.json(apiError('NOT_FOUND', 'League not found'), 404);
    return c.json(apiResponse(await getLatestLeagueStandings(leagueId)));
});

superAdminRoutes.post('/standings/:leagueId/refresh', async (c) => {
    const leagueId = c.req.param('leagueId');
    const [existing] = await db.select({ id: leagues.id }).from(leagues).where(eq(leagues.id, leagueId)).limit(1);
    if (!existing) return c.json(apiError('NOT_FOUND', 'League not found'), 404);
    return c.json(apiResponse(await refreshLeagueStandingsSnapshot(leagueId)));
});

superAdminRoutes.get('/predictions/:matchId', async (c) => {
    const matchId = c.req.param('matchId');
    const [existing] = await db.select({ id: matches.id }).from(matches).where(eq(matches.id, matchId)).limit(1);
    if (!existing) return c.json(apiError('NOT_FOUND', 'Match not found'), 404);
    const prediction = await getMatchPrediction(matchId);
    if (!prediction) return c.json(apiError('NOT_AVAILABLE', 'Prediction unavailable'), 404);
    return c.json(apiResponse(prediction));
});

superAdminRoutes.post('/predictions/:matchId/refresh', async (c) => {
    const matchId = c.req.param('matchId');
    const [existing] = await db.select({ id: matches.id }).from(matches).where(eq(matches.id, matchId)).limit(1);
    if (!existing) return c.json(apiError('NOT_FOUND', 'Match not found'), 404);
    const prediction = await refreshMatchPrediction(matchId);
    if (!prediction) return c.json(apiError('NOT_AVAILABLE', 'Prediction unavailable'), 404);
    return c.json(apiResponse(prediction));
});

async function resolveEnrichmentRecord(kind: EntityKind, id: string): Promise<{ record: EntityBaseRecord | null; apply: (updates: EntityEnrichmentResult['updates'], snapshot: Record<string, unknown>) => Promise<void> }> {
    if (kind === 'league') {
        const [row] = await db.select({
            id: leagues.id,
            name: leagues.name,
            shortName: leagues.shortName,
            sportName: sports.name,
            country: leagues.country,
            website: leagues.website,
            shortDescription: leagues.shortDescription,
            description: leagues.description,
            primaryImageUrl: leagues.logoUrl,
            heroImageUrl: leagues.heroImageUrl,
            shortDescriptionSource: leagues.shortDescriptionSource,
            descriptionSource: leagues.descriptionSource,
            primaryImageSource: leagues.logoSource,
            heroImageSource: leagues.heroImageSource,
            websiteSource: leagues.websiteSource,
        }).from(leagues).leftJoin(sports, eq(leagues.sportId, sports.id)).where(eq(leagues.id, id)).limit(1);
        return {
            record: row || null,
            apply: async (updates, snapshot) => {
                await db.update(leagues).set({
                    shortDescription: updates.shortDescription ?? undefined,
                    description: updates.description ?? undefined,
                    logoUrl: updates.primaryImageUrl ?? undefined,
                    heroImageUrl: updates.heroImageUrl ?? undefined,
                    website: updates.website ?? undefined,
                    aliases: updates.aliases ?? undefined,
                    enrichmentSnapshot: snapshot,
                    enrichmentStatus: 'SYNCED',
                    enrichedAt: new Date(),
                    enrichmentError: null,
                    shortDescriptionSource: updates.shortDescription ? 'GOOGLE' : undefined,
                    descriptionSource: updates.description ? 'GOOGLE' : undefined,
                    logoSource: updates.primaryImageUrl ? 'GOOGLE' : undefined,
                    heroImageSource: updates.heroImageUrl ? 'GOOGLE' : undefined,
                    websiteSource: updates.website ? 'GOOGLE' : undefined,
                    updatedAt: new Date(),
                }).where(eq(leagues.id, id));
            },
        };
    }

    if (kind === 'team') {
        const [row] = await db.select({
            id: teams.id,
            name: teams.name,
            shortName: teams.shortName,
            sportName: sports.name,
            leagueName: leagues.name,
            country: teams.country,
            website: teams.website,
            shortDescription: teams.shortDescription,
            description: teams.description,
            primaryImageUrl: teams.crestUrl,
            heroImageUrl: teams.heroImageUrl,
            shortDescriptionSource: teams.shortDescriptionSource,
            descriptionSource: teams.descriptionSource,
            primaryImageSource: teams.crestSource,
            heroImageSource: teams.heroImageSource,
            websiteSource: teams.websiteSource,
        }).from(teams).leftJoin(leagues, eq(teams.leagueId, leagues.id)).leftJoin(sports, eq(leagues.sportId, sports.id)).where(eq(teams.id, id)).limit(1);
        return {
            record: row || null,
            apply: async (updates, snapshot) => {
                await db.update(teams).set({
                    shortDescription: updates.shortDescription ?? undefined,
                    description: updates.description ?? undefined,
                    crestUrl: updates.primaryImageUrl ?? undefined,
                    heroImageUrl: updates.heroImageUrl ?? undefined,
                    website: updates.website ?? undefined,
                    aliases: updates.aliases ?? undefined,
                    enrichmentSnapshot: snapshot,
                    enrichmentStatus: 'SYNCED',
                    enrichedAt: new Date(),
                    enrichmentError: null,
                    shortDescriptionSource: updates.shortDescription ? 'GOOGLE' : undefined,
                    descriptionSource: updates.description ? 'GOOGLE' : undefined,
                    crestSource: updates.primaryImageUrl ? 'GOOGLE' : undefined,
                    heroImageSource: updates.heroImageUrl ? 'GOOGLE' : undefined,
                    websiteSource: updates.website ? 'GOOGLE' : undefined,
                }).where(eq(teams.id, id));
            },
        };
    }

    if (kind === 'player') {
        const [row] = await db.select({
            id: players.id,
            name: players.name,
            shortName: players.shortName,
            sportName: sports.name,
            leagueName: leagues.name,
            country: players.nationality,
            nationality: players.nationality,
            website: players.website,
            shortDescription: players.shortDescription,
            description: players.description,
            primaryImageUrl: players.headshotUrl,
            heroImageUrl: players.heroImageUrl,
            shortDescriptionSource: players.shortDescriptionSource,
            descriptionSource: players.descriptionSource,
            primaryImageSource: players.headshotSource,
            heroImageSource: players.heroImageSource,
            websiteSource: players.websiteSource,
        }).from(players).leftJoin(sports, eq(players.sportId, sports.id)).leftJoin(leagues, eq(players.leagueId, leagues.id)).where(eq(players.id, id)).limit(1);
        return {
            record: row || null,
            apply: async (updates, snapshot) => {
                await db.update(players).set({
                    shortDescription: updates.shortDescription ?? undefined,
                    description: updates.description ?? undefined,
                    headshotUrl: updates.primaryImageUrl ?? undefined,
                    heroImageUrl: updates.heroImageUrl ?? undefined,
                    website: updates.website ?? undefined,
                    aliases: updates.aliases ?? undefined,
                    enrichmentSnapshot: snapshot,
                    enrichmentStatus: 'SYNCED',
                    enrichedAt: new Date(),
                    enrichmentError: null,
                    shortDescriptionSource: updates.shortDescription ? 'GOOGLE' : undefined,
                    descriptionSource: updates.description ? 'GOOGLE' : undefined,
                    headshotSource: updates.primaryImageUrl ? 'GOOGLE' : undefined,
                    heroImageSource: updates.heroImageUrl ? 'GOOGLE' : undefined,
                    websiteSource: updates.website ? 'GOOGLE' : undefined,
                    updatedAt: new Date(),
                }).where(eq(players.id, id));
            },
        };
    }

    if (kind === 'driver') {
        const [row] = await db.select({
            id: drivers.id,
            name: drivers.name,
            shortName: drivers.shortName,
            country: drivers.nationality,
            nationality: drivers.nationality,
            website: drivers.website,
            shortDescription: drivers.shortDescription,
            description: drivers.description,
            primaryImageUrl: drivers.headshotUrl,
            heroImageUrl: drivers.heroImageUrl,
            shortDescriptionSource: drivers.shortDescriptionSource,
            descriptionSource: drivers.descriptionSource,
            primaryImageSource: drivers.headshotSource,
            heroImageSource: drivers.heroImageSource,
            websiteSource: drivers.websiteSource,
        }).from(drivers).where(eq(drivers.id, id)).limit(1);
        return {
            record: row || null,
            apply: async (updates, snapshot) => {
                await db.update(drivers).set({
                    shortDescription: updates.shortDescription ?? undefined,
                    description: updates.description ?? undefined,
                    headshotUrl: updates.primaryImageUrl ?? undefined,
                    heroImageUrl: updates.heroImageUrl ?? undefined,
                    website: updates.website ?? undefined,
                    aliases: updates.aliases ?? undefined,
                    enrichmentSnapshot: snapshot,
                    enrichmentStatus: 'SYNCED',
                    enrichedAt: new Date(),
                    enrichmentError: null,
                    shortDescriptionSource: updates.shortDescription ? 'GOOGLE' : undefined,
                    descriptionSource: updates.description ? 'GOOGLE' : undefined,
                    headshotSource: updates.primaryImageUrl ? 'GOOGLE' : undefined,
                    heroImageSource: updates.heroImageUrl ? 'GOOGLE' : undefined,
                    websiteSource: updates.website ? 'GOOGLE' : undefined,
                    updatedAt: new Date(),
                }).where(eq(drivers.id, id));
            },
        };
    }

    if (kind === 'stadium') {
        const [row] = await db.select({
            id: stadiums.id,
            name: stadiums.name,
            shortName: stadiums.shortName,
            city: stadiums.city,
            country: stadiums.country,
            website: stadiums.website,
            shortDescription: stadiums.shortDescription,
            description: stadiums.description,
            primaryImageUrl: stadiums.imageUrl,
            heroImageUrl: stadiums.heroImageUrl,
            shortDescriptionSource: stadiums.shortDescriptionSource,
            descriptionSource: stadiums.descriptionSource,
            primaryImageSource: stadiums.imageSource,
            heroImageSource: stadiums.heroImageSource,
            websiteSource: stadiums.websiteSource,
        }).from(stadiums).where(eq(stadiums.id, id)).limit(1);
        return {
            record: row || null,
            apply: async (updates, snapshot) => {
                await db.update(stadiums).set({
                    shortDescription: updates.shortDescription ?? undefined,
                    description: updates.description ?? undefined,
                    imageUrl: updates.primaryImageUrl ?? undefined,
                    heroImageUrl: updates.heroImageUrl ?? undefined,
                    website: updates.website ?? undefined,
                    aliases: updates.aliases ?? undefined,
                    enrichmentSnapshot: snapshot,
                    enrichmentStatus: 'SYNCED',
                    enrichedAt: new Date(),
                    enrichmentError: null,
                    shortDescriptionSource: updates.shortDescription ? 'GOOGLE' : undefined,
                    descriptionSource: updates.description ? 'GOOGLE' : undefined,
                    imageSource: updates.primaryImageUrl ? 'GOOGLE' : undefined,
                    heroImageSource: updates.heroImageUrl ? 'GOOGLE' : undefined,
                    websiteSource: updates.website ? 'GOOGLE' : undefined,
                    updatedAt: new Date(),
                }).where(eq(stadiums.id, id));
            },
        };
    }

    if (kind === 'entrant' || kind === 'manufacturer') {
        const table = kind === 'entrant' ? entrants : manufacturers;
        const [row] = await db.select({
            id: table.id,
            name: table.name,
            shortName: table.shortName,
            leagueName: leagues.name,
            website: table.website,
            shortDescription: table.shortDescription,
            description: table.description,
            primaryImageUrl: table.logoUrl,
            heroImageUrl: table.heroImageUrl,
            shortDescriptionSource: table.shortDescriptionSource,
            descriptionSource: table.descriptionSource,
            primaryImageSource: table.logoSource,
            heroImageSource: table.heroImageSource,
            websiteSource: table.websiteSource,
        }).from(table).leftJoin(leagues, eq(table.leagueId, leagues.id)).where(eq(table.id, id)).limit(1);
        return {
            record: row || null,
            apply: async (updates, snapshot) => {
                await db.update(table).set({
                    shortDescription: updates.shortDescription ?? undefined,
                    description: updates.description ?? undefined,
                    logoUrl: updates.primaryImageUrl ?? undefined,
                    heroImageUrl: updates.heroImageUrl ?? undefined,
                    website: updates.website ?? undefined,
                    aliases: updates.aliases ?? undefined,
                    enrichmentSnapshot: snapshot,
                    enrichmentStatus: 'SYNCED',
                    enrichedAt: new Date(),
                    enrichmentError: null,
                    shortDescriptionSource: updates.shortDescription ? 'GOOGLE' : undefined,
                    descriptionSource: updates.description ? 'GOOGLE' : undefined,
                    logoSource: updates.primaryImageUrl ? 'GOOGLE' : undefined,
                    heroImageSource: updates.heroImageUrl ? 'GOOGLE' : undefined,
                    websiteSource: updates.website ? 'GOOGLE' : undefined,
                    updatedAt: new Date(),
                }).where(eq(table.id, id));
            },
        };
    }

    return { record: null, apply: async () => undefined };
}

async function refreshEnrichmentTarget(kind: EntityKind, id: string) {
    const target = await resolveEnrichmentRecord(kind, id);
    if (!target.record) {
        throw new Error('Entity not found');
    }

    const enrichment = await buildEntityEnrichment(kind, target.record);
    await target.apply(enrichment.updates, enrichment.snapshot);
    return enrichment;
}

async function resetEnrichmentTarget(kind: EntityKind, id: string) {
    if (kind === 'league') {
        await db.update(leagues).set({
            shortDescription: null,
            description: null,
            logoUrl: null,
            heroImageUrl: null,
            website: null,
            aliases: [],
            shortDescriptionSource: 'NONE',
            descriptionSource: 'NONE',
            logoSource: 'NONE',
            heroImageSource: 'NONE',
            websiteSource: 'NONE',
            updatedAt: new Date(),
        }).where(eq(leagues.id, id));
        return;
    }

    if (kind === 'team') {
        await db.update(teams).set({
            shortDescription: null,
            description: null,
            crestUrl: null,
            heroImageUrl: null,
            website: null,
            aliases: [],
            shortDescriptionSource: 'NONE',
            descriptionSource: 'NONE',
            crestSource: 'NONE',
            heroImageSource: 'NONE',
            websiteSource: 'NONE',
        }).where(eq(teams.id, id));
        return;
    }

    if (kind === 'player') {
        await db.update(players).set({
            shortDescription: null,
            description: null,
            headshotUrl: null,
            heroImageUrl: null,
            website: null,
            aliases: [],
            shortDescriptionSource: 'NONE',
            descriptionSource: 'NONE',
            headshotSource: 'NONE',
            heroImageSource: 'NONE',
            websiteSource: 'NONE',
            updatedAt: new Date(),
        }).where(eq(players.id, id));
        return;
    }

    if (kind === 'driver') {
        await db.update(drivers).set({
            shortDescription: null,
            description: null,
            headshotUrl: null,
            heroImageUrl: null,
            website: null,
            aliases: [],
            shortDescriptionSource: 'NONE',
            descriptionSource: 'NONE',
            headshotSource: 'NONE',
            heroImageSource: 'NONE',
            websiteSource: 'NONE',
            updatedAt: new Date(),
        }).where(eq(drivers.id, id));
        return;
    }

    if (kind === 'entrant') {
        await db.update(entrants).set({
            shortDescription: null,
            description: null,
            logoUrl: null,
            heroImageUrl: null,
            website: null,
            aliases: [],
            shortDescriptionSource: 'NONE',
            descriptionSource: 'NONE',
            logoSource: 'NONE',
            heroImageSource: 'NONE',
            websiteSource: 'NONE',
            updatedAt: new Date(),
        }).where(eq(entrants.id, id));
        return;
    }

    if (kind === 'stadium') {
        await db.update(stadiums).set({
            shortDescription: null,
            description: null,
            imageUrl: null,
            heroImageUrl: null,
            website: null,
            aliases: [],
            shortDescriptionSource: 'NONE',
            descriptionSource: 'NONE',
            imageSource: 'NONE',
            heroImageSource: 'NONE',
            websiteSource: 'NONE',
            updatedAt: new Date(),
        }).where(eq(stadiums.id, id));
        return;
    }

    if (kind === 'manufacturer') {
        await db.update(manufacturers).set({
            shortDescription: null,
            description: null,
            logoUrl: null,
            heroImageUrl: null,
            website: null,
            aliases: [],
            shortDescriptionSource: 'NONE',
            descriptionSource: 'NONE',
            logoSource: 'NONE',
            heroImageSource: 'NONE',
            websiteSource: 'NONE',
            updatedAt: new Date(),
        }).where(eq(manufacturers.id, id));
    }
}

superAdminRoutes.post('/enrichment/:kind/:id/refresh', async (c) => {
    const parsed = enrichmentKindSchema.safeParse(c.req.param('kind'));
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid enrichment target'), 400);
    }

    const kind = parsed.data;
    const id = c.req.param('id');
    let enrichment: EntityEnrichmentResult;
    try {
        enrichment = await refreshEnrichmentTarget(kind, id);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to refresh enrichment';
        if (message === 'Entity not found') {
            return c.json(apiError('NOT_FOUND', 'Entity not found'), 404);
        }
        return c.json(apiError('INTERNAL_ERROR', message), 500);
    }
    return c.json(apiResponse({ kind, id, enrichment }));
});

superAdminRoutes.post('/enrichment/:kind/:id/revert', async (c) => {
    const parsed = enrichmentKindSchema.safeParse(c.req.param('kind'));
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid enrichment target'), 400);
    }

    const kind = parsed.data;
    const id = c.req.param('id');
    let enrichment: EntityEnrichmentResult;
    try {
        await resetEnrichmentTarget(kind, id);
        enrichment = await refreshEnrichmentTarget(kind, id);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to revert enrichment';
        if (message === 'Entity not found') {
            return c.json(apiError('NOT_FOUND', 'Entity not found'), 404);
        }
        return c.json(apiError('INTERNAL_ERROR', message), 500);
    }
    return c.json(apiResponse({ kind, id, enrichment }));
});

superAdminRoutes.post('/enrichment/league/:leagueId/batch', async (c) => {
    const leagueId = c.req.param('leagueId');
    const body = await c.req.json().catch(() => ({}));
    const parsed = enrichmentBatchSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid batch options', parsed.error.issues), 400);
    }

    const [league] = await db.select({ id: leagues.id, name: leagues.name }).from(leagues).where(eq(leagues.id, leagueId)).limit(1);
    if (!league) {
        return c.json(apiError('NOT_FOUND', 'League not found'), 404);
    }

    const options = {
        includeLeague: parsed.data.includeLeague ?? true,
        includeTeams: parsed.data.includeTeams ?? true,
        includePlayers: parsed.data.includePlayers ?? true,
        includeEntrants: parsed.data.includeEntrants ?? true,
        includeManufacturers: parsed.data.includeManufacturers ?? true,
    };

    const [teamRows, playerRows, entrantRows, manufacturerRows] = await Promise.all([
        options.includeTeams
            ? db.select({ id: teams.id }).from(teams).where(and(eq(teams.leagueId, leagueId), eq(teams.isActive, true))).orderBy(teams.name)
            : Promise.resolve([] as Array<{ id: string }>),
        options.includePlayers
            ? db.select({ id: players.id }).from(players).where(and(eq(players.leagueId, leagueId), eq(players.isActive, true))).orderBy(players.name)
            : Promise.resolve([] as Array<{ id: string }>),
        options.includeEntrants
            ? db.select({ id: entrants.id }).from(entrants).where(and(eq(entrants.leagueId, leagueId), eq(entrants.isActive, true))).orderBy(entrants.name)
            : Promise.resolve([] as Array<{ id: string }>),
        options.includeManufacturers
            ? db.select({ id: manufacturers.id }).from(manufacturers).where(and(eq(manufacturers.leagueId, leagueId), eq(manufacturers.isActive, true))).orderBy(manufacturers.name)
            : Promise.resolve([] as Array<{ id: string }>),
    ]);

    const queue: Array<{ kind: EntityKind; id: string }> = [];
    if (options.includeLeague) queue.push({ kind: 'league', id: leagueId });
    queue.push(...teamRows.map((row) => ({ kind: 'team' as const, id: row.id })));
    queue.push(...playerRows.map((row) => ({ kind: 'player' as const, id: row.id })));
    queue.push(...entrantRows.map((row) => ({ kind: 'entrant' as const, id: row.id })));
    queue.push(...manufacturerRows.map((row) => ({ kind: 'manufacturer' as const, id: row.id })));

    const results: Array<{ kind: EntityKind; id: string; ok: boolean; error?: string }> = [];
    for (const item of queue) {
        try {
            await refreshEnrichmentTarget(item.kind, item.id);
            results.push({ kind: item.kind, id: item.id, ok: true });
        } catch (error) {
            results.push({
                kind: item.kind,
                id: item.id,
                ok: false,
                error: error instanceof Error ? error.message : 'Failed to refresh enrichment',
            });
        }
    }

    return c.json(apiResponse({
        leagueId,
        leagueName: league.name,
        options,
        processed: results.length,
        succeeded: results.filter((item) => item.ok).length,
        failed: results.filter((item) => !item.ok).length,
        results,
    }));
});

export default superAdminRoutes;
