import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/matchwatch';

const queryClient = postgres(connectionString, {
    max: 20,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
});

export const db = drizzle(queryClient, { schema });

export type Database = typeof db;
