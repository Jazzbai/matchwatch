import { Hono } from 'hono';
import { db } from '../db/client';
import { bookings, venueEvents, venues, matches, users, notifications, auditLogs, waitlist, venuePackages } from '../db/schema';
import { eq, and, desc, count, sql, asc } from 'drizzle-orm';
import { apiResponse, apiError, generateBookingReference, paginationMeta, paginationOffset } from '../lib/utils';
import { createBookingSchema, bookingQuerySchema } from '@matchwatch/shared';
import { authMiddleware } from '../middleware';

const bookingRoutes = new Hono();

// All booking routes require auth
bookingRoutes.use('*', authMiddleware);

// ─── POST / ─────────────────────────────────────
bookingRoutes.post('/', async (c) => {
    const user = c.get('user');
    const body = await c.req.json();
    const parsed = createBookingSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), 400);
    }

    const { venueEventId, partySize, specialRequests } = parsed.data;
    // Optional party-package selection (parsed outside the shared schema)
    const requestedPackageId = typeof body?.packageId === 'string' && body.packageId.trim().length > 0
        ? body.packageId.trim()
        : null;

    // Get venue event with venue info
    const [event] = await db.select({
        event: venueEvents,
        venue: venues,
        match: matches,
    })
        .from(venueEvents)
        .innerJoin(venues, eq(venueEvents.venueId, venues.id))
        .innerJoin(matches, eq(venueEvents.matchId, matches.id))
        .where(and(
            eq(venueEvents.id, venueEventId),
            eq(venueEvents.isActive, true),
            eq(venues.isActive, true),
            eq(venues.approvalStatus, 'APPROVED'),
        ))
        .limit(1);

    if (!event) {
        return c.json(apiError('NOT_FOUND', 'Event not found or inactive'), 404);
    }

    // Validate optional party-package selection
    let resolvedPackageId: string | null = null;
    if (requestedPackageId) {
        const [pkg] = await db.select().from(venuePackages)
            .where(and(
                eq(venuePackages.id, requestedPackageId),
                eq(venuePackages.venueId, event.venue.id),
                eq(venuePackages.isActive, true),
            ))
            .limit(1);
        if (!pkg) {
            return c.json(apiError('NOT_FOUND', 'Selected package is not available at this venue'), 404);
        }
        if (pkg.maxPartySize && partySize > pkg.maxPartySize) {
            return c.json(apiError('VALIDATION_ERROR', `This package allows up to ${pkg.maxPartySize} guests`), 400);
        }
        resolvedPackageId = pkg.id;
    }

    // Check if match hasn't already started
    if (event.match.status === 'IN_PLAY' || event.match.status === 'FINISHED') {
        return c.json(apiError('FORBIDDEN', 'Cannot book for a match that has already started'), 403);
    }

    // Check booking limit
    if (event.event.bookingLimit) {
        const spotsRemaining = event.event.bookingLimit - event.event.confirmedBookingsCount;
        if (spotsRemaining <= 0) {
            // Add to waitlist instead
            const [maxPos] = await db.select({
                maxPosition: sql<number>`COALESCE(MAX(${waitlist.position}), 0)`,
            }).from(waitlist).where(eq(waitlist.venueEventId, venueEventId));

            const position = (maxPos?.maxPosition ?? 0) + 1;
            const expiresAt = new Date(event.match.matchDateUtc.getTime());

            await db.insert(waitlist).values({
                userId: user.id,
                venueEventId,
                partySize,
                position,
                expiresAt,
            });

            return c.json(apiResponse({
                waitlisted: true,
                position,
                message: `Event is full. You've been added to the waitlist at position ${position}.`,
            }), 202);
        }

        if (partySize > spotsRemaining) {
            return c.json(apiError('INSUFFICIENT_SPOTS', `Only ${spotsRemaining} spots remaining`), 400);
        }
    }

    // Check for duplicate booking
    const [existingBooking] = await db.select().from(bookings)
        .where(and(
            eq(bookings.userId, user.id),
            eq(bookings.venueEventId, venueEventId),
            sql`${bookings.status} NOT IN ('CANCELLED_BY_USER', 'CANCELLED_BY_VENUE')`,
        ))
        .limit(1);

    if (existingBooking) {
        return c.json(apiError('CONFLICT', 'You already have a booking for this event'), 409);
    }

    // Create booking
    const bookingReference = generateBookingReference();
    const status = event.event.requiresApproval ? 'PENDING' : 'CONFIRMED';

    const [booking] = await db.insert(bookings).values({
        bookingReference,
        userId: user.id,
        venueEventId,
        partySize,
        specialRequests,
        status,
        packageId: resolvedPackageId,
    }).returning();

    // Update confirmed count if confirmed
    if (status === 'CONFIRMED') {
        await db.update(venueEvents).set({
            confirmedBookingsCount: sql`${venueEvents.confirmedBookingsCount} + ${partySize}`,
            updatedAt: new Date(),
        }).where(eq(venueEvents.id, venueEventId));
    }

    // Create notification for user
    await db.insert(notifications).values({
        userId: user.id,
        type: 'BOOKING_CONFIRMED',
        title: `Booking ${status === 'CONFIRMED' ? 'Confirmed' : 'Pending'}`,
        body: `Your booking (${bookingReference}) for ${event.match.homeTeamName} vs ${event.match.awayTeamName} at ${event.venue.name} is ${status.toLowerCase()}.`,
        actionUrl: `/dashboard/bookings`,
        data: { bookingId: booking.id, venueId: event.venue.id, matchId: event.match.id },
    });

    // Audit log
    await db.insert(auditLogs).values({
        userId: user.id,
        action: 'BOOKING_CREATED',
        entityType: 'Booking',
        entityId: booking.id,
        metadata: { bookingReference, venueId: event.venue.id, partySize },
    });

    return c.json(apiResponse({
        ...booking,
        venue: { id: event.venue.id, name: event.venue.name, address: event.venue.addressLine1, city: event.venue.city },
        match: { homeTeamName: event.match.homeTeamName, awayTeamName: event.match.awayTeamName, matchDateUtc: event.match.matchDateUtc },
    }), 201);
});

