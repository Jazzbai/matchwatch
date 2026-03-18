import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import 'dotenv/config';

import {
    requestIdMiddleware, loggerMiddleware, corsMiddleware,
    securityHeadersMiddleware, errorHandler, publicRateLimit,
} from './middleware';
import authRoutes from './routes/auth';
import matchRoutes from './routes/matches';
import venueRoutes from './routes/venues';
import bookingRoutes from './routes/bookings';
import userRoutes from './routes/user';
import dashboardRoutes from './routes/dashboard';
import adminRoutes from './routes/admin';
import uploadRoutes from './routes/uploads';
import superAdminRoutes from './routes/superAdmin';
import { logger } from './lib/logger';
import { scheduleMatchSync, startMatchSyncWorker } from './workers/matchSync';

// ─── Create App ─────────────────────────────────

const app = new Hono();

// ─── Global Middleware ──────────────────────────

app.use('*', requestIdMiddleware);
app.use('*', errorHandler);
app.use('*', corsMiddleware);
app.use('*', securityHeadersMiddleware);
app.use('*', loggerMiddleware);

// ─── Health Check ───────────────────────────────

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' }));

// ─── API v1 Routes ──────────────────────────────

const v1 = new Hono();

v1.use('*', publicRateLimit);
v1.route('/auth', authRoutes);
v1.route('/matches', matchRoutes);
v1.route('/venues', venueRoutes);
v1.route('/bookings', bookingRoutes);
v1.route('/user', userRoutes);
v1.route('/dashboard', dashboardRoutes);
v1.route('/admin', adminRoutes);
v1.route('/super-admin', superAdminRoutes);
v1.route('/uploads', uploadRoutes);
v1.route('/upload', uploadRoutes);

app.route('/api/v1', v1);

// ─── 404 Catch ──────────────────────────────────

app.notFound((c) => c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404));

// ─── Start Server ───────────────────────────────

import { migrate } from './db/auto-migrate';
import { autoSeed } from './db/auto-seed';

const port = parseInt(process.env.PORT || '4000', 10);

async function start() {
    // Run migrations first (creates tables if missing)
    try {
        await migrate();
    } catch (err) {
        logger.error({ err }, 'Migration failed');
        if (process.env.NODE_ENV === 'production') {
            process.exit(1);
        }
    }

    // Seed demo data if tables are empty
    try {
        await autoSeed();
    } catch (err) {
        logger.error({ err }, 'Auto-seed failed');
        if (process.env.NODE_ENV === 'production') {
            process.exit(1);
        }
    }

    serve({
        fetch: app.fetch,
        port,
    }, async () => {
        logger.info(`MatchWatch API running on http://localhost:${port}`);
        logger.info(`Health check: http://localhost:${port}/health`);
        logger.info(`API base: http://localhost:${port}/api/v1`);

        // Start background workers
        startMatchSyncWorker();
        await scheduleMatchSync();
    });
}

start();

export default app;
