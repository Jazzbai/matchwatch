DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enrichment_status') THEN
        CREATE TYPE "enrichment_status" AS ENUM ('NEVER_SYNCED', 'SYNCED', 'ERROR');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'participant_type') THEN
        CREATE TYPE "participant_type" AS ENUM ('TEAM', 'PLAYER');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'standings_table_type') THEN
        CREATE TYPE "standings_table_type" AS ENUM ('TEAM', 'PLAYER', 'DRIVER', 'ENTRANT', 'MANUFACTURER');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'standings_subject_type') THEN
        CREATE TYPE "standings_subject_type" AS ENUM ('TEAM', 'PLAYER', 'DRIVER', 'ENTRANT', 'MANUFACTURER');
    END IF;
END $$;

ALTER TABLE "leagues"
    ADD COLUMN IF NOT EXISTS "slug" varchar(160),
    ADD COLUMN IF NOT EXISTS "hero_image_url" varchar,
    ADD COLUMN IF NOT EXISTS "short_description" varchar(280),
    ADD COLUMN IF NOT EXISTS "description" text,
    ADD COLUMN IF NOT EXISTS "website" varchar(255),
    ADD COLUMN IF NOT EXISTS "social_links" jsonb DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS "aliases" text[] DEFAULT '{}'::text[],
    ADD COLUMN IF NOT EXISTS "enrichment_snapshot" jsonb DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS "enriched_at" timestamp,
    ADD COLUMN IF NOT EXISTS "enrichment_status" "enrichment_status" DEFAULT 'NEVER_SYNCED' NOT NULL,
    ADD COLUMN IF NOT EXISTS "enrichment_error" text,
    ADD COLUMN IF NOT EXISTS "short_description_source" "google_field_source" DEFAULT 'NONE' NOT NULL,
    ADD COLUMN IF NOT EXISTS "description_source" "google_field_source" DEFAULT 'NONE' NOT NULL,
    ADD COLUMN IF NOT EXISTS "logo_source" "google_field_source" DEFAULT 'NONE' NOT NULL,
    ADD COLUMN IF NOT EXISTS "hero_image_source" "google_field_source" DEFAULT 'NONE' NOT NULL,
    ADD COLUMN IF NOT EXISTS "website_source" "google_field_source" DEFAULT 'NONE' NOT NULL;

ALTER TABLE "teams"
    ADD COLUMN IF NOT EXISTS "slug" varchar(180),
    ADD COLUMN IF NOT EXISTS "hero_image_url" varchar,
    ADD COLUMN IF NOT EXISTS "short_description" varchar(280),
    ADD COLUMN IF NOT EXISTS "description" text,
    ADD COLUMN IF NOT EXISTS "website" varchar(255),
    ADD COLUMN IF NOT EXISTS "country" varchar(80),
    ADD COLUMN IF NOT EXISTS "social_links" jsonb DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS "aliases" text[] DEFAULT '{}'::text[],
    ADD COLUMN IF NOT EXISTS "enrichment_snapshot" jsonb DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS "enriched_at" timestamp,
    ADD COLUMN IF NOT EXISTS "enrichment_status" "enrichment_status" DEFAULT 'NEVER_SYNCED' NOT NULL,
    ADD COLUMN IF NOT EXISTS "enrichment_error" text,
    ADD COLUMN IF NOT EXISTS "short_description_source" "google_field_source" DEFAULT 'NONE' NOT NULL,
    ADD COLUMN IF NOT EXISTS "description_source" "google_field_source" DEFAULT 'NONE' NOT NULL,
    ADD COLUMN IF NOT EXISTS "crest_source" "google_field_source" DEFAULT 'NONE' NOT NULL,
    ADD COLUMN IF NOT EXISTS "hero_image_source" "google_field_source" DEFAULT 'NONE' NOT NULL,
    ADD COLUMN IF NOT EXISTS "website_source" "google_field_source" DEFAULT 'NONE' NOT NULL;

