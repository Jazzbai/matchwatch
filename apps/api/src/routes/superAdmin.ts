import { Hono } from 'hono';
import { z } from 'zod';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import os from 'os';
import { execSync } from 'child_process';
import { timingSafeEqual } from 'crypto';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { and, count, desc, eq, gte, lte, ilike, or, sql } from 'drizzle-orm';
import { db } from '../db/client';
import {
    bookings,
    sports,
    leagues,
    stadiums,
    matches,
    menuCategories,
    teams,
    users,
    venueAttributes,
    venueCustomEvents,
    venueEvents,
    venues,
} from '../db/schema';
import { apiError, apiResponse, generateUniqueSlug, paginationMeta, paginationOffset } from '../lib/utils';
import { hashPassword } from '../lib/auth';
import { authRateLimit } from '../middleware';

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

const createTeamSchema = z.object({
    leagueId: z.string().uuid().nullable().optional(),
    name: z.string().min(2).max(150),
    shortName: z.string().max(30).nullable().optional(),
    crestUrl: z.string().url().nullable().optional(),
    externalId: z.string().max(20).nullable().optional(),
    isActive: z.boolean().default(true),
});

const updateTeamSchema = z.object({
    leagueId: z.string().uuid().nullable().optional(),
    name: z.string().min(2).max(150).optional(),
    shortName: z.string().max(30).nullable().optional(),
    crestUrl: z.string().url().nullable().optional(),
    externalId: z.string().max(20).nullable().optional(),
    isActive: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });

const stadiumSearchQuerySchema = z.object({
    search: z.string().trim().default(''),
    limit: z.coerce.number().int().min(1).max(50).default(12),
});

const createStadiumSchema = z.object({
    name: z.string().min(2).max(200),
    city: z.string().max(100).optional(),
    country: z.string().max(100).optional(),
    externalId: z.string().max(50).optional(),
});

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
    coverImageUrl: z.string().url().optional(),
    coverImageS3Key: z.string().max(500).optional(),
    galleryImageUrls: galleryUrlArraySchema.optional(),
    galleryS3Keys: galleryKeyArraySchema.optional(),
    amenities: venueArraySchema.default([]),
    vibes: venueArraySchema.default([]),
    cuisineTags: venueArraySchema.default([]),
    priceRange: z.enum(['BUDGET', 'MID', 'UPSCALE', 'LUXURY']).default('MID'),
    capacity: z.coerce.number().int().positive().optional(),
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
}).refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });

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
    if (!value.homeTeamId && !value.homeTeamName?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Home team is required', path: ['homeTeamName'] });
    }
    if (!value.awayTeamId && !value.awayTeamName?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Away team is required', path: ['awayTeamName'] });
    }
    if (value.homeTeamId && value.awayTeamId && value.homeTeamId === value.awayTeamId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Home and away teams must be different', path: ['awayTeamId'] });
    }
});

const updateMatchSchema = z.object({
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
    }).from(teams).where(and(eq(teams.id, teamId), eq(teams.isActive, true))).limit(1);
    return team ?? null;
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
    const homeTeamId = input.homeTeamId === undefined ? undefined : (input.homeTeamId || null);
    const awayTeamId = input.awayTeamId === undefined ? undefined : (input.awayTeamId || null);
    const stadiumId = input.stadiumId === undefined ? undefined : (input.stadiumId || null);

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

    const stadium = stadiumId ? await getStadiumById(stadiumId) : null;
    if (stadiumId && !stadium) {
        return { error: apiError('NOT_FOUND', 'Stadium not found'), status: 404 as const };
    }

    const homeTeamName = homeTeam?.name ?? input.homeTeamName?.trim();
    const awayTeamName = awayTeam?.name ?? input.awayTeamName?.trim();
    const venueName = stadium?.name ?? (input.venueName === null ? null : input.venueName?.trim() || undefined);

    if (homeTeamName && awayTeamName && homeTeamName.localeCompare(awayTeamName, undefined, { sensitivity: 'accent' }) === 0) {
        return { error: apiError('VALIDATION_ERROR', 'Home and away teams must be different'), status: 400 as const };
    }

    return {
        values: {
            leagueId: input.leagueId === undefined ? undefined : (input.leagueId || null),
            homeTeamId,
            awayTeamId,
            stadiumId,
            homeTeamName,
            awayTeamName,
            homeTeamCrestUrl: homeTeam?.crestUrl ?? (input.homeTeamCrestUrl !== undefined ? input.homeTeamCrestUrl : input.homeTeamId !== undefined || input.homeTeamName !== undefined ? null : undefined),
            awayTeamCrestUrl: awayTeam?.crestUrl ?? (input.awayTeamCrestUrl !== undefined ? input.awayTeamCrestUrl : input.awayTeamId !== undefined || input.awayTeamName !== undefined ? null : undefined),
            matchDateUtc: input.matchDateUtc ? new Date(input.matchDateUtc) : undefined,
            status: input.status,
            matchDay: input.matchDay === undefined ? undefined : (input.matchDay || null),
            stage: input.stage === undefined ? undefined : (input.stage || null),
            venueName,
            externalMatchId: input.externalMatchId === undefined ? undefined : (input.externalMatchId || null),
        },
    };
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

