import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/client';
import { sponsorInquiries } from '../db/schema';

const router = new Hono();

const inquirySchema = z.object({
    company: z.string().min(1).max(200),
    contactName: z.string().max(100).optional(),
    email: z.string().email().max(255),
    phone: z.string().max(30).optional(),
    website: z.string().url().max(500).optional().or(z.literal('')),
    tier: z.enum(['title', 'gold', 'venue', 'prize', 'watch_party_package']),
    message: z.string().max(5000).optional(),
});

router.post('/', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body) return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON' } }, 400);

    const parsed = inquirySchema.safeParse(body);
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

    const { company, contactName, email, phone, website, tier, message } = parsed.data;

    await db.insert(sponsorInquiries).values({
        company,
        contactName: contactName ?? null,
        email,
        phone: phone ?? null,
        website: website || null,
        tier,
        message: message ?? null,
    });

    console.log(`[SPONSOR] New inquiry from ${company} (${email}) — tier: ${tier}`);

    return c.json({ success: true, data: { message: 'Inquiry received. We will contact you within 24 hours.' } });
});

export default router;