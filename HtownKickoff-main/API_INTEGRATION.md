# Highlights Integration API

Send a ScorePlay video ID and get back the best highlight moments, found by the trend-aware highlight engine (TwelveLabs video understanding → six-signal viral scoring → automatic selection). Processing runs in the background; poll for the result or receive it by webhook.

## Base URL and authentication

| Setting | Value |
|---|---|
| Base URL | `https://<public-host>/api/v1` (the tunnel or deployment URL you were given) |
| Local | `http://localhost:3010/api/v1` |
| Auth | Header `X-API-Key: <key>` on every request except `/health` |
| Format | JSON, UTF-8 |

Wrong or missing key → `401`. API disabled on the server → `503`.

## Endpoints

### `GET /health`

No authentication. Reports configuration flags only.

```json
{ "status": "ok", "api_enabled": true, "video_analysis_configured": true, "scoreplay_catalog_configured": false, "webhook_signing": false, "time": "2026-10-23T15:37:04.761Z" }
```

### `POST /process`

Starts processing and returns immediately with `202 Accepted`.

Request:

```json
{
  "video_id": "130851978",
  "webhook_url": "https://teammate-server.com/webhook",
  "options": {
    "sport": "Soccer",
    "title": "Manchester United vs Spurs",
    "home_team": "Manchester United",
    "away_team": "Tottenham Hotspur",
    "target_seconds": 60,
    "max_moments": 5,
    "priority": "balanced",
    "favorite_team": "Tottenham",
    "star_players": ["Solanke"]
  }
}
```

| Field | Required | Rules |
|---|---|---|
| `video_id` | yes | ScorePlay media ID, digits only (string or number) |
| `webhook_url` | no | Public `https://` URL on port 443, no credentials, no private/internal hosts |
| `options.sport` | no | `Soccer` (default) or `Basketball` |
| `options.target_seconds` | no | Total highlight length, 10–300 (default 60) |
| `options.max_moments` | no | 1–10 (default 5) |
| `options.priority` | no | `balanced` (default), `big_plays`, `emotion`, `fan_response` |
| `options.title`, `home_team`, `away_team`, `favorite_team` | no | Text, ≤ 200 / 80 characters |
| `options.star_players` | no | Up to 10 names |

Response `202`:

```json
{ "job_id": "66e7890f-9890-4bc2-bdd0-3f700d2b4455", "video_id": "130851978", "status": "queued", "status_url": "/api/v1/jobs/66e7890f-9890-4bc2-bdd0-3f700d2b4455" }
```

Errors: `400` invalid input or webhook URL, `401` bad key, `413` body over 64 KB, `429` hourly limit (production only).

