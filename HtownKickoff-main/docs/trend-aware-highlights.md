# Trend-aware highlight engine

The highlight studio (`/stream`, or `/app` in the isolated deployment) finds, ranks and selects the sports moments most likely to engage fans by combining video understanding, official match statistics and X reactions. No human editor is required for selection. Viral potential is an estimate, not a guarantee of views.

## The ten steps

Each step is one module in `src/lib/highlights/` and one saved output (`step-N.json`) per job.

| # | Step | Module | What it does |
|---|---|---|---|
| 1 | Match video | `pipeline.ts`, `library.ts`, `media.ts` | ScorePlay media already in the TwelveLabs index (reused, no re-upload), a direct upload (≤ 200 MB), or a captured live HLS window. |
| 2 | Match statistics | `match-stats.ts` | Official events (minute, type, team, player) aligned to video time through kickoff anchors. Video time and match time are never assumed equal. |
| 3 | X social data | `social-signals.ts` | Recent-search posts for the match window, with engagement and follower counts. Missing access is recorded, never invented. |
| 4 | Video understanding | `video-understanding.ts`, `video-review.ts`, `twelvelabs.ts` | Marengo visual + audio search per moment type, then a Pegasus review of each candidate (event type, players, emotion, controversy, watchability, replay, duplicates, clip boundaries). Resumable; paid work is never resubmitted. |
| 5 | Event fusion | `event-fusion.ts` | One unified event per moment: type, video and match time, team, players, official event, clip and aligned social window. |
| 6 | Viral potential analysis | `viral-analysis.ts` | Six signals, each 0–1 or unknown, each with its evidence source. |
| 7 | Viral score engine | `viral-score.ts` | Weighted score, renormalized over available signals. |
| 8 | Rank all moments | `ranking.ts` | Sort by score; mark duplicates (same action, overlapping windows, replays). |
| 9 | Select top moments | `selection.ts`, `rights.ts` | Event-type variety, minimum 5 s gap, length budget, top-N, and the automated rights/compliance gate. |
| 10 | Key moments output | `output.ts` | `matchwatch.key-moments.v2` JSON: timestamps, event types, scores, confidence, reasons and evidence. Optionally render the MP4 (`render.ts`). |

## Signals (step 6)

| Signal | Default weight | Evidence |
|---|---:|---|
| S · Sports importance | 0.30 | Event-type importance (goal > red card > …), late-game context, official stats, observed importance |
| T · Social trend | 0.30 | Post-volume z-score vs the match baseline, engagement share, event keywords, large accounts |
| E · Emotional intensity | 0.20 | Observed reactions and excitement, excited commentary, emotionally charged posts |
| C · Controversy & surprise | 0.15 | Observed disputes/surprise, official referee decisions, split reactions on X |
| A · Audience relevance | 0.05 | Favourite team, star players, X mentions |
| Q · Quality & diversity | 0 by default (0.05 max) | Optional footage clarity, verified clip boundaries and replay penalty; variety is enforced in selection |

```text
ViralScore = Σ(wᵢ · scoreᵢ for available i) / Σ(wᵢ for available i)
confidence = Σ(wᵢ for available i) / Σ(all wᵢ)
```

A measured absence (for example no posts in a reaction window) is a real zero; a signal with no evidence is left out and reported in `missing_signals`.

## Rights gate

A missing or uncertain permission is never treated as approval. Uploads are permitted only when the uploader confirms the rights. Library and live sources are permitted only when listed in `HIGHLIGHTS_LICENSED_INDEX_IDS` / `HIGHLIGHTS_LICENSED_HLS`. Otherwise the key moments are still produced, with `publication: "on_hold"`, and video rendering is refused.

## API

