DO $$
BEGIN
    CREATE TYPE "google_field_source" AS ENUM ('NONE', 'GOOGLE', 'MANUAL');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "venues"
    ADD COLUMN IF NOT EXISTS "description_source" "google_field_source" DEFAULT 'NONE' NOT NULL,
    ADD COLUMN IF NOT EXISTS "short_description_source" "google_field_source" DEFAULT 'NONE' NOT NULL,
    ADD COLUMN IF NOT EXISTS "price_range_source" "google_field_source" DEFAULT 'NONE' NOT NULL;

UPDATE "venues"
SET "description_source" = CASE
    WHEN COALESCE(TRIM("description"), '') <> '' THEN 'MANUAL'::"google_field_source"
    ELSE 'NONE'::"google_field_source"
END
WHERE "description_source" IS DISTINCT FROM CASE
    WHEN COALESCE(TRIM("description"), '') <> '' THEN 'MANUAL'::"google_field_source"
    ELSE 'NONE'::"google_field_source"
END;

UPDATE "venues"
SET "short_description_source" = CASE
    WHEN COALESCE(TRIM("short_description"), '') <> '' THEN 'MANUAL'::"google_field_source"
    ELSE 'NONE'::"google_field_source"
END
WHERE "short_description_source" IS DISTINCT FROM CASE
    WHEN COALESCE(TRIM("short_description"), '') <> '' THEN 'MANUAL'::"google_field_source"
    ELSE 'NONE'::"google_field_source"
END;

UPDATE "venues"
SET "price_range_source" = 'NONE'::"google_field_source"
WHERE "price_range_source" IS DISTINCT FROM 'NONE'::"google_field_source";