function mapVenueRow(row: {
    id: string;
    ownerId: string;
    ownerEmail?: string | null;
    ownerName?: string | null;
    name: string;
    slug: string;
    description?: string | null;
    shortDescription?: string | null;
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
    capacity?: number | null;
    amenities: string[];
    vibes: string[];
    cuisineTags: string[];
    priceRange?: string | null;
    isVerified: boolean;
    isActive: boolean;
    isFeatured: boolean;
    createdAt: Date;
    updatedAt?: Date;
    metadata?: unknown;
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
    const [venueRows, matchRows, leagueRows, sportRows, teamRows, stadiumRows, ownerRows, attributeRows] = await Promise.all([
        db.select({
            id: venues.id,
            name: venues.name,
            city: venues.city,
            ownerId: venues.ownerId,
        }).from(venues).where(eq(venues.isActive, true)).orderBy(desc(venues.createdAt)).limit(300),
        db.select({
            id: matches.id,
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
        const [rows, [totalResult]] = await Promise.all([
            db.select({
                id: teams.id,
                leagueId: teams.leagueId,
                leagueName: leagues.name,
                name: teams.name,
                shortName: teams.shortName,
                crestUrl: teams.crestUrl,
                externalId: teams.externalId,
                isActive: teams.isActive,
                createdAt: teams.createdAt,
            }).from(teams)
                .leftJoin(leagues, eq(teams.leagueId, leagues.id))
                .where(queryWhere)
                .orderBy(teams.name)
                .limit(parsed.data.limit)
                .offset(offset),
            db.select({ count: count() }).from(teams).where(queryWhere),
        ]);

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

    const [created] = await db.insert(teams).values({
        leagueId: parsed.data.leagueId || null,
        name: trimmedName,
        shortName: parsed.data.shortName?.trim() || null,
        crestUrl: parsed.data.crestUrl?.trim() || null,
        externalId: parsed.data.externalId?.trim() || null,
        isActive: parsed.data.isActive,
    }).returning({
        id: teams.id,
        leagueId: teams.leagueId,
        name: teams.name,
        shortName: teams.shortName,
        crestUrl: teams.crestUrl,
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

    const [existing] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, teamId)).limit(1);
    if (!existing) return c.json(apiError('NOT_FOUND', 'Team not found'), 404);

    if (parsed.data.leagueId) {
        const [league] = await db.select({ id: leagues.id }).from(leagues)
            .where(and(eq(leagues.id, parsed.data.leagueId), eq(leagues.isActive, true)))
            .limit(1);
        if (!league) return c.json(apiError('NOT_FOUND', 'League not found'), 404);
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.leagueId !== undefined) updates.leagueId = parsed.data.leagueId || null;
    if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
    if (parsed.data.shortName !== undefined) updates.shortName = parsed.data.shortName?.trim() || null;
    if (parsed.data.crestUrl !== undefined) updates.crestUrl = parsed.data.crestUrl?.trim() || null;
    if (parsed.data.externalId !== undefined) updates.externalId = parsed.data.externalId?.trim() || null;
    if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

    await db.update(teams).set(updates).where(eq(teams.id, teamId));
    return c.json(apiResponse({ message: 'Team updated' }));
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
    const where = search
        ? and(
            eq(stadiums.isActive, true),
            or(
                ilike(stadiums.name, `%${search}%`),
                ilike(stadiums.city, `%${search}%`),
                ilike(stadiums.country, `%${search}%`),
            )!,
        )
        : eq(stadiums.isActive, true);

    const rows = await db.select({
        id: stadiums.id,
        name: stadiums.name,
        city: stadiums.city,
        country: stadiums.country,
    }).from(stadiums).where(where).orderBy(stadiums.name).limit(parsed.data.limit);

    return c.json(apiResponse(rows));
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
        city: trimmedCity,
        country: trimmedCountry,
        externalId: parsed.data.externalId?.trim() || null,
        isActive: true,
    }).returning({
        id: stadiums.id,
        name: stadiums.name,
        city: stadiums.city,
        country: stadiums.country,
    });

    return c.json(apiResponse(created), 201);
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
            name: leagues.name,
            shortName: leagues.shortName,
            logoUrl: leagues.logoUrl,
            externalId: leagues.externalId,
            country: leagues.country,
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

    const [created] = await db.insert(leagues).values({
        sportId: parsed.data.sportId,
        name: parsed.data.name.trim(),
        shortName: parsed.data.shortName?.trim() || null,
        logoUrl: parsed.data.logoUrl || null,
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

    const [existingLeague] = await db.select({ id: leagues.id }).from(leagues).where(eq(leagues.id, leagueId)).limit(1);
    if (!existingLeague) return c.json(apiError('NOT_FOUND', 'League not found'), 404);

    if (parsed.data.sportId) {
        const [sport] = await db.select({ id: sports.id }).from(sports).where(and(eq(sports.id, parsed.data.sportId), eq(sports.isActive, true))).limit(1);
        if (!sport) return c.json(apiError('NOT_FOUND', 'Sport not found'), 404);
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.sportId !== undefined) updates.sportId = parsed.data.sportId;
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.shortName !== undefined) updates.shortName = parsed.data.shortName;
    if (parsed.data.logoUrl !== undefined) updates.logoUrl = parsed.data.logoUrl;
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
            shortDescription: venues.shortDescription,
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
            capacity: venues.capacity,
            amenities: venues.amenities,
            vibes: venues.vibes,
            cuisineTags: venues.cuisineTags,
            priceRange: venues.priceRange,
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

    const [created] = await db.insert(venues).values({
        ownerId: owner.id,
        name: parsed.data.name.trim(),
        slug: parsed.data.slug?.trim() || generateUniqueSlug(parsed.data.name),
        description: parsed.data.description?.trim() || null,
        shortDescription: parsed.data.shortDescription?.trim() || null,
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
        coverImageUrl: parsed.data.coverImageUrl || null,
        coverImageS3Key: parsed.data.coverImageS3Key?.trim() || null,
        galleryS3Keys: sanitizeGalleryKeys(parsed.data.galleryS3Keys),
        amenities: parsed.data.amenities,
        vibes: parsed.data.vibes,
        cuisineTags: parsed.data.cuisineTags,
        priceRange: parsed.data.priceRange,
        capacity: parsed.data.capacity || null,
        isVerified: parsed.data.isVerified,
        isActive: parsed.data.isActive,
        isFeatured: parsed.data.isFeatured,
        metadata: {
            galleryImageUrls: sanitizeGalleryUrls(parsed.data.galleryImageUrls),
        },
    }).returning({
        id: venues.id,
        slug: venues.slug,
        name: venues.name,
    });

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

    await db.update(venues).set(updates).where(eq(venues.id, venueId));
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
            ilike(leagues.name, `%${search}%`),
        )
        : undefined;

    const [rows, [totalResult]] = await Promise.all([
        db.select({
            id: matches.id,
            leagueId: matches.leagueId,
            leagueName: leagues.name,
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

    if (!normalized.values.homeTeamName || !normalized.values.awayTeamName || !normalized.values.matchDateUtc) {
        return c.json(apiError('VALIDATION_ERROR', 'Match requires teams and kickoff time'), 400);
    }

    const [created] = await db.insert(matches).values({
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

export default superAdminRoutes;
