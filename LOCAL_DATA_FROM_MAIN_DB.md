# Local Site Using Main AWS Data

## Option A (recommended): use production API directly

Use local frontend, but proxy API calls to `https://matchwatch.us`:

1. Edit `HtownKickoff-main/.env.local`
2. Set:

```env
NEXT_PUBLIC_API_URL=/api/v1
API_PROXY_TARGET=https://matchwatch.us
```

3. Start frontend:

```powershell
cd HtownKickoff-main
npm run dev -- --port 3100
```

This avoids direct DB access from local and avoids migration/seed risks.

## Option B: local API connected to main AWS database

If you need local backend code to run against main DB:

1. Copy `remote-db.env.example` to `.env`
2. Set `DATABASE_URL` to AWS DB URL (prefer read-only user)
3. Keep these safety flags disabled:

```env
RUN_STARTUP_MIGRATIONS=false
RUN_STARTUP_SEED=false
ENABLE_MATCH_SYNC_WORKER=false
```

4. Start Redis locally on port `6380` using Docker or any local Redis install. For example:

```powershell
docker run --rm -p 6380:6379 redis:7
```

5. Start API:

```powershell
npm run dev --workspace=@matchwatch/api
```

6. Start frontend:

```powershell
cd HtownKickoff-main
npm run dev -- --port 3100
```

7. Verify:

- `http://localhost:4000/health`
- `http://localhost:3100/api/v1/matches?limit=1&page=1`

## Option C: build an anonymized local clone from production-shaped data

Use this when you want realistic local volume/patterns without PII.

1. Set environment variables:

```env
DATABASE_URL=<local-postgres-url>
SOURCE_DATABASE_URL=<production-readonly-postgres-url>
RUN_STARTUP_MIGRATIONS=false
RUN_STARTUP_SEED=false
ENABLE_MATCH_SYNC_WORKER=false
ANON_LOCAL_PASSWORD=Demo@12345
```

2. Run:

```powershell
npm run db:seed:anonymized --workspace=@matchwatch/api
```

What it does:

- Reads sports/leagues/teams/matches/users/venues/events/menu/posts/bookings from `SOURCE_DATABASE_URL`.
- Rebuilds local DB on `DATABASE_URL`.
- Redacts/anonymizes PII fields (emails, names, addresses, phones, post text, booking special requests).
- Preserves relation IDs and data shape so app behavior matches production patterns.
