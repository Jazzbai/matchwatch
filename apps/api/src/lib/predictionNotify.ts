/**
 * Post-draw notification dispatch.
 *
 * Called from the dashboard draw/redraw endpoint *after* the database
 * transaction commits — Resend failures must not roll back the draw, so we
 * deliberately do not inside the tx.
 *
 * In-app notification always inserted. Email sent via Resend if the entry's
 * email is real (not the phone_*@matchwatch.internal placeholder) AND
 * RESEND_API_KEY is configured. SMS is reserved for v2.
 */

import { Resend } from 'resend';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client';
import {
    matches,
    notifications,
    predictionCampaigns,
    predictionCampaignPrizes,
    predictionEntries,
    predictionWinners,
    venues,
} from '../db/schema';
import { logger } from './logger';
import { isTwilioConfigured, sendSms } from './sms';

function isPlaceholderEmail(email: string | null | undefined) {
    return !email || email.endsWith('@matchwatch.internal');
}

export async function notifyPrizeWinners(prizeId: string) {
    const rows = await db
        .select({
            winner: predictionWinners,
            entry: predictionEntries,
            prize: predictionCampaignPrizes,
            campaign: predictionCampaigns,
            venue: { id: venues.id, name: venues.name, slug: venues.slug },
            match: { id: matches.id, homeTeamName: matches.homeTeamName, awayTeamName: matches.awayTeamName },
        })
        .from(predictionWinners)
        .innerJoin(predictionEntries, eq(predictionWinners.entryId, predictionEntries.id))
        .innerJoin(predictionCampaignPrizes, eq(predictionWinners.prizeId, predictionCampaignPrizes.id))
        .innerJoin(predictionCampaigns, eq(predictionCampaignPrizes.campaignId, predictionCampaigns.id))
        .innerJoin(venues, eq(predictionCampaigns.venueId, venues.id))
        .innerJoin(matches, eq(predictionCampaigns.matchId, matches.id))
        .where(and(
            eq(predictionWinners.prizeId, prizeId),
            eq(predictionWinners.isInvalidated, false),
            isNull(predictionWinners.notifiedAt),
        ));

    if (rows.length === 0) return { notified: 0, emailed: 0, smsSent: 0 };

    const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
    const fromAddress = process.env.RESEND_FROM_EMAIL || 'MatchWatch <notifications@matchwatch.us>';
    const smsAvailable = isTwilioConfigured();

    let emailed = 0;
    let smsSent = 0;
    // Track which channels actually fired per winner so we record provenance.
    const channels: Map<string, string[]> = new Map();

    for (const row of rows) {
        const actionUrl = `/predict/${row.venue.slug}/${row.match.id}/winners`;
        const matchLabel = `${row.match.homeTeamName ?? 'TBD'} vs ${row.match.awayTeamName ?? 'TBD'}`;
        const fired: string[] = [];

        try {
            // Skip the in-app insert if an existing row already covers this
            // (user, entry) pair — otherwise a /renotify call would add a
            // duplicate "You won" bell entry every time it fires.
            const [existing] = await db.select({ id: notifications.id }).from(notifications)
                .where(and(
                    eq(notifications.userId, row.entry.userId),
                    eq(notifications.type, 'PREDICTION_WIN'),
                    sql`${notifications.data}->>'entryId' = ${row.entry.id}`,
                    sql`${notifications.data}->>'prizeId' = ${row.prize.id}`,
                ))
                .limit(1);
            if (!existing) {
                await db.insert(notifications).values({
                    userId: row.entry.userId,
                    type: 'PREDICTION_WIN',
                    title: `You won at ${row.venue.name}!`,
                    body: `You won "${row.prize.title}" in the ${matchLabel} prediction. Stop by ${row.venue.name} to claim your prize.`,
                    actionUrl,
                    imageUrl: row.prize.imageUrl ?? null,
                    data: {
                        campaignId: row.campaign.id,
                        prizeId: row.prize.id,
                        entryId: row.entry.id,
                    },
                });
            }
            fired.push('in_app');
        } catch (err) {
            logger.warn({ err, entryId: row.entry.id }, 'Failed to insert prediction win notification');
        }

        // Email if real email + Resend configured.
        if (resend && !isPlaceholderEmail(row.entry.email)) {
            try {
                await resend.emails.send({
                    from: fromAddress,
                    to: row.entry.email!,
                    subject: `You won at ${row.venue.name}!`,
                    html: `
                        <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
                            <h1 style="font-size: 22px; margin: 0 0 12px;">You won 🏆</h1>
                            <p style="font-size: 15px; color: #444; line-height: 1.5; margin: 0 0 16px;">
                                Hi ${row.entry.displayName},<br /><br />
                                You won <strong>${row.prize.title}</strong> in the
                                <em>${matchLabel}</em> prediction at <strong>${row.venue.name}</strong>!
                            </p>
                            ${row.prize.imageUrl ? `<img src="${row.prize.imageUrl}" alt="${row.prize.title}" style="max-width: 100%; border-radius: 8px; margin: 0 0 16px;" />` : ''}
                            <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 20px;">
                                Stop by ${row.venue.name} to claim your prize. Bring ID matching the name on
                                your entry. The official winners page is at
                                <a href="https://matchwatch.us${actionUrl}">matchwatch.us${actionUrl}</a>.
                            </p>
                            <p style="font-size: 12px; color: #888; margin: 32px 0 0;">
                                — The MatchWatch team
                            </p>
                        </div>
                    `,
                });
                emailed++;
                fired.push('email');
            } catch (err) {
                logger.warn({ err, entryId: row.entry.id }, 'Failed to send prediction win email');
            }
        }

        // SMS — always attempt if Twilio is configured (phone is always set).
        if (smsAvailable && row.entry.phone) {
            const smsBody = `🏆 You won at ${row.venue.name}! Prize: ${row.prize.title} (${matchLabel}). Claim it at the venue with ID. Full details: https://matchwatch.us${actionUrl}`;
            const result = await sendSms(row.entry.phone, smsBody);
            if (result.sent) {
                smsSent++;
                fired.push('sms');
            }
        }

        channels.set(row.winner.id, fired);
    }

    // Persist what actually fired per winner — comma-separated for simplicity
    // (the column is varchar(20) so cap channels at the first 3 to fit).
    for (const [winnerId, fired] of channels) {
        const channel = fired.slice(0, 3).join(',').slice(0, 20);
        await db.update(predictionWinners).set({
            notifiedAt: new Date(),
            notificationChannel: channel || 'none',
        }).where(eq(predictionWinners.id, winnerId));
    }

    return { notified: rows.length, emailed, smsSent };
}
