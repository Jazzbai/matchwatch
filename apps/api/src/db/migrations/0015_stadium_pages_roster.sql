ALTER TABLE "stadiums" ADD COLUMN IF NOT EXISTS "slug" varchar(180);
ALTER TABLE "stadiums" ADD COLUMN IF NOT EXISTS "short_name" varchar(80);
ALTER TABLE "stadiums" ADD COLUMN IF NOT EXISTS "image_url" varchar;
ALTER TABLE "stadiums" ADD COLUMN IF NOT EXISTS "hero_image_url" varchar;
ALTER TABLE "stadiums" ADD COLUMN IF NOT EXISTS "short_description" varchar(280);
ALTER TABLE "stadiums" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "stadiums" ADD COLUMN IF NOT EXISTS "website" varchar(255);
ALTER TABLE "stadiums" ADD COLUMN IF NOT EXISTS "address_line1" varchar(255);
ALTER TABLE "stadiums" ADD COLUMN IF NOT EXISTS "state_province" varchar(100);
ALTER TABLE "stadiums" ADD COLUMN IF NOT EXISTS "postal_code" varchar(20);
ALTER TABLE "stadiums" ADD COLUMN IF NOT EXISTS "lat" numeric(10, 8);
ALTER TABLE "stadiums" ADD COLUMN IF NOT EXISTS "lng" numeric(11, 8);
ALTER TABLE "stadiums" ADD COLUMN IF NOT EXISTS "capacity" integer;
ALTER TABLE "stadiums" ADD COLUMN IF NOT EXISTS "opened_year" integer;
ALTER TABLE "stadiums" ADD COLUMN IF NOT EXISTS "surface" varchar(80);
ALTER TABLE "stadiums" ADD COLUMN IF NOT EXISTS "aliases" text[] DEFAULT '{}'::text[] NOT NULL;
ALTER TABLE "stadiums" ADD COLUMN IF NOT EXISTS "social_links" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "stadiums" ADD COLUMN IF NOT EXISTS "enrichment_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "stadiums" ADD COLUMN IF NOT EXISTS "enriched_at" timestamp;
ALTER TABLE "stadiums" ADD COLUMN IF NOT EXISTS "enrichment_status" "enrichment_status" DEFAULT 'NEVER_SYNCED' NOT NULL;
ALTER TABLE "stadiums" ADD COLUMN IF NOT EXISTS "enrichment_error" text;
ALTER TABLE "stadiums" ADD COLUMN IF NOT EXISTS "short_description_source" "google_field_source" DEFAULT 'NONE' NOT NULL;
ALTER TABLE "stadiums" ADD COLUMN IF NOT EXISTS "description_source" "google_field_source" DEFAULT 'NONE' NOT NULL;
ALTER TABLE "stadiums" ADD COLUMN IF NOT EXISTS "image_source" "google_field_source" DEFAULT 'NONE' NOT NULL;
ALTER TABLE "stadiums" ADD COLUMN IF NOT EXISTS "hero_image_source" "google_field_source" DEFAULT 'NONE' NOT NULL;
ALTER TABLE "stadiums" ADD COLUMN IF NOT EXISTS "website_source" "google_field_source" DEFAULT 'NONE' NOT NULL;
ALTER TABLE "stadiums" ADD COLUMN IF NOT EXISTS "google_place_id" varchar(255);
ALTER TABLE "stadiums" ADD COLUMN IF NOT EXISTS "google_source_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "stadiums" ADD COLUMN IF NOT EXISTS "google_last_synced_at" timestamp;
ALTER TABLE "stadiums" ADD COLUMN IF NOT EXISTS "google_sync_status" "google_sync_status" DEFAULT 'NEVER_SYNCED' NOT NULL;
ALTER TABLE "stadiums" ADD COLUMN IF NOT EXISTS "google_sync_error" text;

