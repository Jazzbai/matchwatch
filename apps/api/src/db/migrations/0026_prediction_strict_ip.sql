-- ─── Venue Predictions: strict IP dedup toggle (Phase 6) ──────────
-- Opt-in per campaign. Default false — soft IP signal only (see 0025).
-- When true, the submit endpoint rejects entries sharing an ip_hash with
-- any existing entry in the same campaign.

ALTER TABLE "prediction_campaigns"
    ADD COLUMN IF NOT EXISTS "strict_ip_dedup" boolean NOT NULL DEFAULT false;
