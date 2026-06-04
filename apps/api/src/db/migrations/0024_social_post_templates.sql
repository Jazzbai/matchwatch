-- ─── Social post templates (Phase 4 — content calendar) ──────────
-- Pre-built post copy templates. Venue owners fill placeholders, then
-- copy the text + optionally download a rendered PNG to post manually.

CREATE TABLE IF NOT EXISTS "social_post_templates" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "slug" varchar(80) NOT NULL,
    "title" varchar(160) NOT NULL,
    "description" text,
    "category" varchar(60) NOT NULL,
    "copy_template" text NOT NULL,
    "image_template_s3_key" varchar(500),
    "placeholders" text[] DEFAULT '{}'::text[] NOT NULL,
    "default_match_phase" varchar(40),
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "social_post_templates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "social_post_templates_category_idx"
    ON "social_post_templates" ("category");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "social_post_templates_active_idx"
    ON "social_post_templates" ("is_active");
--> statement-breakpoint

-- ─── posts additions ─────────────────────────────────────────────
-- Nullable / defaulted so existing posts are untouched.

ALTER TABLE "posts"
    ADD COLUMN IF NOT EXISTS "template_id" uuid REFERENCES "social_post_templates"("id");
--> statement-breakpoint
ALTER TABLE "posts"
    ADD COLUMN IF NOT EXISTS "rendered_image_s3_key" varchar(500);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "posts_template_idx" ON "posts" ("template_id");
