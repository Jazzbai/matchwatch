ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "vibes" text[] DEFAULT '{}' NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "public"."venue_attribute_type" AS ENUM('AMENITY', 'VIBE', 'CUISINE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "venue_attributes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "venue_attribute_type" NOT NULL,
	"label" varchar(80) NOT NULL,
	"slug" varchar(80) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "venue_attributes_type_slug_unique" ON "venue_attributes" USING btree ("type","slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "venue_attributes_type_idx" ON "venue_attributes" USING btree ("type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "venue_attributes_active_idx" ON "venue_attributes" USING btree ("is_active");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "venue_attributes_sort_idx" ON "venue_attributes" USING btree ("type","sort_order");
--> statement-breakpoint
INSERT INTO "venue_attributes" ("type", "label", "slug", "sort_order")
VALUES
    ('AMENITY', 'TV', 'TV', 1),
    ('AMENITY', 'Projector', 'PROJECTOR', 2),
    ('AMENITY', 'Hookah', 'HOOKAH', 3),
    ('AMENITY', 'VIP', 'VIP', 4),
    ('AMENITY', 'Smoke Free', 'SMOKE_FREE', 5),
    ('AMENITY', 'Alcoholic', 'ALCOHOLIC', 6),
    ('AMENITY', 'Outdoor', 'OUTDOOR', 7),
    ('AMENITY', 'WiFi', 'WIFI', 8),
    ('AMENITY', 'Parking', 'PARKING', 9),
    ('AMENITY', 'Food', 'FOOD', 10),
    ('AMENITY', 'Kids', 'KIDS', 11),
    ('AMENITY', 'Live Music', 'LIVE_MUSIC', 12),
    ('AMENITY', 'Private Room', 'PRIVATE_ROOM', 13),
    ('VIBE', 'Casual', 'CASUAL', 1),
    ('VIBE', 'Lively', 'LIVELY', 2),
    ('VIBE', 'Family Friendly', 'FAMILY_FRIENDLY', 3),
    ('VIBE', 'Luxury', 'LUXURY', 4),
    ('VIBE', 'Neighborhood', 'NEIGHBORHOOD', 5),
    ('VIBE', 'Game Day', 'GAME_DAY', 6),
    ('VIBE', 'Late Night', 'LATE_NIGHT', 7),
    ('VIBE', 'Upscale', 'UPSCALE', 8),
    ('CUISINE', 'Italian', 'ITALIAN', 1),
    ('CUISINE', 'Mexican', 'MEXICAN', 2),
    ('CUISINE', 'Chinese', 'CHINESE', 3),
    ('CUISINE', 'Japanese', 'JAPANESE', 4),
    ('CUISINE', 'Turkish', 'TURKISH', 5),
    ('CUISINE', 'American', 'AMERICAN', 6),
    ('CUISINE', 'Middle Eastern', 'MIDDLE_EASTERN', 7),
    ('CUISINE', 'Indian', 'INDIAN', 8),
    ('CUISINE', 'Thai', 'THAI', 9),
    ('CUISINE', 'Korean', 'KOREAN', 10),
    ('CUISINE', 'Mediterranean', 'MEDITERRANEAN', 11),
    ('CUISINE', 'Brazilian', 'BRAZILIAN', 12),
    ('CUISINE', 'French', 'FRENCH', 13),
    ('CUISINE', 'Seafood', 'SEAFOOD', 14),
    ('CUISINE', 'BBQ', 'BBQ', 15),
    ('CUISINE', 'Vegan', 'VEGAN', 16),
    ('CUISINE', 'Fast Food', 'FAST_FOOD', 17)
ON CONFLICT ("type", "slug") DO UPDATE
SET
    "label" = excluded."label",
    "sort_order" = excluded."sort_order",
    "is_active" = true,
    "updated_at" = now();
