-- ─── Venue Predictions (Phase 1 — schema) ─────────────────────────
-- Per-venue, per-match prediction campaigns. Distinct from the existing
-- `predictions` table (platform-wide Match Point sweepstakes). This is the
-- venue-owner-controlled local pick'em with custom prizes and a raffle draw.

-- ─── Enum types ────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE "prediction_campaign_status" AS ENUM ('DRAFT','OPEN','LOCKED','SETTLED','DRAWN');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "prediction_prize_eligibility" AS ENUM ('CORRECT_WINNER','EXACT_SCORE','ANY_ENTRY');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "prediction_winner_pick" AS ENUM ('HOME','AWAY','DRAW');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

-- ─── notification_type: add PREDICTION_WIN ─────────────────────────
-- ALTER TYPE ... ADD VALUE must run outside a transaction in some Postgres
-- versions. The migration runner splits on the statement-breakpoint marker,
-- so this gets its own block.
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'PREDICTION_WIN';
--> statement-breakpoint

-- ─── prediction_campaigns ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "prediction_campaigns" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "venue_id" uuid NOT NULL REFERENCES "venues"("id") ON DELETE CASCADE,
    "match_id" uuid NOT NULL REFERENCES "matches"("id") ON DELETE CASCADE,
    "venue_event_id" uuid REFERENCES "venue_events"("id") ON DELETE SET NULL,
    "title" varchar(200) NOT NULL,
    "description" text,
    "status" "prediction_campaign_status" NOT NULL DEFAULT 'DRAFT',
    "opens_at" timestamp NOT NULL,
    "closes_at" timestamp NOT NULL,
    "points_exact_score" integer NOT NULL DEFAULT 2,
    "points_correct_winner" integer NOT NULL DEFAULT 1,
    "total_entries" integer NOT NULL DEFAULT 0,
    "correct_winner_count" integer NOT NULL DEFAULT 0,
    "exact_score_count" integer NOT NULL DEFAULT 0,
    "settled_at" timestamp,
    "raffle_drawn_at" timestamp,
    "created_by" uuid NOT NULL REFERENCES "users"("id"),
    "created_at" timestamp NOT NULL DEFAULT now(),
    "updated_at" timestamp NOT NULL DEFAULT now(),
    CONSTRAINT "prediction_campaigns_venue_match_unique" UNIQUE ("venue_id","match_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prediction_campaigns_venue_status_idx"
    ON "prediction_campaigns" ("venue_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prediction_campaigns_match_idx"
    ON "prediction_campaigns" ("match_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prediction_campaigns_lock_sweep_idx"
    ON "prediction_campaigns" ("status","closes_at");
--> statement-breakpoint

-- ─── prediction_campaign_prizes ────────────────────────────────────
CREATE TABLE IF NOT EXISTS "prediction_campaign_prizes" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "campaign_id" uuid NOT NULL REFERENCES "prediction_campaigns"("id") ON DELETE CASCADE,
    "sort_order" integer NOT NULL DEFAULT 0,
    "title" varchar(200) NOT NULL,
    "description" text,
    "image_url" varchar(500),
    "image_s3_key" varchar(500),
    "eligibility" "prediction_prize_eligibility" NOT NULL,
    "draw_count" integer NOT NULL DEFAULT 1,
    "drawn_at" timestamp,
    "drawn_by" uuid REFERENCES "users"("id"),
    "created_at" timestamp NOT NULL DEFAULT now(),
    "updated_at" timestamp NOT NULL DEFAULT now(),
    CONSTRAINT "prediction_prize_draw_count_positive" CHECK ("draw_count" > 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prediction_prizes_campaign_sort_idx"
    ON "prediction_campaign_prizes" ("campaign_id","sort_order");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prediction_prizes_undrawn_idx"
    ON "prediction_campaign_prizes" ("campaign_id") WHERE "drawn_at" IS NULL;
--> statement-breakpoint

-- ─── prediction_entries ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "prediction_entries" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "campaign_id" uuid NOT NULL REFERENCES "prediction_campaigns"("id") ON DELETE CASCADE,
    "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "display_name" varchar(100) NOT NULL,
    "phone" varchar(20) NOT NULL,
    "email" varchar(255),
    "ip_hash" varchar(64) NOT NULL,
    "user_agent" text,
    "predicted_winner" "prediction_winner_pick" NOT NULL,
    "predicted_home_score" integer,
    "predicted_away_score" integer,
    "points" integer NOT NULL DEFAULT 0,
    "is_correct_winner" boolean NOT NULL DEFAULT false,
    "is_exact_score" boolean NOT NULL DEFAULT false,
    "settled_at" timestamp,
    "created_at" timestamp NOT NULL DEFAULT now(),
    CONSTRAINT "prediction_entries_campaign_user_unique" UNIQUE ("campaign_id","user_id"),
    CONSTRAINT "prediction_entries_campaign_phone_unique" UNIQUE ("campaign_id","phone")
);
--> statement-breakpoint
-- IP is a SOFT signal in v1 (shared venue WiFi collides on legit predictors).
-- Indexed but NOT unique. Admin sees collision count as a warning.
CREATE INDEX IF NOT EXISTS "prediction_entries_campaign_ip_idx"
    ON "prediction_entries" ("campaign_id","ip_hash");
--> statement-breakpoint
-- Partial indexes for fast eligibility-filter pool queries during draw.
CREATE INDEX IF NOT EXISTS "prediction_entries_winner_pool_idx"
    ON "prediction_entries" ("campaign_id") WHERE "is_correct_winner" = true;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prediction_entries_exact_pool_idx"
    ON "prediction_entries" ("campaign_id") WHERE "is_exact_score" = true;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prediction_entries_user_idx"
    ON "prediction_entries" ("user_id");
--> statement-breakpoint

-- ─── prediction_winners ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "prediction_winners" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "prize_id" uuid NOT NULL REFERENCES "prediction_campaign_prizes"("id") ON DELETE CASCADE,
    "entry_id" uuid NOT NULL REFERENCES "prediction_entries"("id") ON DELETE CASCADE,
    "drawn_at" timestamp NOT NULL DEFAULT now(),
    "drawn_by" uuid REFERENCES "users"("id"),
    "is_invalidated" boolean NOT NULL DEFAULT false,
    "invalidated_at" timestamp,
    "invalidated_reason" text,
    "notified_at" timestamp,
    "notification_channel" varchar(20)
);
--> statement-breakpoint
-- Partial unique: enforces "one active winner row per (prize, entry)" while
-- allowing redraws to soft-invalidate and re-draw later if needed.
CREATE UNIQUE INDEX IF NOT EXISTS "prediction_winners_prize_entry_active_unique"
    ON "prediction_winners" ("prize_id","entry_id") WHERE "is_invalidated" = false;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prediction_winners_entry_idx"
    ON "prediction_winners" ("entry_id");
