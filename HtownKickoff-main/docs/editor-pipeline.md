# Highlight Studio: saved stages 1–7

This extends the existing MP4 highlight creator. The studio still offers upload, ScorePlay, sport selection, target length, queries, padding, selection overrides, X reactions and MP4 preview/export. The separate **Build a story for your editor** section stops at stage 7. It does not run the teammate-owned editor, rights/compliance or final render.

## Handoff agreement is still required

The downstream team's exact stage 7 schema has not been supplied. The implementation therefore exports `matchwatch.story.draft.v1`, with `contract_status: "awaiting_team_contract"`. This draft must not be treated as the agreed editor contract. There is no switch that silently labels the draft as approved. Replace the adapter and its contract tests once the team supplies the required JSON schema and example.

`src/lib/story-builder.ts` is the isolated adapter. Its JSON payload is downloaded directly, without the internal artifact envelope. It contains source identifiers, chronological whole clips, source in/out seconds, cumulative timeline positions, estimated scores, reasons and evidence IDs. The source coordinates are recording seconds, not match-clock values. Live captures also retain their media sequence and program UTC when the playlist supplies it. A missing UTC anchor stays null. No final score, red card, player identity or match outcome is inferred from a recording's filename.

## Saved stages

| Stage | Reads | Writes |
|---|---|---|
| 1 Input sources | `input.json` and original upload when applicable | `step-1.json`: source IDs, options and metadata |
| 2 Video understanding | `step-1.json` | `step-2.json`: TwelveLabs detections and evidence-checked Jev reviews |
| 3 Event fusion | `step-2.json` | `step-3.json`: video signals combined with available, aligned statistics/X/audience evidence |
| 4 Unified event database | `step-3.json` | `step-4.json`: canonical event records keyed by match, source, event ID and timestamps |
| 5 Scoring & ranking | `step-4.json` | `step-5.json`: five-factor ranking, effective weights, contributions and evidence coverage |
| 6 Highlight candidates | `step-5.json` | `step-6.json`: complete, non-overlapping clips within the configured budget |
| 7 Story builder | `step-6.json` | `step-7.json`: editor story **draft**, pending team contract |

Artifacts 1–6 use the `matchwatch.pipeline.v1` envelope with job ID, stage, revision, input revision, creation time and data. Stage 4 is a JSON event table for this single-replica hackathon implementation. Raw source video is never stored in this metadata directory. Step 2 checkpoints preserve provider IDs and completed windows so polling/restarts do not resubmit the same paid tasks. Rerunning stage 2 reuses its indexed asset but repeats search/review. Rerunning any step makes later outputs stale and unavailable for download until recomputed. Manual reruns can incur provider charges.

Balanced weights remain sports 30%, social 30%, emotion 20%, controversy/surprise 15%, audience 5%. Existing customization presets remain available. Missing evidence stays null and its weight is redistributed across available signals. The selector reuses the existing optimizer: up to five whole clips, no overlap, a conservative half-second budget, and at most 80 candidates. Playback order follows source time. Empty or unsafe selections produce an actionable stage 7 error instead of a misleading empty handoff.

## API

All routes are below `${NEXT_PUBLIC_APP_BASE_PATH}/api/stream/pipeline` (production `/app/api/stream/pipeline`) and use the existing MatchWatch bearer authentication and origin checks. Job directories are separated by a hash of the authenticated account ID. Provider keys are runtime environment variables and never returned.

- `POST` multipart: `input` is a JSON-encoded `PipelineInput`; `video` is the original upload when `source.kind=upload`. Creates a saved job and runs stage 1. Returns `{ job }` even when source processing fails, so the error can be inspected and retried.
- `POST` JSON: `{ "jobId": "UUID", "step": 2, "rerun": false }`. Runs/resumes one step. A `working` response should be polled by repeating this same request about every three seconds. A ready step is idempotent unless `rerun=true`.
- Retry a failed upload: multipart `jobId` and `video` for the existing job.
- `GET`: lists up to 100 saved jobs for the current account.
- `GET ?jobId=UUID`: reads all seven statuses.
- `GET ?jobId=UUID&step=N`: downloads the current output. Pending/stale/error outputs return 409. Stage 7 returns the story payload directly and uses a `-DRAFT.json` filename.

Each request runs a bounded unit of work. Provider task polling is explicit; no untracked background promise is required to finish a request. A filesystem lock prevents concurrent mutation of one job. Steps time out into a retryable error; jobs that stop reporting for 20 minutes show an error instead of an indefinite working state. Pause stops the browser's polling; already accepted provider work can continue. Resume uses the saved checkpoint. A failed upload with no accepted asset needs the original file again.

## Deployment and sources

Run **one replica**. Mount persistent storage at `/app/.data/highlight-pipeline`, owned by the application user, and set `HIGHLIGHTS_DATA_DIR` to this path. Without a volume, job JSON survives process restarts but is lost when the container is replaced. The Docker image creates the writable default directory. Multi-replica operation requires shared storage/locking, a proper database and distributed quotas.

All local source/proxy/segment/export files use `HIGHLIGHTS_TEMP_DIR` (default OS temp directory plus `matchwatch-processing`). Each operation creates one private child directory and deletes it in `finally` on success or failure. FFmpeg is stopped before cleanup. A host/process crash can bypass `finally`; the deployment should clear abandoned temp folders on restart. Provider-managed TwelveLabs assets remain available for analysis and source references in the editor handoff; they are not local temporary files.

