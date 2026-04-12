ALTER TABLE IF EXISTS "players"
    ADD COLUMN IF NOT EXISTS "slug" varchar(180),
    ADD COLUMN IF NOT EXISTS "short_name" varchar(60),
    ADD COLUMN IF NOT EXISTS "nationality" varchar(80),
    ADD COLUMN IF NOT EXISTS "country_code" varchar(3),
    ADD COLUMN IF NOT EXISTS "headshot_url" varchar,
    ADD COLUMN IF NOT EXISTS "hero_image_url" varchar,
    ADD COLUMN IF NOT EXISTS "short_description" varchar(280),
    ADD COLUMN IF NOT EXISTS "description" text,
    ADD COLUMN IF NOT EXISTS "website" varchar(255),
    ADD COLUMN IF NOT EXISTS "social_links" jsonb DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS "aliases" text[] DEFAULT '{}'::text[],
    ADD COLUMN IF NOT EXISTS "enrichment_snapshot" jsonb DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS "enriched_at" timestamp,
    ADD COLUMN IF NOT EXISTS "enrichment_status" "enrichment_status" DEFAULT 'NEVER_SYNCED',
    ADD COLUMN IF NOT EXISTS "enrichment_error" text,
    ADD COLUMN IF NOT EXISTS "short_description_source" "google_field_source" DEFAULT 'NONE',
    ADD COLUMN IF NOT EXISTS "description_source" "google_field_source" DEFAULT 'NONE',
    ADD COLUMN IF NOT EXISTS "headshot_source" "google_field_source" DEFAULT 'NONE',
    ADD COLUMN IF NOT EXISTS "hero_image_source" "google_field_source" DEFAULT 'NONE',
    ADD COLUMN IF NOT EXISTS "website_source" "google_field_source" DEFAULT 'NONE',
    ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true,
    ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now(),
    ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();

UPDATE "players" SET "social_links" = '[]'::jsonb WHERE "social_links" IS NULL;
UPDATE "players" SET "aliases" = '{}'::text[] WHERE "aliases" IS NULL;
UPDATE "players" SET "enrichment_snapshot" = '{}'::jsonb WHERE "enrichment_snapshot" IS NULL;
UPDATE "players" SET "enrichment_status" = 'NEVER_SYNCED' WHERE "enrichment_status" IS NULL;
UPDATE "players" SET "short_description_source" = 'NONE' WHERE "short_description_source" IS NULL;
UPDATE "players" SET "description_source" = 'NONE' WHERE "description_source" IS NULL;
UPDATE "players" SET "headshot_source" = 'NONE' WHERE "headshot_source" IS NULL;
UPDATE "players" SET "hero_image_source" = 'NONE' WHERE "hero_image_source" IS NULL;
UPDATE "players" SET "website_source" = 'NONE' WHERE "website_source" IS NULL;
UPDATE "players" SET "is_active" = true WHERE "is_active" IS NULL;
UPDATE "players" SET "created_at" = now() WHERE "created_at" IS NULL;
UPDATE "players" SET "updated_at" = COALESCE("updated_at", "created_at", now()) WHERE "updated_at" IS NULL;

WITH prepared AS (
    SELECT
        "id",
        COALESCE(
            NULLIF(trim(both '-' from regexp_replace(lower(COALESCE("slug", '')), '[^a-z0-9]+', '-', 'g')), ''),
            NULLIF(trim(both '-' from regexp_replace(lower(COALESCE("name", '')), '[^a-z0-9]+', '-', 'g')), ''),
            'player'
        ) AS "base_slug",
        "created_at"
    FROM "players"
),
ranked AS (
    SELECT
        "id",
        CASE
            WHEN row_number() OVER (PARTITION BY "base_slug" ORDER BY "created_at" NULLS LAST, "id") = 1
                THEN left("base_slug", 180)
            ELSE left("base_slug", 171) || '-' || substr(replace("id"::text, '-', ''), 1, 8)
        END AS "resolved_slug"
    FROM prepared
)
UPDATE "players" AS p
SET "slug" = ranked."resolved_slug"
FROM ranked
WHERE p."id" = ranked."id"
  AND p."slug" IS DISTINCT FROM ranked."resolved_slug";

ALTER TABLE IF EXISTS "players"
    ALTER COLUMN "social_links" SET DEFAULT '[]'::jsonb,
    ALTER COLUMN "aliases" SET DEFAULT '{}'::text[],
    ALTER COLUMN "enrichment_snapshot" SET DEFAULT '{}'::jsonb,
    ALTER COLUMN "enrichment_status" SET DEFAULT 'NEVER_SYNCED',
    ALTER COLUMN "short_description_source" SET DEFAULT 'NONE',
    ALTER COLUMN "description_source" SET DEFAULT 'NONE',
    ALTER COLUMN "headshot_source" SET DEFAULT 'NONE',
    ALTER COLUMN "hero_image_source" SET DEFAULT 'NONE',
    ALTER COLUMN "website_source" SET DEFAULT 'NONE',
    ALTER COLUMN "is_active" SET DEFAULT true,
    ALTER COLUMN "created_at" SET DEFAULT now(),
    ALTER COLUMN "updated_at" SET DEFAULT now(),
    ALTER COLUMN "slug" SET NOT NULL,
    ALTER COLUMN "enrichment_status" SET NOT NULL,
    ALTER COLUMN "short_description_source" SET NOT NULL,
    ALTER COLUMN "description_source" SET NOT NULL,
    ALTER COLUMN "headshot_source" SET NOT NULL,
    ALTER COLUMN "hero_image_source" SET NOT NULL,
    ALTER COLUMN "website_source" SET NOT NULL,
    ALTER COLUMN "is_active" SET NOT NULL,
    ALTER COLUMN "created_at" SET NOT NULL,
    ALTER COLUMN "updated_at" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "players_slug_unique" ON "players" ("slug");
