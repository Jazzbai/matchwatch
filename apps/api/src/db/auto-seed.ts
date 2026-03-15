import { count } from 'drizzle-orm';
import { db } from './client';
import { leagues, users } from './schema';
import { ensureLeaguesSeeded, seedDatabase } from './seed';

/**
 * Auto-seed on startup only when core tables are empty.
 * Safe to call repeatedly; it no-ops once data exists.
 */
export async function autoSeed() {
    // Always ensure missing core leagues are present for existing deployments.
    await ensureLeaguesSeeded();

    const [{ totalUsers }, { totalLeagues }] = await Promise.all([
        db.select({ totalUsers: count() }).from(users).limit(1).then((rows) => rows[0] ?? { totalUsers: 0 }),
        db.select({ totalLeagues: count() }).from(leagues).limit(1).then((rows) => rows[0] ?? { totalLeagues: 0 }),
    ]);

    if (Number(totalUsers) > 0 || Number(totalLeagues) > 0) {
        return { seeded: false, reason: 'database already contains data' } as const;
    }

    await seedDatabase();
    return { seeded: true } as const;
}
