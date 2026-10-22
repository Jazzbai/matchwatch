# Automatic viral moment ranking

The existing TwelveLabs asset review now requests evidence-backed emotional intensity and controversy/surprise estimates alongside sporting importance. The fixed strategy in `src/lib/jev.ts` treats video text and labels as untrusted evidence, leaves unknown judgments null, and makes no promise of virality. Existing video ID, boundary, duplicate and uncertain-review validation still applies.

Five weights are fixed: sports importance 30%, social engagement 30%, emotional intensity 20%, controversy/surprise 15%, audience relevance 5%. Code renormalizes the available weights. A known zero stays zero. Watchability remains part of the original review metadata but is not a sixth viral factor. Each result includes effective weights, additive contributions, source IDs and evidence coverage. Coverage is not a calibrated probability or factual accuracy score.

## Inputs and alignment

- TwelveLabs: actual asset analysis, with an observed reason for each new score. Older reviews without new fields remain valid; their new signals are unknown.
- ScorePlay: existing source and filter integration is preserved. Hackathon platform permissions and the outstanding pre-indexed asset mapping remain enforced.
- Official match statistics: existing JSON adapter, exact match ID, normalized action label and explicit per-period clock anchors. No statistics provider has been configured; the engine does not claim a live statistics connection.
- X: server-side recent search uses `X_BEARER_TOKEN`, with production account access limited by `X_ALLOWED_USER_IDS`. One user-initiated search retrieves at most 100 posts; the response marks truncation. Token values never reach the UI. The provider must permit the requested dates. Missing metrics and partial provider failures are rejected.
- Audience: optional sourced JSON metadata with `matchId`, `preferredEntities`, and `events` containing `eventId`, `entityIds`, `source`, and optional normalized `popularity`, `rivalry`, `currentInterest`. Entity IDs match explicitly, without guessing player popularity. Preferences with no matching entities are a known zero; absent preferences are unknown.

Social alignment needs the UTC time of video second zero, reaction delay, and a narrow match-specific query. Temporal association does not establish relevance to a play. Edited recordings require recalibrated anchors. Spike detection compares the candidate window with five preceding windows only when at least five preceding posts populate at least three windows; otherwise relative sample engagement is used and the missing baseline is disclosed. Neither measure estimates population-wide attention. Opposing explicit decision phrases require at least two posts on each side; this lexical heuristic cannot understand sarcasm or establish that an official decision was wrong. No general sentiment model is claimed.

## Pipeline and JSON

After each video review, scoring runs automatically and the existing whole-clip interval optimizer selects at most five non-overlapping verified clips within the chosen reel budget (default 60 seconds). Automatic MP4 generation defaults on, without producer approval; the existing server export and content permissions still apply. Evidence updates automatically revise scoring and invalidate stale output. JSON ranking is restricted to a 60-second budget and sorted by viral score, while playback order remains chronological.

`POST /app/api/stream/viral` accepts an authenticated JSON request containing `events` (1–20 candidates with validated `jev` reviews), `duration`, `matchId`, optional `stats`, `posts`, `anchors`, `audience`, `videoUtc`, `reactionDelay` and `tolerance`. It returns `moments` (up to five), fixed weights, estimated=true and total seconds. Each moment includes event_id, timestamps, five scores, viral_score, effective_weights, contributions, confidence.evidence_coverage, confidence.calibrated_probability=null, explanation and evidence IDs. Empty evidence or no eligible clips returns an empty list. Client-provided evidence is validated structurally; this endpoint does not independently authenticate imported statistics or audience provenance.

The UI exposes the same ranking, contributions and JSON under Viral potential analysis. Run `node scripts/test-highlights.cjs`, `npx.cmd tsc --noEmit`, and lint the changed files. Tests use explicit synthetic fixtures and stub transports, never pretend to be live provider data. Live model evaluation and full end-to-end production deployment require the configured service credentials and authorized assets.
