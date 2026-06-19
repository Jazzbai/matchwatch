import { Hono } from 'hono';
import { z } from 'zod';
import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { db } from '../db/client';
import { contactMessages } from '../db/schema';

const router = new Hono();

const NOTIFICATION_EMAILS = [
    'matchwatchfifa@gmail.com',
    'hgh@jazzb.com',
    'ab@jazzb.com',
];

const contactSchema = z.object({
    name: z.string().min(1).max(120),
    email: z.string().email().max(255),
    topic: z.string().min(1).max(200).default('General Inquiry'),
    message: z.string().min(1).max(5000),
    phone: z.string().max(30).optional(),
});

function buildHtml(name: string, email: string, topic: string, message: string, phone?: string) {
    return `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#0a0b0d;color:#f1ece4;">
            <h2 style="color:#f1ece4;margin:0 0 20px;font-size:20px;">New Inquiry — MatchWatch</h2>
            <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:8px 0;color:#a8a59d;width:120px;">Name</td><td style="padding:8px 0;color:#f1ece4;font-weight:600;">${name}</td></tr>
                <tr><td style="padding:8px 0;color:#a8a59d;">Email</td><td style="padding:8px 0;color:#f1ece4;"><a href="mailto:${email}" style="color:#e07c3a;">${email}</a></td></tr>
                ${phone ? `<tr><td style="padding:8px 0;color:#a8a59d;">Phone</td><td style="padding:8px 0;color:#f1ece4;">${phone}</td></tr>` : ''}
                <tr><td style="padding:8px 0;color:#a8a59d;">Topic</td><td style="padding:8px 0;color:#f1ece4;font-weight:600;">${topic}</td></tr>
            </table>
            <hr style="border:none;border-top:1px solid #23272f;margin:20px 0;" />
            <p style="color:#a8a59d;font-size:13px;margin:0 0 8px;">Message:</p>
            <p style="color:#f1ece4;white-space:pre-wrap;margin:0;line-height:1.6;">${message.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
            <hr style="border:none;border-top:1px solid #23272f;margin:20px 0;" />
            <p style="color:#6c6a64;font-size:11px;margin:0;">MatchWatch · matchwatch.us</p>
        </div>
    `;
}

async function sendViaResend(name: string, email: string, topic: string, message: string, phone?: string) {
    const resend = new Resend(process.env.RESEND_API_KEY!);
    const from = process.env.EMAIL_FROM || 'noreply@matchwatch.us';
    await resend.emails.send({
        from,
        to: NOTIFICATION_EMAILS,
        replyTo: email,
        subject: `New Inquiry: ${topic} — from ${name}`,
        html: buildHtml(name, email, topic, message, phone),
    });
}

async function sendViaSmtp(name: string, email: string, topic: string, message: string, phone?: string) {
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT || 587),
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
    await transporter.sendMail({
        from: `MatchWatch <${process.env.SMTP_USER}>`,
        to: NOTIFICATION_EMAILS.join(', '),
        replyTo: email,
        subject: `New Inquiry: ${topic} — from ${name}`,
        html: buildHtml(name, email, topic, message, phone),
    });
}

async function sendNotificationEmails(name: string, email: string, topic: string, message: string, phone?: string) {
    if (process.env.RESEND_API_KEY) {
        await sendViaResend(name, email, topic, message, phone).catch((err: unknown) => console.error('[CONTACT] Resend failed:', err));
    } else if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        await sendViaSmtp(name, email, topic, message, phone).catch((err: unknown) => console.error('[CONTACT] SMTP failed:', err));
    } else {
        console.warn('[CONTACT] No email provider configured — set RESEND_API_KEY or SMTP_USER+SMTP_PASS');
    }
}

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

    const { name, email, topic, message, phone } = parsed.data;

    await db.insert(contactMessages).values({ name, email, topic, message });
    console.log(`[CONTACT] New message from ${name} (${email}) — topic: ${topic}`);

    void sendNotificationEmails(name, email, topic, message, phone);

    return c.json({ success: true, data: { message: 'Message received. We will get back to you soon.' } });
});

export default router;