ALTER TABLE "drivers"
    ADD COLUMN IF NOT EXISTS "slug" varchar(180),
    ADD COLUMN IF NOT EXISTS "hero_image_url" varchar,
    ADD COLUMN IF NOT EXISTS "short_description" varchar(280),
    ADD COLUMN IF NOT EXISTS "description" text,
    ADD COLUMN IF NOT EXISTS "website" varchar(255),
    ADD COLUMN IF NOT EXISTS "social_links" jsonb DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS "aliases" text[] DEFAULT '{}'::text[],
    ADD COLUMN IF NOT EXISTS "enrichment_snapshot" jsonb DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS "enriched_at" timestamp,
    ADD COLUMN IF NOT EXISTS "enrichment_status" "enrichment_status" DEFAULT 'NEVER_SYNCED' NOT NULL,
    ADD COLUMN IF NOT EXISTS "enrichment_error" text,
    ADD COLUMN IF NOT EXISTS "short_description_source" "google_field_source" DEFAULT 'NONE' NOT NULL,
    ADD COLUMN IF NOT EXISTS "description_source" "google_field_source" DEFAULT 'NONE' NOT NULL,
    ADD COLUMN IF NOT EXISTS "headshot_source" "google_field_source" DEFAULT 'NONE' NOT NULL,
    ADD COLUMN IF NOT EXISTS "hero_image_source" "google_field_source" DEFAULT 'NONE' NOT NULL,
    ADD COLUMN IF NOT EXISTS "website_source" "google_field_source" DEFAULT 'NONE' NOT NULL;

ALTER TABLE "entrants"
    ADD COLUMN IF NOT EXISTS "slug" varchar(180),
    ADD COLUMN IF NOT EXISTS "hero_image_url" varchar,
    ADD COLUMN IF NOT EXISTS "short_description" varchar(280),
    ADD COLUMN IF NOT EXISTS "description" text,
    ADD COLUMN IF NOT EXISTS "website" varchar(255),
    ADD COLUMN IF NOT EXISTS "social_links" jsonb DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS "aliases" text[] DEFAULT '{}'::text[],
    ADD COLUMN IF NOT EXISTS "enrichment_snapshot" jsonb DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS "enriched_at" timestamp,
    ADD COLUMN IF NOT EXISTS "enrichment_status" "enrichment_status" DEFAULT 'NEVER_SYNCED' NOT NULL,
    ADD COLUMN IF NOT EXISTS "enrichment_error" text,
    ADD COLUMN IF NOT EXISTS "short_description_source" "google_field_source" DEFAULT 'NONE' NOT NULL,
    ADD COLUMN IF NOT EXISTS "description_source" "google_field_source" DEFAULT 'NONE' NOT NULL,
    ADD COLUMN IF NOT EXISTS "logo_source" "google_field_source" DEFAULT 'NONE' NOT NULL,
    ADD COLUMN IF NOT EXISTS "hero_image_source" "google_field_source" DEFAULT 'NONE' NOT NULL,
    ADD COLUMN IF NOT EXISTS "website_source" "google_field_source" DEFAULT 'NONE' NOT NULL;

ALTER TABLE "manufacturers"
    ADD COLUMN IF NOT EXISTS "slug" varchar(180),
    ADD COLUMN IF NOT EXISTS "hero_image_url" varchar,
    ADD COLUMN IF NOT EXISTS "short_description" varchar(280),
    ADD COLUMN IF NOT EXISTS "description" text,
    ADD COLUMN IF NOT EXISTS "website" varchar(255),
    ADD COLUMN IF NOT EXISTS "social_links" jsonb DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS "aliases" text[] DEFAULT '{}'::text[],
    ADD COLUMN IF NOT EXISTS "enrichment_snapshot" jsonb DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS "enriched_at" timestamp,
    ADD COLUMN IF NOT EXISTS "enrichment_status" "enrichment_status" DEFAULT 'NEVER_SYNCED' NOT NULL,
    ADD COLUMN IF NOT EXISTS "enrichment_error" text,
    ADD COLUMN IF NOT EXISTS "short_description_source" "google_field_source" DEFAULT 'NONE' NOT NULL,
    ADD COLUMN IF NOT EXISTS "description_source" "google_field_source" DEFAULT 'NONE' NOT NULL,
    ADD COLUMN IF NOT EXISTS "logo_source" "google_field_source" DEFAULT 'NONE' NOT NULL,
    ADD COLUMN IF NOT EXISTS "hero_image_source" "google_field_source" DEFAULT 'NONE' NOT NULL,
    ADD COLUMN IF NOT EXISTS "website_source" "google_field_source" DEFAULT 'NONE' NOT NULL;

