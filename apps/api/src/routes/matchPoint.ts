import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { matchPointSettings } from '../db/schema';
import { apiResponse } from '../lib/utils';

const router = new Hono();

const DEFAULT_SLUG = 'default';

const DEFAULTS = {
    prizeName: 'Mercedes-Benz C300',
    prizeDescription: 'Top point earners across the tournament enter a grand-prize sweepstakes to win a Mercedes-Benz C300.',
    prizeImageUrl: '/match-point/prize.jpg' as string | null,
    heroSubtitle: 'Scan the QR at a host venue, pick the winner, and call the exact score. Top scorers play for the Mercedes-Benz C300 grand prize.',
    isActive: true,
};

export async function readMatchPointSettings() {
    const [row] = await db
        .select()
        .from(matchPointSettings)
        .where(eq(matchPointSettings.slug, DEFAULT_SLUG))
        .limit(1);
    if (row) return row;
    // Migration may not be applied yet — return safe defaults so the public page doesn't break.
    return {
        id: null,
        slug: DEFAULT_SLUG,
        prizeName: DEFAULTS.prizeName,
        prizeDescription: DEFAULTS.prizeDescription,
        prizeImageUrl: DEFAULTS.prizeImageUrl,
        heroSubtitle: DEFAULTS.heroSubtitle,
        isActive: DEFAULTS.isActive,
        updatedAt: null,
    };
}

// Public: any visitor can fetch the live settings for the landing/QR pages.
// Nulls are coalesced to sensible defaults so the page never falls back to
// blank/broken state even if the admin hasn't set a value yet.
router.get('/settings', async (c) => {
    const settings = await readMatchPointSettings();
    return c.json(apiResponse({
        prizeName: settings.prizeName || DEFAULTS.prizeName,
        prizeDescription: settings.prizeDescription || DEFAULTS.prizeDescription,
        prizeImageUrl: settings.prizeImageUrl || DEFAULTS.prizeImageUrl,
        heroSubtitle: settings.heroSubtitle || DEFAULTS.heroSubtitle,
        isActive: settings.isActive,
    }));
});

export default router;
