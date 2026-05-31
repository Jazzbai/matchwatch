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
    prizeImageUrl: null as string | null,
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
router.get('/settings', async (c) => {
    const settings = await readMatchPointSettings();
    return c.json(apiResponse({
        prizeName: settings.prizeName,
        prizeDescription: settings.prizeDescription,
        prizeImageUrl: settings.prizeImageUrl,
        heroSubtitle: settings.heroSubtitle,
        isActive: settings.isActive,
    }));
});

export default router;