UPDATE "stadiums"
SET "slug" = CONCAT(
    COALESCE(NULLIF(TRIM(BOTH '-' FROM regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')), ''), 'stadium'),
    '-',
    substring(id::text from 1 for 8)
)
WHERE "slug" IS NULL OR trim("slug") = '';

ALTER TABLE "stadiums" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "stadiums_slug_unique" ON "stadiums" ("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "stadiums_google_place_id_unique" ON "stadiums" ("google_place_id");

ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "primary_stadium_id" uuid;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teams_primary_stadium_id_stadiums_id_fk') THEN
        ALTER TABLE "teams"
            ADD CONSTRAINT "teams_primary_stadium_id_stadiums_id_fk"
            FOREIGN KEY ("primary_stadium_id") REFERENCES "public"."stadiums"("id") ON DELETE set null ON UPDATE no action;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "teams_primary_stadium_idx" ON "teams" ("primary_stadium_id");

CREATE TABLE IF NOT EXISTS "team_stadium_links" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "team_id" uuid NOT NULL,
    "stadium_id" uuid NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_stadium_links_team_id_teams_id_fk') THEN
        ALTER TABLE "team_stadium_links"
            ADD CONSTRAINT "team_stadium_links_team_id_teams_id_fk"
            FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_stadium_links_stadium_id_stadiums_id_fk') THEN
        ALTER TABLE "team_stadium_links"
            ADD CONSTRAINT "team_stadium_links_stadium_id_stadiums_id_fk"
            FOREIGN KEY ("stadium_id") REFERENCES "public"."stadiums"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "team_stadium_links_team_stadium_unique" ON "team_stadium_links" ("team_id", "stadium_id");
CREATE INDEX IF NOT EXISTS "team_stadium_links_team_idx" ON "team_stadium_links" ("team_id");
CREATE INDEX IF NOT EXISTS "team_stadium_links_stadium_idx" ON "team_stadium_links" ("stadium_id");

CREATE TABLE IF NOT EXISTS "team_roster_members" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "team_id" uuid NOT NULL,
    "player_id" uuid NOT NULL,
    "shirt_number" varchar(12),
    "position" varchar(60),
    "is_captain" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_roster_members_team_id_teams_id_fk') THEN
        ALTER TABLE "team_roster_members"
            ADD CONSTRAINT "team_roster_members_team_id_teams_id_fk"
            FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_roster_members_player_id_players_id_fk') THEN
        ALTER TABLE "team_roster_members"
            ADD CONSTRAINT "team_roster_members_player_id_players_id_fk"
            FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "team_roster_members_team_player_unique" ON "team_roster_members" ("team_id", "player_id");
CREATE INDEX IF NOT EXISTS "team_roster_members_team_idx" ON "team_roster_members" ("team_id");
CREATE INDEX IF NOT EXISTS "team_roster_members_player_idx" ON "team_roster_members" ("player_id");

WITH ranked AS (
    SELECT
        m.home_team_id AS team_id,
        m.stadium_id,
        COUNT(*)::integer AS match_count,
        ROW_NUMBER() OVER (PARTITION BY m.home_team_id ORDER BY COUNT(*) DESC, m.stadium_id) AS rn,
        LEAD(COUNT(*)::integer) OVER (PARTITION BY m.home_team_id ORDER BY COUNT(*) DESC, m.stadium_id) AS next_match_count
    FROM "matches" m
    WHERE m.home_team_id IS NOT NULL
      AND m.stadium_id IS NOT NULL
    GROUP BY m.home_team_id, m.stadium_id
)
UPDATE "teams" t
SET "primary_stadium_id" = ranked.stadium_id
FROM ranked
WHERE t.id = ranked.team_id
  AND t."primary_stadium_id" IS NULL
  AND ranked.rn = 1
  AND (ranked.next_match_count IS NULL OR ranked.match_count > ranked.next_match_count);

INSERT INTO "team_stadium_links" ("team_id", "stadium_id", "is_primary", "sort_order", "is_active")
SELECT DISTINCT
    source.team_id,
    source.stadium_id,
    CASE WHEN t."primary_stadium_id" = source.stadium_id THEN true ELSE false END AS is_primary,
    CASE WHEN t."primary_stadium_id" = source.stadium_id THEN 0 ELSE 10 END AS sort_order,
    true
FROM (
    SELECT m."home_team_id" AS team_id, m."stadium_id" AS stadium_id
    FROM "matches" m
    WHERE m."home_team_id" IS NOT NULL AND m."stadium_id" IS NOT NULL
    UNION
    SELECT t."id" AS team_id, t."primary_stadium_id" AS stadium_id
    FROM "teams" t
    WHERE t."primary_stadium_id" IS NOT NULL
) source
INNER JOIN "teams" t ON t."id" = source.team_id
ON CONFLICT ("team_id", "stadium_id") DO NOTHING;