// ─── GET / ──────────────────────────────────────
bookingRoutes.get('/', async (c) => {
    const user = c.get('user');
    const query = bookingQuerySchema.safeParse(c.req.query());
    if (!query.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid query', query.error.issues), 400);
    }

    const { status, page, limit } = query.data;
    const offset = paginationOffset(page, limit);

    let conditions: any[] = [eq(bookings.userId, user.id)];
    if (status) conditions.push(eq(bookings.status, status));

    const rows = await db.select({
        booking: bookings,
        event: venueEvents,
        venue: venues,
        match: matches,
    })
        .from(bookings)
        .innerJoin(venueEvents, eq(bookings.venueEventId, venueEvents.id))
        .innerJoin(venues, eq(venueEvents.venueId, venues.id))
        .innerJoin(matches, eq(venueEvents.matchId, matches.id))
        .where(and(...conditions, eq(venues.isActive, true), eq(venues.approvalStatus, 'APPROVED')))
        .orderBy(desc(bookings.createdAt))
        .limit(limit)
        .offset(offset);

    const [totalResult] = await db.select({ count: count() }).from(bookings).where(and(...conditions));

    return c.json(apiResponse(
        rows.map(r => ({
            ...r.booking,
            venue: { id: r.venue.id, name: r.venue.name, slug: r.venue.slug, address: r.venue.addressLine1, city: r.venue.city, coverImageUrl: r.venue.coverImageUrl },
            match: { id: r.match.id, homeTeamName: r.match.homeTeamName, awayTeamName: r.match.awayTeamName, matchDateUtc: r.match.matchDateUtc, status: r.match.status },
            event: { id: r.event.id, customPrice: r.event.customPrice, doorsOpenAt: r.event.doorsOpenAt },
        })),
        paginationMeta(page, limit, Number(totalResult?.count ?? 0)),
    ));
});

