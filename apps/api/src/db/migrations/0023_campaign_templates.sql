-- ─── Campaign templates (Phase 3 — jersey-party tooling) ────────────
-- Pre-built themed-event blueprints. A venue activates a template by
-- creating a venue_custom_events row with campaign_template_id set.

CREATE TABLE IF NOT EXISTS "campaign_templates" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "slug" varchar(80) NOT NULL,
    "title" varchar(160) NOT NULL,
    "description" text,
    "default_prizes" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "default_tags" text[] DEFAULT '{}'::text[] NOT NULL,
    "default_booking_notes" text,
    "default_contest_rules" text,
    "hero_image_url" varchar(500),
    "hero_image_s3_key" varchar(500),
    "category" varchar(60),
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "campaign_templates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "campaign_templates_category_idx" ON "campaign_templates" ("category");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaign_templates_active_idx" ON "campaign_templates" ("is_active");
--> statement-breakpoint

-- ─── venue_custom_events additions ───────────────────────────────────
-- All nullable / defaulted so existing rows are unaffected.

ALTER TABLE "venue_custom_events"
    ADD COLUMN IF NOT EXISTS "campaign_template_id" uuid REFERENCES "campaign_templates"("id");
--> statement-breakpoint
ALTER TABLE "venue_custom_events"
    ADD COLUMN IF NOT EXISTS "prizes" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "venue_custom_events"
    ADD COLUMN IF NOT EXISTS "contest_rules" text;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "venue_custom_events_template_idx"
    ON "venue_custom_events" ("campaign_template_id");
