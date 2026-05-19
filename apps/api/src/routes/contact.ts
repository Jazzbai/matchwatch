import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/client';
import { contactMessages } from '../db/schema';

const router = new Hono();

const contactSchema = z.object({
    name: z.string().min(1).max(120),
    email: z.string().email().max(255),
    topic: z.string().min(1).max(60),
    message: z.string().min(1).max(5000),
});

router.post('/', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body) return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON' } }, 400);

    const parsed = contactSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid fields',
                details: parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
            },
        }, 400);
    }

    const { name, email, topic, message } = parsed.data;

    await db.insert(contactMessages).values({ name, email, topic, message });

    console.log(`[CONTACT] New message from ${name} (${email}) — topic: ${topic}`);

    return c.json({ success: true, data: { message: 'Message received. We will get back to you soon.' } });
});

export default router;