The video must already be analyzed in the connected TwelveLabs index (the organizers' ScorePlay library). Otherwise the job finishes as `failed` with a "No analyzed video with ScorePlay ID …" error.

### `GET /jobs/{job_id}`

Returns the job. `result` is filled when `status` is `completed`. A job is visible only to the API key that created it (other keys get `404`).

This is a real response from a test run, showing only the first of its five highlights. When the job has a `webhook_url`, `webhook` is `{ "state": "pending" | "delivered" | "failed", "delivery_id": "…", "attempts": n }`.

```json
{
  "job_id": "66e7890f-9890-4bc2-bdd0-3f700d2b4455",
  "video_id": "130851978",
  "status": "completed",
  "created_at": "2026-10-23T15:37:57.820Z",
  "updated_at": "2026-10-23T15:38:36.353Z",
  "progress": null,
  "error": null,
  "webhook": null,
  "result": {
    "title": "Manchester United vs Spurs | Extended Highlights | 2026-27",
    "duration_seconds": 509.74,
    "total_highlight_seconds": 60,
    "rights_status": "permitted",
    "publication": "ready",
    "social_data_status": "not_requested",
    "ranked_moments": 24,
    "highlights": [
      {
        "rank": 1,
        "start_time": 389,
        "end_time": 398,
        "event_type": "goal",
        "label": "Goal",
        "viral_score": 0.7405,
        "confidence": 0.7,
        "description": "The dramatic equalizing goal in stoppage time is a high-importance moment with clear visual confirmation. Strongest signals: sports importance 1.00, emotion 0.62.",
        "match_time": null,
        "team": "Tottenham Hotspur",
        "players": ["Dominic Solanke", "Lisandro Martinez"],
        "scores": { "sports_importance": 1, "social_trend_spike": null, "emotional_intensity": 0.62, "controversy_surprise": 0.3, "audience_relevance": 1, "quality_diversity": 0.98 },
        "missing_signals": ["social_trend_spike"]
      }
    ],
    "key_moments": { "schema_version": "matchwatch.key-moments.v2", "…": "full engine output: every ranked moment, skip reasons, evidence" }
  }
}
```

Field meanings:

- `start_time` / `end_time`: seconds in the source video. `highlights` is in playback (chronological) order; `rank` is the viral-score rank.
- `viral_score`: 0–1 weighted score. It estimates potential and guarantees nothing.
- `confidence`: share of the scoring weight backed by evidence (0–1). It is **not** a calibrated probability.
- `scores`: the six signals, each 0–1, or `null` when no evidence exists (listed in `missing_signals`).
- `match_time`: match clock, only when kickoff anchors are known; usually `null` through this API.
- `publication`: `ready`, or `on_hold` when usage rights are not confirmed for the asset.
- No clip URLs are returned; the engine provides timestamps only.

## Status lifecycle

```
queued ──► processing ──► completed
                    └───► failed      (error explains why)
```

While `processing`, `progress` shows the current engine step (1–10) and its message. A typical library video completes in under a minute; long matches take longer. Jobs time out after 30 minutes.

## Webhook

When a job finishes, the server POSTs to `webhook_url`:

```json
{
  "delivery_id": "3f1c9a…",
  "event": "job.completed",
  "job_id": "66e7890f-…",
  "video_id": "130851978",
  "status": "completed",
  "result": { "…": "same as GET /jobs result" }
}
```

On failure: `"event": "job.failed"`, `"status": "failed"`, `"error": "…"`, and no `result`.

Headers: `X-Webhook-Id` (= `delivery_id`), `X-Webhook-Event`, `X-Webhook-Timestamp` (Unix seconds), and `X-Webhook-Signature: sha256=<hex>` when the server has a signing secret. The signature is HMAC-SHA256 of `"<timestamp>.<raw body>"`.

Delivery rules:

- Respond `2xx` within 10 seconds to acknowledge.
- `429`, `5xx` and network errors are retried up to 4 attempts with backoff (1 s, 2 s, 4 s). Other `4xx` responses are not retried. Redirects are never followed.
- **De-duplicate by `delivery_id`.** The same job and outcome always use the same ID, including re-sends after a server restart.
- A failed webhook never changes the job result. `GET /jobs/{id}` stays the source of truth.

## curl examples

```bash
BASE=https://<public-host>/api/v1
KEY=<your-api-key>

curl $BASE/health

curl -X POST $BASE/process \
  -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"video_id":"130851978","webhook_url":"https://teammate-server.com/webhook"}'

curl -H "X-API-Key: $KEY" $BASE/jobs/<job_id>
```

## Using it from an AI agent

Give the agent two tools:

1. `start_highlights(video_id, options?)` → `POST /process`; returns `job_id`.
2. `get_highlights(job_id)` → `GET /jobs/{job_id}`. If `status` is `queued` or `processing`, wait about 5 seconds and call again; stop on `completed` or `failed`.

Have the agent use `result.highlights` (timestamps, `event_type`, `description`, `viral_score`). It should treat `null` scores as unknown, not zero, and must not present `viral_score` or `confidence` as probabilities. With a webhook, the agent can skip polling and react to `job.completed` instead.

## Errors

| HTTP | Meaning | What to do |
|---|---|---|
| 400 | Invalid `video_id`, options or `webhook_url` | Fix the request; the message says which field |
| 401 | Missing or wrong `X-API-Key` | Check the key |
| 404 | Unknown `job_id` (or created by another key) | Use the `job_id` returned by `/process` |
| 429 | Hourly limit reached (production) | Retry later |
| 503 | API not enabled on the server | Ask the server owner |
| 500 | Unexpected server error | Retry; report if it persists |

A job with `status: "failed"` has a human-readable `error`, for example: the ScorePlay ID is not in the analyzed library, TwelveLabs could not be reached, or the time limit was exceeded.

## Testing the integration

1. `curl $BASE/health` should report `"api_enabled": true`.
2. Submit `video_id` `130851978` (Man Utd vs Spurs extended highlights, already indexed) and poll `/jobs/{id}` until `completed`.
3. For webhooks, point `webhook_url` at a public HTTPS endpoint you control (for example your own tunnel), and check the payload and `X-Webhook-Id`.

## Running the server (for the API owner)

```bash
cd HtownKickoff-main
npm install
# .env.local needs TWELVELABS_API_KEY, TWELVELABS_INDEX_ID and HIGHLIGHTS_API_KEYS (see .env.example)
npx next dev -p 3010
node scripts/test-highlights.cjs   # unit + integration tests, no real provider calls
```

### Exposing it publicly

The API is reachable from the internet only while a tunnel or deployment is running.

**ngrok**

1. Install ngrok (`winget install ngrok.ngrok`) and run `ngrok config add-authtoken <token>` with the token from your ngrok dashboard.
2. Run `ngrok http 3010`.
3. Copy the `Forwarding` HTTPS URL (e.g. `https://abc123.ngrok-free.app`). The base URL is that URL plus `/api/v1`.
4. Share the base URL publicly if you like, but send the API key privately.

**Cloudflare alternative:** `cloudflared tunnel --url http://localhost:3010` prints a `https://….trycloudflare.com` URL.

The tunnel exposes the whole development server. Stop it when you're done, and rotate keys you shared. In the `/app` production deployment, the base URL is `https://matchwatch.us/app/api/v1`.

## Limitations

- **Single process:** jobs run in an in-process worker, 2 at a time by default (`HIGHLIGHTS_API_CONCURRENCY`). Job records persist on disk (`.data/highlight-pipeline/api-jobs`), and unfinished jobs and undelivered webhooks resume after a restart. Run one replica: multiple replicas would need shared storage and a real queue.
- **Library videos only:** the video must already be indexed by TwelveLabs. ScorePlay IDs are matched through the index metadata, or through the ScorePlay catalog mapping when `SCOREPLAY_API_KEY` is set.
- **Rate limits** (production only) are per key, per process, and reset on restart.
- **Webhooks** resolve IPv4 only. A host with only IPv6 addresses is rejected.
- **No fan reactions:** X reactions are not requested through this API yet (`social_data_status: "not_requested"`).
