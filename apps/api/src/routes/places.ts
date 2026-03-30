import { Hono } from 'hono';
import { z } from 'zod';
import { apiError, apiResponse } from '../lib/utils';
import { getGooglePlaceDetails, hasGooglePlacesConfigured, searchGooglePlaces } from '../lib/googlePlaces';
import { buildVenueGoogleDefaults, findExistingVenueMatch } from '../lib/venueOnboarding';

const placeRoutes = new Hono();

const searchPlacesSchema = z.object({
    q: z.string().trim().min(2).max(200),
});

const placeDetailsSchema = z.object({
    placeId: z.string().trim().min(3).max(255),
});

placeRoutes.get('/search', async (c) => {
    if (!hasGooglePlacesConfigured()) {
        return c.json(apiError('SERVICE_UNAVAILABLE', 'Google Places integration is not configured'), 503);
    }

    const parsed = searchPlacesSchema.safeParse(c.req.query());
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid query', parsed.error.issues), 400);
    }

    try {
        const rows = await searchGooglePlaces(parsed.data.q);
        const results = await Promise.all(rows.map(async (row) => {
            const existingVenue = await findExistingVenueMatch({
                googlePlaceId: row.placeId,
                name: row.displayName,
                city: row.city,
            });

            return {
                placeId: row.placeId,
                googlePlaceId: row.placeId,
                name: row.displayName,
                displayName: row.displayName,
                formattedAddress: row.formattedAddress,
                city: row.city,
                country: row.country,
                rating: row.rating,
                reviewCount: row.reviewCount,
                existingVenue: existingVenue ? {
                    id: existingVenue.id,
                    name: existingVenue.name,
                    slug: existingVenue.slug,
                    city: existingVenue.city,
                    approvalStatus: existingVenue.approvalStatus,
                } : null,
            };
        }));

        return c.json(apiResponse(results));
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Google Places search failed';
        return c.json(apiError('SERVICE_UNAVAILABLE', message), 503);
    }
});

placeRoutes.get('/details', async (c) => {
    if (!hasGooglePlacesConfigured()) {
        return c.json(apiError('SERVICE_UNAVAILABLE', 'Google Places integration is not configured'), 503);
    }

    const parsed = placeDetailsSchema.safeParse(c.req.query());
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid query', parsed.error.issues), 400);
    }

    try {
        const snapshot = await getGooglePlaceDetails(parsed.data.placeId);
        const existingVenue = await findExistingVenueMatch({
            googlePlaceId: snapshot.placeId,
            name: snapshot.displayName,
            addressLine1: snapshot.addressLine1,
            city: snapshot.city,
        });

        return c.json(apiResponse({
            googlePlaceId: snapshot.placeId,
            snapshot,
            defaults: buildVenueGoogleDefaults(snapshot, {
                slugOrId: existingVenue?.slug || existingVenue?.id,
            }),
            existingVenue: existingVenue ? {
                id: existingVenue.id,
                name: existingVenue.name,
                slug: existingVenue.slug,
                city: existingVenue.city,
                approvalStatus: existingVenue.approvalStatus,
            } : null,
        }));
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Google Place details lookup failed';
        return c.json(apiError('SERVICE_UNAVAILABLE', message), 503);
    }
});

export default placeRoutes;