ScorePlay uses the existing server key, account allowlist, catalog/filter search and signed source tickets. The server builds a mapping from every page of the shared TwelveLabs index, retrieving each indexed video's full metadata. It matches ScorePlay IDs through `TWELVELABS_SCOREPLAY_ID_KEY`, or through all scalar/array metadata values when no field is configured. Filename fallback ignores case, extension, whitespace and punctuation; duration breaks unique ties, while ambiguous matches are rejected. The indexed `_id` goes to Marengo search and its actual `asset_id` goes to Pegasus analysis. No ScorePlay download, re-host or re-upload fallback is supported. Existing browser MP4 upload/export still works; ScorePlay selections stop after candidate selection/story handoff for the team's stages 8–10.

The mapper also retrieves each distinct source asset using `GET /v1.3/assets/{asset_id}` and checks its `user_metadata` for the organizer's custom ScorePlay ID. Asset and index metadata are kept separately: conflicting IDs reject the entry instead of silently overwriting one source. Asset metadata matches report `asset.user_metadata.<field>` as the matching field. Configuring `TWELVELABS_SCOREPLAY_ID_KEY` restricts both metadata sources to that field.

The mapping is cached in memory and private JSON files under `HIGHLIGHTS_DATA_DIR`, scoped to the configured index and key fingerprints. Cache version 2 invalidates earlier caches that omitted asset metadata. Index video counts are checked at least every minute and trigger a rebuild when they change. **Refresh AI mapping** bypasses the cache. A first confirmed metadata match logs only the metadata field name and the matched IDs, never API keys or raw metadata. `GET /app/api/stream/scoreplay?action=mapping` is the hidden diagnostics endpoint, protected by the existing login and ScorePlay account allowlist. It reports mapped/unmapped counts, each matched ID and method, and specific failure reasons. Add `&refresh=true` to rebuild. Selecting an unmapped video names the specific file and the configured index instead of showing a generic policy error.

The ScorePlay response can nest preview URLs and duration under `video`; these are normalized by the backend before selection. The studio uses existing ScorePlay/TwelveLabs previews. It never sends a provider key to the browser.

For live input set `HIGHLIGHTS_HLS_URL` and `HLS_ALLOWED_HOSTS` to the organizer URL and exact comma-separated HTTPS playlist/segment hostnames. The UI can use the server URL without revealing its query credentials. Each job captures up to 30/60/90/120 seconds from the currently available playlist. This is a snapshot of the live window, not a continuous recorder. It supports clear segment-based MPEG-TS/fMP4 and bounded variant resolution; encrypted and byte-range feeds return actionable errors. Every playlist, map and segment host is checked, redirects are rejected, public IPv4 DNS is pinned for each connection, and FFmpeg receives only the rewritten local manifest. Captured media is submitted as a direct MP4 upload under 200 MB, then all local files are removed. The organizer feed and its exact CDN hostnames still need to be configured; the app does not invent a feed URL.

X continues through the existing opt-in backend search. Loaded reactions, sourced stats and clock anchors are validated and snapshotted into the new job. No social request is made merely by opening the pipeline. If optional evidence is missing, the pipeline runs on video evidence without fabricating a replacement.

## Validation and official references

Run `node scripts/test-highlights.cjs`, `npx tsc --noEmit`, and ESLint for the changed files. Pipeline tests use explicitly synthetic provider fixtures and make no real/paid model calls. They exercise the complete persisted chain, service restart/resume, owner isolation, reruns, stale output protection, cleanup after failure, safe HLS parsing, source time coordinates, and handoff boundary checks. Real organizer video/HLS processing must also be exercised with the configured team sources before claiming that demo has passed.

Endpoints checked against the official references on October 22, 2026:

- [ScorePlay API and authentication](https://developer.scoreplay.io/), [official Postman collection](https://developer.scoreplay.io/downloads/scoreplay.postman_collection.json): `https://media.scoreplay.io/v1`, `X-ScorePlay-Api-Key`, `POST /media/search`, `GET /media/{id}` and `GET /media/{id}/formats/download`.
- [TwelveLabs asset upload](https://docs.twelvelabs.io/v1.3/api-reference/upload-files/direct-uploads/create): `POST /v1.3/assets`, direct file versus URL methods, 200 MB/4 GB limits, VOD HLS accepted and live HLS rejected.
- [Indexed asset retrieval](https://docs.twelvelabs.io/v1.3/api-reference/index-content/retrieve), [search](https://docs.twelvelabs.io/v1.3/api-reference/any-to-video-search/make-search-request), [asynchronous analysis](https://docs.twelvelabs.io/v1.3/api-reference/analyze-videos/create-async-analysis-task): reuse `asset_id`, poll indexing and analysis, restrict review windows to two hours.
- [X recent search](https://docs.x.com/x-api/posts/search-recent-posts): `GET https://api.x.com/2/tweets/search/recent` with server-side bearer authentication.
- [HLS RFC 8216](https://www.rfc-editor.org/rfc/rfc8216): segment durations, media sequence, variant playlists and program-date-time semantics.
