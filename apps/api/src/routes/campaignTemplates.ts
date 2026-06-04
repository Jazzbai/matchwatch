import { Hono } from 'hono';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { campaignTemplates } from '../db/schema';
import { apiResponse } from '../lib/utils';

const router = new Hono();

// Public: list all active campaign templates (jersey-party blueprints, etc.).
// Used by the venue-owner admin tab and could power public preview cards.
router.get('/', async (c) => {
    const categoryFilter = c.req.query('category')?.trim();

    const whereClauses = [eq(campaignTemplates.isActive, true)];
    if (categoryFilter) {
        whereClauses.push(eq(campaignTemplates.category, categoryFilter));
    }

    const rows = await db
        .select()
        .from(campaignTemplates)
        .where(whereClauses.length === 1 ? whereClauses[0] : and(...whereClauses))
        .orderBy(asc(campaignTemplates.sortOrder), asc(campaignTemplates.title));

    return c.json(apiResponse(rows));
});

router.get('/:slug', async (c) => {
    const slug = c.req.param('slug');
    const [row] = await db
        .select()
        .from(campaignTemplates)
        .where(and(eq(campaignTemplates.slug, slug), eq(campaignTemplates.isActive, true)))
        .limit(1);
    if (!row) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Campaign template not found' } }, 404);
    }
    return c.json(apiResponse(row));
});

export default router;