- `GET /api/stream/highlights`: service status (health check).
- `POST /api/stream/highlights { jobId }`: render the selected moments to MP4.
- `GET /api/stream/scoreplay`: the real ScorePlay catalog, retaining league, season, match, date, search and pagination filters.
- `GET /api/stream/scoreplay?action=mapping[&refresh=true]`: authenticated mapping diagnostics and refresh.
- `POST /api/stream/scoreplay?mode=source&mediaId=…`: resolve an existing indexed copy and issue an account-bound selection ticket; never imports footage.
- `GET /api/stream/highlights/library`: a separate optional TwelveLabs index browser with signed selection tickets.
- `POST /api/stream/pipeline` (multipart `input`, optional `video`): create a job.
- `POST /api/stream/pipeline { jobId }`: advance a job; poll while a step is working.
- `POST /api/stream/pipeline { jobId, preferences }`: re-score saved analysis (steps 5–10) with no provider calls.
- `GET /api/stream/pipeline?jobId=…[&step=N]`: status and results, or one step's JSON.

## Running and testing

The match library presents ScorePlay footage, TwelveLabs understanding, and MatchWatch ranking as one workflow. Users can browse the connected catalog or paste a ScorePlay media-page URL or media ID into **Use this match**. The browser extracts only the ID; the server uses its existing fixed ScorePlay endpoint and resolves the existing TwelveLabs copy. Selection does not download or re-upload the original. Library requests have a one-minute browser deadline and can be cancelled. Uploads, live HLS, the additional indexed-video browser, and all customization controls remain available.

```bash
npm install
npm run dev                      # open /stream
node scripts/test-highlights.cjs # unit and pipeline tests, synthetic data only
npx tsc --noEmit
```

Configure `TWELVELABS_API_KEY` and `TWELVELABS_INDEX_ID` in `.env.local`; see `.env.example` for the optional X, rights and HLS settings. Run one replica: job storage, locks and rate limits are local to the process.

ScorePlay additionally needs server-only `SCOREPLAY_API_KEY`, `SCOREPLAY_API_URL` and `SCOREPLAY_ALLOWED_USER_IDS`. The TwelveLabs key must have access to the organizer's shared index: a personal test index cannot provide matches for the hackathon catalog. Mapping inspects indexed and asset metadata, then normalized filenames and duration; ambiguous or missing matches remain explicit errors. Refreshing does not download, re-host or re-upload footage.

The library opens on **Ready for AI**, filtering the complete provider result before paginating so usable videos on later pages remain visible. All existing league, season, match, date and search filters apply. **All ScorePlay videos** also shows unavailable items, labeled and disabled. A missing indexed copy returns `SCOREPLAY_NOT_INDEXED` rather than being presented as a connection error. A working football index does not imply access to an NBA index. Metadata connection failures retry once within the original deadline; TwelveLabs uploads, indexing, search and analysis creation are never automatically replayed.

Customization retains editable search descriptions, before/after padding (0–30 seconds), sport, target length up to 300 seconds and selection rules. Padding applies to candidates without verified model boundaries. Padding, weights and selection changes re-run saved steps 5–10 without paid provider calls; changing search descriptions starts new video understanding. Re-scoring invalidates downstream outputs before work starts; failures and concurrent mutations cannot expose stale exports.

Jobs use `HIGHLIGHTS_DATA_DIR/trend-aware-v1` so older pipeline files are preserved without being interpreted as the new schema. Temporary media lives under `HIGHLIGHTS_TEMP_DIR` (default: the system temp directory's `matchwatch-processing` folder), with one child per operation, removed on success or failure. No temporary media is included in job JSON.

Set server-only `HIGHLIGHTS_PUBLIC_ACCESS=true` to use the studio without signing in. The status endpoint issues a signed HttpOnly browser cookie; jobs and video tickets remain private to that browser session. Public sessions can use the shared ScorePlay library. Origin checks, per-session limits, two concurrent renders and aggregate public hourly limits remain enforced. Keep the existing signing secret stable when deploying; changing it invalidates saved sessions and tickets.