ALTER TABLE "matches"
    ADD COLUMN IF NOT EXISTS "season_id" uuid;

CREATE TABLE IF NOT EXISTS "players" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "external_id" varchar(80),
    "sport_id" uuid,
    "league_id" uuid,
    "name" varchar(150) NOT NULL,
    "slug" varchar(180) NOT NULL,
    "short_name" varchar(60),
    "nationality" varchar(80),
    "country_code" varchar(3),
    "headshot_url" varchar,
    "hero_image_url" varchar,
    "short_description" varchar(280),
    "description" text,
    "website" varchar(255),
    "social_links" jsonb DEFAULT '[]'::jsonb,
    "aliases" text[] DEFAULT '{}'::text[],
    "enrichment_snapshot" jsonb DEFAULT '{}'::jsonb,
    "enriched_at" timestamp,
    "enrichment_status" "enrichment_status" DEFAULT 'NEVER_SYNCED' NOT NULL,
    "enrichment_error" text,
    "short_description_source" "google_field_source" DEFAULT 'NONE' NOT NULL,
    "description_source" "google_field_source" DEFAULT 'NONE' NOT NULL,
    "headshot_source" "google_field_source" DEFAULT 'NONE' NOT NULL,
    "hero_image_source" "google_field_source" DEFAULT 'NONE' NOT NULL,
    "website_source" "google_field_source" DEFAULT 'NONE' NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "players_external_id_unique" UNIQUE("external_id"),
    CONSTRAINT "players_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "league_seasons" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "league_id" uuid NOT NULL,
    "label" varchar(120) NOT NULL,
    "year" integer,
    "external_id" varchar(80),
    "starts_at" timestamp,
    "ends_at" timestamp,
    "is_current" boolean DEFAULT false NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "match_participants" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "match_id" uuid NOT NULL,
    "participant_type" "participant_type" NOT NULL,
    "team_id" uuid,
    "player_id" uuid,
    "side" varchar(20),
    "display_order" integer DEFAULT 0 NOT NULL,
    "display_name" varchar(160),
    "image_url" varchar,
    "score" integer,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "standings_snapshots" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "league_id" uuid NOT NULL,
    "season_id" uuid,
    "table_type" "standings_table_type" DEFAULT 'TEAM' NOT NULL,
    "source" varchar(40) DEFAULT 'INTERNAL' NOT NULL,
    "generated_at" timestamp DEFAULT now() NOT NULL,
    "metadata" jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS "standings_rows" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "snapshot_id" uuid NOT NULL,
    "subject_type" "standings_subject_type" NOT NULL,
    "team_id" uuid,
    "player_id" uuid,
    "driver_id" uuid,
    "entrant_id" uuid,
    "manufacturer_id" uuid,
    "rank" integer NOT NULL,
    "played" integer DEFAULT 0 NOT NULL,
    "wins" integer DEFAULT 0 NOT NULL,
    "draws" integer DEFAULT 0 NOT NULL,
    "losses" integer DEFAULT 0 NOT NULL,
    "goals_for" integer DEFAULT 0 NOT NULL,
    "goals_against" integer DEFAULT 0 NOT NULL,
    "goal_difference" integer DEFAULT 0 NOT NULL,
    "points" numeric(8, 2) DEFAULT 0 NOT NULL,
    "form" varchar(20),
    "metadata" jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS "static_pages" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "slug" varchar(120) NOT NULL,
    "title" varchar(200) NOT NULL,
    "excerpt" varchar(500),
    "content_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "content_html" text DEFAULT '' NOT NULL,
    "status" "blog_publish_status" DEFAULT 'DRAFT' NOT NULL,
    "seo_title" varchar(220),
    "seo_description" varchar(320),
    "published_at" timestamp,
    "updated_by" uuid,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "static_pages_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "match_predictions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "match_id" uuid NOT NULL,
    "model_version" varchar(40) NOT NULL,
    "home_win_probability" numeric(5, 4),
    "draw_probability" numeric(5, 4),
    "away_win_probability" numeric(5, 4),
    "explanation_facts" jsonb DEFAULT '[]'::jsonb,
    "confidence" numeric(5, 4),
    "is_display_enabled" boolean DEFAULT true NOT NULL,
    "generated_at" timestamp DEFAULT now() NOT NULL,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT "match_predictions_match_unique" UNIQUE("match_id")
);

