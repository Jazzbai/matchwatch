import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { db } from './client';
import {
    auditLogs,
    bookings,
    follows,
    leagues,
    matches,
    menuCategories,
    menuItems,
    notifications,
    posts,
    promotions,
    refreshTokenSessions,
    reviews,
    sports,
    syncHistory,
    teams,
    userTeamInterests,
    users,
    venueClaims,
    venueCustomEvents,
    venueEvents,
    venues,
    waitlist,
} from './schema';
import { hashPassword } from '../lib/auth';

function getSourceDatabaseUrl() {
    const value = process.env.SOURCE_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
    if (!value) {
        throw new Error('SOURCE_DATABASE_URL (or DATABASE_URL) is required');
    }
    return value;
}

function venueName(index: number) {
    return `Business Venue ${index + 1}`;
}

function venueSlug(index: number, id: string) {
    return `business-venue-${index + 1}-${id.slice(0, 6).toLowerCase()}`;
}

function anonEmail(index: number, role: string) {
    if (role === 'SUPER_ADMIN') return `super-admin-${index + 1}@example.local`;
    if (role === 'ADMIN') return `admin-${index + 1}@example.local`;
    if (role === 'BUSINESS' || role === 'VENUE_OWNER') return `business-${index + 1}@example.local`;
    return `fan-${index + 1}@example.local`;
}

function anonName(index: number, role: string) {
    if (role === 'SUPER_ADMIN') return `Super Admin ${index + 1}`;
    if (role === 'ADMIN') return `Admin ${index + 1}`;
    if (role === 'BUSINESS' || role === 'VENUE_OWNER') return `Business User ${index + 1}`;
    return `Fan User ${index + 1}`;
}

async function run() {
    const sourceDatabaseUrl = getSourceDatabaseUrl();
    const sourceClient = postgres(sourceDatabaseUrl, {
        max: 1,
        prepare: false,
    });
    const sourceDb = drizzle(sourceClient);
    const defaultPasswordHash = await hashPassword(process.env.ANON_LOCAL_PASSWORD || 'Demo@12345');

    console.log('Loading source rows...');
    const [
        sourceSports,
        sourceLeagues,
        sourceTeams,
        sourceMatches,
        sourceUsers,
        sourceVenues,
        sourceVenueEvents,
        sourceVenueCustomEvents,
        sourceMenuCategories,
        sourceMenuItems,
        sourcePosts,
        sourceBookings,
    ] = await Promise.all([
        sourceDb.select().from(sports),
        sourceDb.select().from(leagues),
        sourceDb.select().from(teams),
        sourceDb.select().from(matches),
        sourceDb.select().from(users),
        sourceDb.select().from(venues),
        sourceDb.select().from(venueEvents),
        sourceDb.select().from(venueCustomEvents),
        sourceDb.select().from(menuCategories),
        sourceDb.select().from(menuItems),
        sourceDb.select().from(posts),
        sourceDb.select().from(bookings),
    ]);

    const anonymizedUsers = sourceUsers.map((row, index) => ({
        ...row,
        email: anonEmail(index, row.role),
        name: anonName(index, row.role),
        passwordHash: defaultPasswordHash,
        avatarUrl: null,
        avatarS3Key: null,
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
        pushToken: null,
        suspensionReason: null,
        lastLoginIp: null,
    }));

    const anonymizedVenues = sourceVenues.map((row, index) => ({
        ...row,
        name: venueName(index),
        slug: venueSlug(index, row.id),
        description: row.description ? `Anonymized venue profile ${index + 1}` : null,
        shortDescription: row.shortDescription ? `Anonymized sports venue ${index + 1}` : null,
        addressLine1: `10${index % 10}${index % 10} Sample Street`,
        addressLine2: null,
        phone: `+1-555-${String(1000 + index).slice(-4)}`,
        website: null,
        instagramHandle: null,
        googleMapsUrl: null,
        metadata: {
            ...(row.metadata && typeof row.metadata === 'object' ? row.metadata : {}),
            anonymized: true,
        },
    }));

    const anonymizedPosts = sourcePosts.map((row, index) => ({
        ...row,
        content: `Anonymized venue post #${index + 1}`,
        imageUrls: [],
        imageS3Keys: [],
    }));

    const anonymizedBookings = sourceBookings.map((row) => ({
        ...row,
        specialRequests: null,
        cancellationReason: null,
    }));

    console.log('Resetting target tables...');
    await db.transaction(async (tx) => {
        await tx.delete(waitlist);
        await tx.delete(bookings);
        await tx.delete(reviews);
        await tx.delete(follows);
        await tx.delete(notifications);
        await tx.delete(posts);
        await tx.delete(menuItems);
        await tx.delete(menuCategories);
        await tx.delete(promotions);
        await tx.delete(venueClaims);
        await tx.delete(venueCustomEvents);
        await tx.delete(venueEvents);
        await tx.delete(syncHistory);
        await tx.delete(auditLogs);
        await tx.delete(venues);
        await tx.delete(matches);
        await tx.delete(teams);
        await tx.delete(leagues);
        await tx.delete(sports);
        await tx.delete(refreshTokenSessions);
        await tx.delete(userTeamInterests);
        await tx.delete(users);
    });

    console.log('Inserting anonymized rows...');
    await db.transaction(async (tx) => {
        if (sourceSports.length) await tx.insert(sports).values(sourceSports);
        if (sourceLeagues.length) await tx.insert(leagues).values(sourceLeagues);
        if (sourceTeams.length) await tx.insert(teams).values(sourceTeams);
        if (sourceUsers.length) await tx.insert(users).values(anonymizedUsers);
        if (sourceMatches.length) await tx.insert(matches).values(sourceMatches);
        if (sourceVenues.length) await tx.insert(venues).values(anonymizedVenues);
        if (sourceVenueEvents.length) await tx.insert(venueEvents).values(sourceVenueEvents);
        if (sourceVenueCustomEvents.length) await tx.insert(venueCustomEvents).values(sourceVenueCustomEvents);
        if (sourceMenuCategories.length) await tx.insert(menuCategories).values(sourceMenuCategories);
        if (sourceMenuItems.length) await tx.insert(menuItems).values(sourceMenuItems);
        if (sourcePosts.length) await tx.insert(posts).values(anonymizedPosts);
        if (sourceBookings.length) await tx.insert(bookings).values(anonymizedBookings);
    });

    await sourceClient.end({ timeout: 5 });

    console.log('Anonymized seed complete.');
    console.log(`Users: ${anonymizedUsers.length}`);
    console.log(`Venues: ${anonymizedVenues.length}`);
    console.log(`Matches: ${sourceMatches.length}`);
    console.log(`Bookings: ${anonymizedBookings.length}`);
    console.log(`Local login password for all users: ${process.env.ANON_LOCAL_PASSWORD || 'Demo@12345'}`);
}

run().catch((err) => {
    console.error('Anonymized seed failed:', err);
    process.exit(1);
});
