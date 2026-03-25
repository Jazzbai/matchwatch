import 'dotenv/config';

import { and, asc, eq, isNotNull } from 'drizzle-orm';
import { db } from '../db/client';
import { venues } from '../db/schema';
import { buildGoogleVenueFields, applyGoogleMenuSnapshot } from '../lib/venueOnboarding';
import { getGooglePlaceDetails } from '../lib/googlePlaces';

async function main() {
    const rows = await db.select({
        id: venues.id,
        name: venues.name,
        googlePlaceId: venues.googlePlaceId,
        approvalStatus: venues.approvalStatus,
        isActive: venues.isActive,
        menuSource: venues.menuSource,
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
        synced: 0,
        failed: 0,
        menuUpdated: 0,
    };

    for (const venue of rows) {
        try {
            const snapshot = await getGooglePlaceDetails(String(venue.googlePlaceId));
            const googleFields = buildGoogleVenueFields(snapshot);

            await db.transaction(async (tx) => {
                await tx.update(venues).set({
                    googlePlaceId: googleFields.googlePlaceId,
                    googleSourceSnapshot: googleFields.googleSourceSnapshot,
                    googleLastSyncedAt: new Date(),
                    googleSyncStatus: 'SYNCED',
                    googleSyncError: null,
                    ratingOverride: googleFields.ratingOverride,
                    reviewCountOverride: googleFields.reviewCountOverride,
                    updatedAt: new Date(),
                }).where(eq(venues.id, venue.id));

                if (venue.menuSource !== 'MANUAL' && snapshot.menu) {
                    await applyGoogleMenuSnapshot(tx, venue.id, snapshot);
                    await tx.update(venues).set({
                        menuSource: 'GOOGLE',
                        updatedAt: new Date(),
                    }).where(eq(venues.id, venue.id));
                    summary.menuUpdated += 1;
                }
            });

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
