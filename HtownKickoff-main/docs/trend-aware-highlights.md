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
| Q · Quality & diversity | 0.05 (max) | Footage clarity, verified clip boundaries, replay penalty; variety is enforced in selection |

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
- `GET /api/stream/highlights/library`: indexed ScorePlay media with signed selection tickets.
- `POST /api/stream/pipeline` (multipart `input`, optional `video`): create a job.
- `POST /api/stream/pipeline { jobId }`: advance a job; poll while a step is working.
- `POST /api/stream/pipeline { jobId, preferences }`: re-score saved analysis (steps 5–10) with no provider calls.
- `GET /api/stream/pipeline?jobId=…[&step=N]`: status and results, or one step's JSON.

## Running and testing

```bash
npm install
npm run dev                      # open /stream
node scripts/test-highlights.cjs # unit and pipeline tests, synthetic data only
npx tsc --noEmit
```

Configure `TWELVELABS_API_KEY` and `TWELVELABS_INDEX_ID` in `.env.local`; see `.env.example` for the optional X, rights and HLS settings. Run one replica: job storage, locks and rate limits are local to the process.
