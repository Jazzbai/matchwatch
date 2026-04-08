DO $$ BEGIN
    CREATE TYPE "approval_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "google_sync_status" AS ENUM ('NEVER_SYNCED', 'SYNCED', 'ERROR');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "venue_menu_source" AS ENUM ('NONE', 'GOOGLE', 'MANUAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "business_approval_status" "approval_status" DEFAULT 'PENDING' NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "business_approval_notes" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "business_approved_at" timestamp;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "business_approved_by" uuid;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_business_approved_by_users_id_fk" FOREIGN KEY ("business_approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "google_place_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "google_source_snapshot" jsonb DEFAULT '{}'::jsonb;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "google_last_synced_at" timestamp;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "google_sync_status" "google_sync_status" DEFAULT 'NEVER_SYNCED' NOT NULL;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "google_sync_error" text;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "approval_status" "approval_status" DEFAULT 'PENDING' NOT NULL;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "approval_notes" text;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "approved_at" timestamp;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "approved_by" uuid;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "venues" ADD CONSTRAINT "venues_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "menu_source" "venue_menu_source" DEFAULT 'NONE' NOT NULL;
--> statement-breakpoint
ALTER TABLE "venue_claims" ADD COLUMN IF NOT EXISTS "admin_notes" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "venues_google_place_id_unique" ON "venues" USING btree ("google_place_id");
--> statement-breakpoint
UPDATE "users"
SET
    "business_approval_status" = 'APPROVED',
    "business_approved_at" = COALESCE("business_approved_at", "created_at")
WHERE "role" IN ('BUSINESS', 'VENUE_OWNER', 'ADMIN', 'SUPER_ADMIN');
--> statement-breakpoint
UPDATE "venues"
SET
    "approval_status" = 'APPROVED',
    "approved_at" = COALESCE("approved_at", "created_at")
WHERE "is_active" = true;
--> statement-breakpoint
UPDATE "venues"
SET "menu_source" = 'MANUAL'
WHERE EXISTS (
    SELECT 1 FROM "menu_categories"
    WHERE "menu_categories"."venue_id" = "venues"."id"
);
