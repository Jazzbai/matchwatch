-- ─── Match Point singleton settings (slug='default') ───
-- Drives prize copy + active flag on the public Match Point pages.

CREATE TABLE IF NOT EXISTS "matchpoint_settings" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "slug" varchar(50) DEFAULT 'default' NOT NULL,
    "prize_name" varchar(200) DEFAULT 'Mercedes-Benz C300' NOT NULL,
    "prize_description" text,
    "prize_image_url" varchar(500),
    "hero_subtitle" text,
    "is_active" boolean DEFAULT true NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "matchpoint_settings_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint

INSERT INTO "matchpoint_settings" ("slug", "prize_name", "prize_description", "hero_subtitle")
VALUES (
    'default',
    'Mercedes-Benz C300',
    'Top point earners across the tournament enter a grand-prize sweepstakes to win a Mercedes-Benz C300.',
    'Scan the QR at a host venue, pick the winner, and call the exact score. Top scorers play for the Mercedes-Benz C300 grand prize.'
)
ON CONFLICT (slug) DO NOTHING;
