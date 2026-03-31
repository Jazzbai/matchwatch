import 'dotenv/config';

import { and, asc, eq, isNotNull } from 'drizzle-orm';
import { db } from '../db/client';
import { venues } from '../db/schema';
import { isGoogleSyncStale, refreshVenueFromGoogle } from '../lib/googleVenueSync';

async function main() {
    const rows = await db.select({
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
        approvalStatus: venues.approvalStatus,
        isActive: venues.isActive,
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
        amenities: venues.amenities,
    })
        .from(venues)
        .where(and(
            eq(venues.isActive, true),
            eq(venues.approvalStatus, 'APPROVED'),
            isNotNull(venues.googlePlaceId),
        ))
        .orderBy(asc(venues.name));

    const summary = {
        total: rows.length,
        stale: 0,
        synced: 0,
        skipped: 0,
        failed: 0,
    };

    for (const venue of rows) {
        if (!isGoogleSyncStale(venue.googleLastSyncedAt)) {
            summary.skipped += 1;
            continue;
        }
        summary.stale += 1;

        try {
            await refreshVenueFromGoogle(venue);
            summary.synced += 1;
            console.log(`synced ${venue.name}`);
        } catch (error) {
            summary.failed += 1;
            const message = error instanceof Error ? error.message : 'Unknown Google sync error';
            await db.update(venues).set({
                googleLastSyncedAt: new Date(),
                googleSyncStatus: 'ERROR',
                googleSyncError: message,
                updatedAt: new Date(),
            }).where(eq(venues.id, venue.id));
            console.error(`failed ${venue.name}: ${message}`);
        }
    }

    console.log(JSON.stringify(summary, null, 2));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
    });
