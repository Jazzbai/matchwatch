import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { staticPages } from '../db/schema';
import { apiError, apiResponse } from '../lib/utils';

const pageRoutes = new Hono();

pageRoutes.get('/:slug', async (c) => {
    const slug = c.req.param('slug').trim().toLowerCase();
    const [page] = await db
        .select()
        .from(staticPages)
        .where(eq(staticPages.slug, slug))
        .limit(1);

    if (!page || page.status !== 'PUBLISHED') {
        return c.json(apiError('NOT_FOUND', 'Page not found'), 404);
    }

    return c.json(apiResponse(page));
});

export default pageRoutes;