// ─── GET /:bookingId ────────────────────────────
bookingRoutes.get('/:bookingId', async (c) => {
    const user = c.get('user');
    const bookingId = c.req.param('bookingId');

    const [row] = await db.select({
        booking: bookings,
        event: venueEvents,
        venue: venues,
        match: matches,
    })
        .from(bookings)
        .innerJoin(venueEvents, eq(bookings.venueEventId, venueEvents.id))
        .innerJoin(venues, eq(venueEvents.venueId, venues.id))
        .innerJoin(matches, eq(venueEvents.matchId, matches.id))
        .where(and(eq(bookings.id, bookingId), eq(bookings.userId, user.id), eq(venues.isActive, true), eq(venues.approvalStatus, 'APPROVED')))
        .limit(1);

    if (!row) {
        return c.json(apiError('NOT_FOUND', 'Booking not found'), 404);
    }

    return c.json(apiResponse({
        ...row.booking,
        venue: row.venue,
        match: row.match,
        event: row.event,
    }));
});

// ─── DELETE /:bookingId ─────────────────────────
bookingRoutes.delete('/:bookingId', async (c) => {
    const user = c.get('user');
    const bookingId = c.req.param('bookingId');

    const [row] = await db.select({
        booking: bookings,
        event: venueEvents,
        match: matches,
    })
        .from(bookings)
        .innerJoin(venueEvents, eq(bookings.venueEventId, venueEvents.id))
        .innerJoin(matches, eq(venueEvents.matchId, matches.id))
        .where(and(eq(bookings.id, bookingId), eq(bookings.userId, user.id)))
        .limit(1);

    if (!row) {
        return c.json(apiError('NOT_FOUND', 'Booking not found'), 404);
    }

    if (row.booking.status === 'CANCELLED_BY_USER' || row.booking.status === 'CANCELLED_BY_VENUE') {
        return c.json(apiError('CONFLICT', 'Booking is already cancelled'), 409);
    }

    // Check if match hasn't started (2 hours before minimum)
    const twoHoursBefore = new Date(row.match.matchDateUtc.getTime() - 2 * 60 * 60 * 1000);
    if (new Date() > twoHoursBefore) {
        return c.json(apiError('FORBIDDEN', 'Cannot cancel booking less than 2 hours before the match'), 403);
    }

    // Cancel booking
    await db.update(bookings).set({
        status: 'CANCELLED_BY_USER',
        cancelledAt: new Date(),
        cancelledBy: user.id,
        updatedAt: new Date(),
    }).where(eq(bookings.id, bookingId));

    // Decrement confirmed count
    if (row.booking.status === 'CONFIRMED') {
        await db.update(venueEvents).set({
            confirmedBookingsCount: sql`GREATEST(${venueEvents.confirmedBookingsCount} - ${row.booking.partySize}, 0)`,
            updatedAt: new Date(),
        }).where(eq(venueEvents.id, row.event.id));
    }

    // Check waitlist and notify next person
    const [nextWaitlisted] = await db.select().from(waitlist)
        .where(and(
            eq(waitlist.venueEventId, row.event.id),
            sql`${waitlist.notifiedAt} IS NULL`,
        ))
        .orderBy(asc(waitlist.position))
        .limit(1);

    if (nextWaitlisted) {
        await db.insert(notifications).values({
            userId: nextWaitlisted.userId,
            type: 'BOOKING_CONFIRMED',
            title: 'Spot Available!',
            body: `A spot has opened up for ${row.match.homeTeamName} vs ${row.match.awayTeamName}. Book now before it's gone!`,
            actionUrl: `/venues/${row.event.venueId}`,
        });

        await db.update(waitlist).set({
            notifiedAt: new Date(),
        }).where(eq(waitlist.id, nextWaitlisted.id));
    }

    await db.insert(auditLogs).values({
        userId: user.id,
        action: 'BOOKING_CANCELLED',
        entityType: 'Booking',
        entityId: bookingId,
    });

    return c.json(apiResponse({ message: 'Booking cancelled successfully' }));
});

export default bookingRoutes;
