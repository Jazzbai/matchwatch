import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import 'dotenv/config';

import {
    requestIdMiddleware,
    loggerMiddleware,
    corsMiddleware,
    securityHeadersMiddleware,
    errorHandler,
    publicRateLimit,
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
import blogRoutes from './routes/blog';
import placeRoutes from './routes/places';
import { logger } from './lib/logger';
import { scheduleMatchSync, startMatchSyncWorker } from './workers/matchSync';

// Create App
const app = new Hono();

// Global Middleware
app.use('*', requestIdMiddleware);
app.use('*', errorHandler);
app.use('*', corsMiddleware);
app.use('*', securityHeadersMiddleware);
app.use('*', loggerMiddleware);

// Health Check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' }));

// API v1 Routes
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
v1.route('/blog', blogRoutes);
v1.route('/places', placeRoutes);

app.route('/api/v1', v1);

// 404 Catch
app.notFound((c) => c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404));

// Start Server
import { migrate } from './db/auto-migrate';
import { autoSeed } from './db/auto-seed';

const port = parseInt(process.env.PORT || '4000', 10);

function envFlag(name: string, defaultValue: boolean) {
    const raw = process.env[name];
    if (raw === undefined || raw === null || raw.trim() === '') return defaultValue;
    return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

const runStartupMigrations = envFlag('RUN_STARTUP_MIGRATIONS', true);
const runStartupSeed = envFlag('RUN_STARTUP_SEED', true);
const enableMatchSyncWorker = envFlag('ENABLE_MATCH_SYNC_WORKER', true);

async function start() {
    if (runStartupMigrations) {
        try {
            await migrate();
        } catch (err) {
            logger.error({ err }, 'Migration failed');
            if (process.env.NODE_ENV === 'production') {
                process.exit(1);
            }
        }
    } else {
        logger.warn('Startup migrations disabled via RUN_STARTUP_MIGRATIONS=false');
    }

    if (runStartupSeed) {
        try {
            await autoSeed();
        } catch (err) {
            logger.error({ err }, 'Auto-seed failed');
            if (process.env.NODE_ENV === 'production') {
                process.exit(1);
            }
        }
    } else {
        logger.warn('Startup auto-seed disabled via RUN_STARTUP_SEED=false');
    }

    serve(
        {
            fetch: app.fetch,
            port,
        },
        async () => {
            logger.info(`MatchWatch API running on http://localhost:${port}`);
            logger.info(`Health check: http://localhost:${port}/health`);
            logger.info(`API base: http://localhost:${port}/api/v1`);

            if (enableMatchSyncWorker) {
                try {
                    startMatchSyncWorker();
                    await scheduleMatchSync();
                } catch (err) {
                    logger.error({ err }, 'Match sync worker startup failed');
                }
            } else {
                logger.warn('Match sync worker disabled via ENABLE_MATCH_SYNC_WORKER=false');
            }
        },
    );
}

start();

export default app;
