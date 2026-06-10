/**
 * Twilio SMS sender — used for prediction-win notifications.
 *
 * Reads credentials from env at call time so a missing/rotated key doesn't
 * crash the API boot. Returns `{ sent: false, reason }` instead of throwing
 * so callers can degrade gracefully and we don't roll back a draw on a
 * Twilio outage.
 *
 * Uses Twilio's REST API directly (no SDK dependency) — same pattern as
 * the existing phoneAuth.ts uses for Telnyx.
 *
 * Env vars:
 *   TWILIO_ACCOUNT_SID       — Account SID from https://console.twilio.com
 *   TWILIO_AUTH_TOKEN        — Auth token (same page)
 *   TWILIO_FROM_NUMBER       — A purchased Twilio number in E.164 (+18005551234)
 *                              OR omit and set TWILIO_MESSAGING_SERVICE_SID
 *   TWILIO_MESSAGING_SERVICE_SID  — preferred for production; uses a sender pool
 */

import { logger } from './logger';

export type SmsResult = { sent: true; sid: string } | { sent: false; reason: string };

export function isTwilioConfigured() {
    return Boolean(
        process.env.TWILIO_ACCOUNT_SID
        && process.env.TWILIO_AUTH_TOKEN
        && (process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID),
    );
}

export async function sendSms(toPhoneE164: string, body: string): Promise<SmsResult> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
    const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim();
    const messagingService = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();

    if (!accountSid || !authToken) {
        return { sent: false, reason: 'Twilio not configured (missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)' };
    }
    if (!fromNumber && !messagingService) {
        return { sent: false, reason: 'Twilio not configured (set TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID)' };
    }

    // E.164 sanity check.
    if (!/^\+\d{8,15}$/.test(toPhoneE164)) {
        return { sent: false, reason: `Invalid destination phone format: ${toPhoneE164}` };
    }

    const form = new URLSearchParams();
    form.set('To', toPhoneE164);
    form.set('Body', body.slice(0, 1600)); // Twilio hard limit, defensive trim.
    if (messagingService) {
        form.set('MessagingServiceSid', messagingService);
    } else {
        form.set('From', fromNumber!);
    }

    try {
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
            method: 'POST',
            headers: {
                Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: form.toString(),
        });

        if (!res.ok) {
            const text = await res.text().catch(() => '<no body>');
            logger.warn({ status: res.status, body: text.slice(0, 500) }, 'Twilio SMS send failed');
            return { sent: false, reason: `Twilio ${res.status}: ${text.slice(0, 200)}` };
        }

        const json = await res.json().catch(() => ({})) as { sid?: string };
        return { sent: true, sid: json.sid || 'unknown' };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn({ err: message }, 'Twilio SMS send threw');
        return { sent: false, reason: message };
    }
}
