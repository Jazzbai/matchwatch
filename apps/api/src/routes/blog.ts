import { Hono } from 'hono';
import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';
import { and, asc, count, desc, eq, ilike, inArray, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { blogCategories, blogComments, blogPostCategories, blogPosts, users } from '../db/schema';
import { apiError, apiResponse, paginationMeta, paginationOffset } from '../lib/utils';
import { authMiddleware } from '../middleware';

const blogRoutes = new Hono();

const listPostsSchema = z.object({
    q: z.string().trim().optional(),
    category: z.string().trim().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
});

const commentBodySchema = z.object({
    content: z.string().trim().min(2).max(5000),
});

async function getCategoryMapByPostIds(postIds: string[]) {
    if (postIds.length === 0) return new Map<string, Array<{ id: string; name: string; slug: string }>>();

    const rows = await db.select({
        postId: blogPostCategories.postId,
        id: blogCategories.id,
        name: blogCategories.name,
        slug: blogCategories.slug,
    })
        .from(blogPostCategories)
        .innerJoin(blogCategories, eq(blogPostCategories.categoryId, blogCategories.id))
        .where(inArray(blogPostCategories.postId, postIds))
        .orderBy(asc(blogCategories.name));

    const map = new Map<string, Array<{ id: string; name: string; slug: string }>>();
    for (const row of rows) {
        if (!map.has(row.postId)) map.set(row.postId, []);
        map.get(row.postId)?.push({
            id: row.id,
            name: row.name,
            slug: row.slug,
        });
    }
    return map;
}

blogRoutes.get('/categories', async (c) => {
    const rows = await db.select({
        id: blogCategories.id,
        name: blogCategories.name,
        slug: blogCategories.slug,
        description: blogCategories.description,
        sortOrder: blogCategories.sortOrder,
    })
        .from(blogCategories)
        .where(eq(blogCategories.isActive, true))
        .orderBy(asc(blogCategories.sortOrder), asc(blogCategories.name));

    return c.json(apiResponse(rows));
});

blogRoutes.get('/posts', async (c) => {
    const parsed = listPostsSchema.safeParse(c.req.query());
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid blog query', parsed.error.issues), 400);
    }

    const { q, category, page, limit } = parsed.data;
    const offset = paginationOffset(page, limit);

    const whereParts = [eq(blogPosts.status, 'PUBLISHED')];
    if (q) {
        whereParts.push(sql`(${blogPosts.title} ILIKE ${`%${q}%`} OR ${blogPosts.excerpt} ILIKE ${`%${q}%`} OR ${blogPosts.contentHtml} ILIKE ${`%${q}%`})`);
    }
    if (category) {
        whereParts.push(sql`EXISTS (
            SELECT 1
            FROM ${blogPostCategories} bpc
            INNER JOIN ${blogCategories} bc ON bc.id = bpc.category_id
            WHERE bpc.post_id = ${blogPosts.id}
              AND (bc.slug = ${category} OR bc.id::text = ${category})
        )`);
    }

    const whereClause = and(...whereParts);

    const [rows, [totalResult]] = await Promise.all([
        db.select({
            id: blogPosts.id,
            slug: blogPosts.slug,
            title: blogPosts.title,
            excerpt: blogPosts.excerpt,
            featuredImageUrl: blogPosts.featuredImageUrl,
            publishedAt: blogPosts.publishedAt,
            createdAt: blogPosts.createdAt,
            authorName: users.name,
        })
            .from(blogPosts)
            .leftJoin(users, eq(blogPosts.authorId, users.id))
            .where(whereClause)
            .orderBy(desc(blogPosts.publishedAt), desc(blogPosts.createdAt))
            .limit(limit)
            .offset(offset),
        db.select({ count: count() }).from(blogPosts).where(whereClause),
    ]);

    const categoryMap = await getCategoryMapByPostIds(rows.map((row) => row.id));

    return c.json(apiResponse(rows.map((row) => ({
        ...row,
        categories: categoryMap.get(row.id) || [],
    })), paginationMeta(page, limit, Number(totalResult?.count || 0))));
});

blogRoutes.get('/posts/:slug', async (c) => {
    const slug = c.req.param('slug');
    const [row] = await db.select({
        post: blogPosts,
        authorName: users.name,
    })
        .from(blogPosts)
        .leftJoin(users, eq(blogPosts.authorId, users.id))
        .where(and(eq(blogPosts.slug, slug), eq(blogPosts.status, 'PUBLISHED')))
        .limit(1);

    if (!row) {
        return c.json(apiError('NOT_FOUND', 'Blog post not found'), 404);
    }

    const categoryMap = await getCategoryMapByPostIds([row.post.id]);
    return c.json(apiResponse({
        ...row.post,
        authorName: row.authorName,
        categories: categoryMap.get(row.post.id) || [],
    }));
});

blogRoutes.get('/posts/:postId/comments', async (c) => {
    const postId = c.req.param('postId');
    const rows = await db.select({
        id: blogComments.id,
        content: blogComments.content,
        createdAt: blogComments.createdAt,
        userId: blogComments.userId,
        userName: users.name,
        userAvatarUrl: users.avatarUrl,
    })
        .from(blogComments)
        .innerJoin(users, eq(blogComments.userId, users.id))
        .where(and(eq(blogComments.postId, postId), eq(blogComments.status, 'APPROVED')))
        .orderBy(desc(blogComments.createdAt));

    return c.json(apiResponse(rows));
});

blogRoutes.post('/posts/:postId/comments', authMiddleware, async (c) => {
    const postId = c.req.param('postId');
    const user = c.get('user');
    const body = await c.req.json().catch(() => ({}));
    const parsed = commentBodySchema.safeParse(body);
    if (!parsed.success) {
        return c.json(apiError('VALIDATION_ERROR', 'Invalid comment payload', parsed.error.issues), 400);
    }

    const [post] = await db.select({ id: blogPosts.id }).from(blogPosts)
        .where(and(eq(blogPosts.id, postId), eq(blogPosts.status, 'PUBLISHED')))
        .limit(1);
    if (!post) {
        return c.json(apiError('NOT_FOUND', 'Blog post not found'), 404);
    }

    const [created] = await db.insert(blogComments).values({
        postId,
        userId: user.id,
        content: DOMPurify.sanitize(parsed.data.content),
        status: 'PENDING',
    }).returning({
        id: blogComments.id,
        content: blogComments.content,
        status: blogComments.status,
        createdAt: blogComments.createdAt,
    });

    return c.json(apiResponse(created), 201);
});

export default blogRoutes;
