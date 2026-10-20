import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

export default defineConfig({
    schema: ['./src/db/schema.ts', './src/db/stream-schema.ts'],
    out: './src/db/migrations',
    dialect: 'postgresql',
    dbCredentials: {
        url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/matchwatch',
    },
});