ALTER TABLE "matches"
    ADD CONSTRAINT IF NOT EXISTS "matches_season_id_league_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."league_seasons"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "players"
    ADD CONSTRAINT IF NOT EXISTS "players_sport_id_sports_id_fk" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE no action ON UPDATE no action,
    ADD CONSTRAINT IF NOT EXISTS "players_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "league_seasons"
    ADD CONSTRAINT IF NOT EXISTS "league_seasons_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "match_participants"
    ADD CONSTRAINT IF NOT EXISTS "match_participants_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action,
    ADD CONSTRAINT IF NOT EXISTS "match_participants_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action,
    ADD CONSTRAINT IF NOT EXISTS "match_participants_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "standings_snapshots"
    ADD CONSTRAINT IF NOT EXISTS "standings_snapshots_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action,
    ADD CONSTRAINT IF NOT EXISTS "standings_snapshots_season_id_league_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."league_seasons"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "standings_rows"
    ADD CONSTRAINT IF NOT EXISTS "standings_rows_snapshot_id_standings_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."standings_snapshots"("id") ON DELETE cascade ON UPDATE no action,
    ADD CONSTRAINT IF NOT EXISTS "standings_rows_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action,
    ADD CONSTRAINT IF NOT EXISTS "standings_rows_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action,
    ADD CONSTRAINT IF NOT EXISTS "standings_rows_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action,
    ADD CONSTRAINT IF NOT EXISTS "standings_rows_entrant_id_entrants_id_fk" FOREIGN KEY ("entrant_id") REFERENCES "public"."entrants"("id") ON DELETE no action ON UPDATE no action,
    ADD CONSTRAINT IF NOT EXISTS "standings_rows_manufacturer_id_manufacturers_id_fk" FOREIGN KEY ("manufacturer_id") REFERENCES "public"."manufacturers"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "static_pages"
    ADD CONSTRAINT IF NOT EXISTS "static_pages_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "match_predictions"
    ADD CONSTRAINT IF NOT EXISTS "match_predictions_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "players_sport_idx" ON "players" ("sport_id");
