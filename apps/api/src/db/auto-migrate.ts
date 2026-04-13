/**
 * Auto-migrate: apply all Drizzle SQL migrations on startup.
 * This runs BEFORE the server starts.
 */
import postgres from 'postgres';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
    const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/matchwatch';
    const sql = postgres(databaseUrl, { max: 1 });

    console.log('Running migrations...');

    // Create migrations tracking table if not exists
    await sql`
        CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
            id SERIAL PRIMARY KEY,
            hash TEXT NOT NULL UNIQUE,
            created_at BIGINT
        )
    `;

    // Read applied migrations
    const applied = await sql`SELECT hash FROM "__drizzle_migrations"`;
    const appliedSet = new Set(applied.map((r: any) => r.hash));

    // Read migration journal
    const migrationsDir = join(__dirname, 'migrations');
    const journalPath = join(migrationsDir, 'meta', '_journal.json');

    if (!existsSync(journalPath)) {
        console.log('  WARN: No migrations found, skipping');
        await sql.end();
        return;
    }

    const journal = JSON.parse(readFileSync(journalPath, 'utf-8'));

    for (const entry of journal.entries) {
        const hash = entry.tag;
        if (appliedSet.has(hash)) {
            console.log(`  OK: ${hash} (already applied)`);
            continue;
        }

        const sqlFile = join(migrationsDir, `${hash}.sql`);
        if (!existsSync(sqlFile)) {
            console.log(`  WARN: ${hash}.sql not found, skipping`);
            continue;
        }

        const migrationSql = readFileSync(sqlFile, 'utf-8');
        console.log(`  → Applying ${hash}...`);

        // Drizzle SQL files are separated by `--> statement-breakpoint`.
        // For plain SQL files, execute the full file as a single batch so
        // dollar-quoted blocks like `DO $$ ... $$;` are preserved.
        const statements = migrationSql.includes('--> statement-breakpoint')
            ? migrationSql
                .split('--> statement-breakpoint')
                .map((s) => s.trim())
                .filter((s) => s.length > 0)
            : [migrationSql.trim()].filter((s) => s.length > 0);

        for (const stmt of statements) {
            try {
                await sql.unsafe(stmt);
            } catch (err: any) {
                // Ignore "already exists" errors for idempotency
                if (err.code === '42P07' || err.code === '42710') {
                    console.log(`    (already exists, continuing)`);
                } else {
                    throw err;
                }
            }
        }

        // Record migration
        await sql`INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES (${hash}, ${Date.now()})`;
        console.log(`  OK: ${hash} applied`);
    }

    console.log('Migrations complete\n');
    await sql.end();
}

export { migrate };

// If run directly
if (process.argv[1]?.includes('auto-migrate')) {
    migrate().catch(err => {
        console.error('Migration failed:', err);
        process.exit(1);
    });
}
