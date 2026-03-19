ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'BUSINESS';
--> statement-breakpoint
UPDATE "users"
SET "role" = 'BUSINESS'
WHERE "role" = 'VENUE_OWNER';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(80) NOT NULL,
	"slug" varchar(80) NOT NULL,
	"short_name" varchar(20),
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sports_name_unique" UNIQUE("name"),
	CONSTRAINT "sports_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sports_active_idx" ON "sports" USING btree ("is_active");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sports_sort_idx" ON "sports" USING btree ("sort_order");
--> statement-breakpoint
INSERT INTO "sports" ("name", "slug", "short_name", "sort_order")
VALUES
	('Soccer', 'soccer', 'SOC', 1),
	('American Football', 'american-football', 'NFL', 2),
	('Baseball', 'baseball', 'MLB', 3),
	('Basketball', 'basketball', 'NBA', 4),
	('Hockey', 'hockey', 'NHL', 5)
ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "leagues" ADD COLUMN "sport_id" uuid;
--> statement-breakpoint
ALTER TABLE "leagues" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint
UPDATE "leagues"
SET "sport_id" = (
	SELECT "id" FROM "sports" WHERE "slug" = 'soccer' LIMIT 1
)
WHERE "sport_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "leagues" ALTER COLUMN "sport_id" SET NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "leagues" ADD CONSTRAINT "leagues_sport_id_sports_id_fk"
 FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leagues_sport_idx" ON "leagues" USING btree ("sport_id");
