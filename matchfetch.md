# Match Fetch Runbook (Manual + Scheduled)

Last updated: 2026-03-15  
Project: MatchWatch (`matchwatch.us`)

This file documents exactly how match sync currently works in this codebase, including provider behavior, env settings, manual commands, reset commands, and troubleshooting.

## 1) How Sync Works in This Codebase

- Sync worker starts with API boot (`apps/api/src/index.ts`).
- Nightly cron is scheduled at `02:00 UTC` (`scheduleMatchSync`).
- Manual trigger endpoint: `POST /api/v1/admin/sync-matches` (admin auth required).
- Upserts are keyed by `matches.external_match_id` (prevents duplicates for same source key).
- Finished matches older than 60 days are pruned automatically at end of each sync job.
- Rate limiting is built in with provider-specific sleep between leagues.

## 2) Provider Logic (Important)

Provider resolver:
- `MATCH_SYNC_PROVIDER=API_FOOTBALL` -> primary API-Football
- `MATCH_SYNC_PROVIDER=FOOTBALL_DATA` -> primary Football-Data
- `MATCH_SYNC_PROVIDER=THE_SPORTS_DB` -> primary TheSportsDB
- empty provider:
  - prefers API-Football if key exists
  - else Football-Data if key exists
  - else TheSportsDB

Special US league handling:
- League external IDs `MLS`, `NWSL`, `LMX` are always synced through TheSportsDB path in current worker logic.

Current seeded league set:
- `WC`, `PL`, `PD`, `BL1`, `SA`, `FL1`, `CL`, `MLS`, `LMX`, `NWSL`

## 3) Required/Optional Env Vars

Set in server `.env`:

```env
MATCH_SYNC_PROVIDER=API_FOOTBALL
API_FOOTBALL_API_KEY=your_key_here
FOOTBALL_DATA_API_KEY=
API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io
THE_SPORTS_DB_BASE_URL=https://www.thesportsdb.com/api/v1/json/3
```

Notes:
- For free-only mode (no paid key): set `MATCH_SYNC_PROVIDER=THE_SPORTS_DB` and leave paid keys empty.
- If you update env, rebuild/restart API container for changes to apply.

## 4) Restart API After Env Changes

On EC2 (or wherever docker compose runs):

```bash
cd ~/JazzB-watchparty
sudo docker compose up -d --build api
sudo docker compose ps
```

Confirm env loaded inside container:

```bash
sudo docker compose exec -T api printenv | egrep 'MATCH_SYNC_PROVIDER|API_FOOTBALL_API_KEY|FOOTBALL_DATA_API_KEY|API_FOOTBALL_BASE_URL|THE_SPORTS_DB_BASE_URL'
```

## 5) Manual Sync Command Flow (No Node Required)

Use this on the server where API is reachable at localhost:4000:

```bash
API_BASE="http://localhost:4000/api/v1"
EMAIL="admin@matchwatch.us"
PASSWORD="REPLACE_WITH_REAL_PASSWORD"

LOGIN_JSON=$(curl -sS -X POST "$API_BASE/auth/login" \
  -H 'Content-Type: application/json' \
  --data "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

echo "$LOGIN_JSON"

TOKEN=$(printf '%s' "$LOGIN_JSON" | python3 -c 'import sys,json; j=json.load(sys.stdin); print((j.get("data") or {}).get("accessToken",""))')

if [ -z "$TOKEN" ]; then
  echo "Login failed. Stop here."
  exit 1
fi

curl -sS -X POST "$API_BASE/admin/sync-matches" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json'
```

Expected response:

```json
{"success":true,"data":{"jobId":"<id>","message":"Match sync queued"}}
```

## 6) Verify Results

Basic checks:

```bash
curl -sS "http://localhost:4000/api/v1/matches?limit=20&page=1"
curl -sS "http://localhost:4000/api/v1/matches/facets"
```

Check league names quickly (if `jq` exists):

```bash
curl -sS "http://localhost:4000/api/v1/matches/facets" | jq '.data.leagues[].name'
```

Watch sync logs:

```bash
sudo docker compose logs -f api | grep -Ei "match sync|provider|No API-Football league mapping|rate limited|worker"
```

## 7) Reset Matches and Re-Fetch (Destructive)

This clears match-linked booking/event data so you can rebuild from fresh sync.

```bash
cd ~/JazzB-watchparty
sudo docker compose exec -T postgres psql -U matchwatch -d matchwatch <<'SQL'
BEGIN;
DELETE FROM bookings b
USING venue_events ve
WHERE b.venue_event_id = ve.id;

DELETE FROM venue_events;

UPDATE posts
SET match_id = NULL
WHERE match_id IS NOT NULL;

DELETE FROM matches;
COMMIT;
SQL
```

Then run manual sync again (section 5).

## 8) Admin Recovery (If Login Fails)

If admin password is unknown/invalid:

```bash
cd ~/JazzB-watchparty
sudo docker compose exec -T postgres psql -U matchwatch -d matchwatch <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO users (
  email, password_hash, name, role, email_verified, is_active, is_suspended, timezone, locale
)
VALUES (
  'admin@matchwatch.us',
  crypt('Admin@12345', gen_salt('bf', 12)),
  'MatchWatch Admin',
  'SUPER_ADMIN',
  true, true, false,
  'UTC', 'en'
)
ON CONFLICT (email) DO UPDATE
SET
  password_hash = EXCLUDED.password_hash,
  role = 'SUPER_ADMIN',
  email_verified = true,
  is_active = true,
  is_suspended = false,
  failed_login_attempts = 0,
  locked_until = NULL,
  updated_at = NOW();
SQL
```

Then login again with:
- email: `admin@matchwatch.us`
- password: `Admin@12345`

## 9) League Customization

List active leagues:

```bash
sudo docker compose exec -T postgres psql -U matchwatch -d matchwatch -c \
"SELECT name, short_name, external_id, country, is_active, sort_order FROM leagues ORDER BY sort_order;"
```

Disable a league:

```bash
sudo docker compose exec -T postgres psql -U matchwatch -d matchwatch -c \
"UPDATE leagues SET is_active = false WHERE external_id = 'WC';"
```

Enable again:

```bash
sudo docker compose exec -T postgres psql -U matchwatch -d matchwatch -c \
"UPDATE leagues SET is_active = true WHERE external_id = 'WC';"
```

Add a league row (if needed):

```bash
sudo docker compose exec -T postgres psql -U matchwatch -d matchwatch -c \
"INSERT INTO leagues (name, short_name, external_id, country, is_active, sort_order)
 VALUES ('Example League', 'EXL', 'EXL', 'Example Country', true, 99)
 ON CONFLICT (external_id) DO NOTHING;"
```

Important:
- For TheSportsDB sync, external IDs must be mapped in worker code (`THE_SPORTS_DB_LEAGUE_IDS`) if not already mapped.
- For API-Football sync, league discovery uses name/shortName/externalId matching.

## 10) Troubleshooting Quick Map

- `UNAUTHORIZED` on sync endpoint:
  - token empty or invalid; re-run login and verify token extraction.
- Login returns `Invalid email or password`:
  - reset admin password (section 8).
- Worker logs `API_FOOTBALL_API_KEY not set`:
  - missing env key; update `.env` and restart API container.
- Matches endpoint returns empty:
  - sync not triggered yet, all leagues inactive, or provider mapping misses; inspect logs.
- Only one or few leagues show:
  - check league `is_active` values and provider mapping logs.
- Sync works but old UI still shown:
  - hard refresh browser and check `matches` API output directly first.

