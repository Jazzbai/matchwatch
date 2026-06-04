import { Hono } from 'hono';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { socialPostTemplates } from '../db/schema';
import { apiResponse } from '../lib/utils';

const router = new Hono();

// Public: list all active social-post templates (35 content-calendar items).
// Optional `?category=` filter (pre-tournament | match-day | themed | engagement | finals).
router.get('/', async (c) => {
    const categoryFilter = c.req.query('category')?.trim();

    const whereClauses = [eq(socialPostTemplates.isActive, true)];
    if (categoryFilter) {
        whereClauses.push(eq(socialPostTemplates.category, categoryFilter));
    }

    const rows = await db
        .select()
        .from(socialPostTemplates)
        .where(whereClauses.length === 1 ? whereClauses[0] : and(...whereClauses))
        .orderBy(asc(socialPostTemplates.sortOrder), asc(socialPostTemplates.title));

    return c.json(apiResponse(rows));
});

router.get('/:slug', async (c) => {
    const slug = c.req.param('slug');
    const [row] = await db
        .select()
        .from(socialPostTemplates)
        .where(and(eq(socialPostTemplates.slug, slug), eq(socialPostTemplates.isActive, true)))
        .limit(1);
    if (!row) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Social-post template not found' } }, 404);
    }
    return c.json(apiResponse(row));
});

export default router;
