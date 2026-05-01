DO $$
BEGIN
    CREATE TYPE "youtube_search_status" AS ENUM ('pending', 'found', 'not_found', 'failed');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "matches"
    ADD COLUMN IF NOT EXISTS "youtube_video_id" varchar(32),
    ADD COLUMN IF NOT EXISTS "youtube_video_title" varchar(255),
    ADD COLUMN IF NOT EXISTS "youtube_channel_title" varchar(255),
    ADD COLUMN IF NOT EXISTS "youtube_published_at" timestamp,
    ADD COLUMN IF NOT EXISTS "youtube_thumbnail_url" varchar,
    ADD COLUMN IF NOT EXISTS "youtube_embed_url" varchar,
    ADD COLUMN IF NOT EXISTS "youtube_search_status" "youtube_search_status" NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS "youtube_checked_at" timestamp;

CREATE INDEX IF NOT EXISTS "matches_youtube_status_checked_idx"
    ON "matches" ("youtube_search_status", "youtube_checked_at");

UPDATE "matches"
SET
    "youtube_search_status" = CASE
        WHEN "youtube_video_id" IS NOT NULL THEN 'found'::"youtube_search_status"
        ELSE "youtube_search_status"
    END,
    "youtube_checked_at" = CASE
        WHEN "youtube_video_id" IS NOT NULL THEN COALESCE("youtube_checked_at", now())
        ELSE "youtube_checked_at"
    END;