CREATE INDEX IF NOT EXISTS "players_league_idx" ON "players" ("league_id");
CREATE INDEX IF NOT EXISTS "players_name_idx" ON "players" ("name");
CREATE INDEX IF NOT EXISTS "league_seasons_league_idx" ON "league_seasons" ("league_id");
CREATE INDEX IF NOT EXISTS "league_seasons_current_idx" ON "league_seasons" ("is_current");
CREATE INDEX IF NOT EXISTS "match_participants_match_idx" ON "match_participants" ("match_id");
CREATE INDEX IF NOT EXISTS "match_participants_team_idx" ON "match_participants" ("team_id");
CREATE INDEX IF NOT EXISTS "match_participants_player_idx" ON "match_participants" ("player_id");
CREATE INDEX IF NOT EXISTS "standings_snapshots_league_idx" ON "standings_snapshots" ("league_id");
CREATE INDEX IF NOT EXISTS "standings_snapshots_season_idx" ON "standings_snapshots" ("season_id");
CREATE INDEX IF NOT EXISTS "standings_rows_snapshot_idx" ON "standings_rows" ("snapshot_id");
CREATE INDEX IF NOT EXISTS "standings_rows_rank_idx" ON "standings_rows" ("rank");
CREATE INDEX IF NOT EXISTS "static_pages_status_idx" ON "static_pages" ("status");
CREATE UNIQUE INDEX IF NOT EXISTS "leagues_slug_unique" ON "leagues" ("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "teams_slug_unique" ON "teams" ("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "drivers_slug_unique" ON "drivers" ("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "entrants_slug_unique" ON "entrants" ("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "manufacturers_slug_unique" ON "manufacturers" ("slug");

UPDATE "leagues"
SET "slug" = CONCAT(
    COALESCE(NULLIF(TRIM(BOTH '-' FROM regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')), ''), 'league'),
    '-',
    substring(id::text, 1, 8)
)
WHERE "slug" IS NULL OR trim("slug") = '';

UPDATE "teams"
SET "slug" = CONCAT(
    COALESCE(NULLIF(TRIM(BOTH '-' FROM regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')), ''), 'team'),
    '-',
    substring(id::text, 1, 8)
)
WHERE "slug" IS NULL OR trim("slug") = '';

UPDATE "drivers"
SET "slug" = CONCAT(
    COALESCE(NULLIF(TRIM(BOTH '-' FROM regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')), ''), 'driver'),
    '-',
    substring(id::text, 1, 8)
)
WHERE "slug" IS NULL OR trim("slug") = '';

UPDATE "entrants"
SET "slug" = CONCAT(
    COALESCE(NULLIF(TRIM(BOTH '-' FROM regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')), ''), 'entrant'),
    '-',
    substring(id::text, 1, 8)
)
WHERE "slug" IS NULL OR trim("slug") = '';

UPDATE "manufacturers"
SET "slug" = CONCAT(
    COALESCE(NULLIF(TRIM(BOTH '-' FROM regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')), ''), 'manufacturer'),
    '-',
    substring(id::text, 1, 8)
)
WHERE "slug" IS NULL OR trim("slug") = '';

ALTER TABLE "leagues" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "teams" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "drivers" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "entrants" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "manufacturers" ALTER COLUMN "slug" SET NOT NULL;

INSERT INTO "league_seasons" ("league_id", "label", "year", "starts_at", "ends_at", "is_current")
SELECT l.id, CONCAT(EXTRACT(YEAR FROM CURRENT_DATE)::int, ' Season'), EXTRACT(YEAR FROM CURRENT_DATE)::int,
       date_trunc('year', CURRENT_DATE)::timestamp,
       (date_trunc('year', CURRENT_DATE) + interval '1 year' - interval '1 day')::timestamp,
       true
FROM "leagues" l
WHERE NOT EXISTS (
    SELECT 1 FROM "league_seasons" s WHERE s.league_id = l.id
);

UPDATE "matches" m
SET "season_id" = s.id
FROM "league_seasons" s
WHERE m.league_id = s.league_id
  AND s.is_current = true
  AND m.season_id IS NULL;

INSERT INTO "match_participants" ("match_id", "participant_type", "team_id", "side", "display_order", "display_name", "image_url", "score")
SELECT m.id, 'TEAM'::"participant_type", m.home_team_id, 'HOME', 0, COALESCE(m.home_team_name, t.name), COALESCE(m.home_team_crest_url, t.crest_url), m.home_score
FROM "matches" m
LEFT JOIN "teams" t ON t.id = m.home_team_id
WHERE m.event_format = 'HEAD_TO_HEAD'
  AND m.home_team_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM "match_participants" mp WHERE mp.match_id = m.id AND mp.team_id = m.home_team_id
  );

INSERT INTO "match_participants" ("match_id", "participant_type", "team_id", "side", "display_order", "display_name", "image_url", "score")
SELECT m.id, 'TEAM'::"participant_type", m.away_team_id, 'AWAY', 1, COALESCE(m.away_team_name, t.name), COALESCE(m.away_team_crest_url, t.crest_url), m.away_score
FROM "matches" m
LEFT JOIN "teams" t ON t.id = m.away_team_id
WHERE m.event_format = 'HEAD_TO_HEAD'
  AND m.away_team_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM "match_participants" mp WHERE mp.match_id = m.id AND mp.team_id = m.away_team_id
  );

INSERT INTO "static_pages" ("slug", "title", "excerpt", "content_html", "status", "seo_title", "seo_description", "published_at")
VALUES
    ('about', 'About MatchWatch', 'Learn what MatchWatch does and why it exists.', '<h1>About MatchWatch</h1><p>MatchWatch helps fans discover where to watch sports, follow teams and leagues, and find venue experiences around major fixtures.</p>', 'PUBLISHED', 'About MatchWatch', 'Learn about MatchWatch, the sports watchparty and venue discovery platform.', now()),
    ('terms', 'Terms of Service', 'Terms governing use of MatchWatch.', '<h1>Terms of Service</h1><p>These terms govern access to MatchWatch, venue listings, account use, and platform participation.</p>', 'PUBLISHED', 'Terms of Service', 'Read the MatchWatch terms of service.', now()),
    ('privacy', 'Privacy Policy', 'How MatchWatch collects and uses data.', '<h1>Privacy Policy</h1><p>This page explains what information MatchWatch collects, how it is used, and what rights users have.</p>', 'PUBLISHED', 'Privacy Policy', 'Read the MatchWatch privacy policy.', now())
ON CONFLICT ("slug") DO NOTHING;
