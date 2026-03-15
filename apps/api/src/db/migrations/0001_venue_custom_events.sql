CREATE TABLE IF NOT EXISTS "venue_custom_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"title" varchar(160) NOT NULL,
	"description" text,
	"event_type_tags" text[] DEFAULT '{}' NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"image_url" varchar,
	"image_s3_key" varchar,
	"booking_notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "venue_custom_events" ADD CONSTRAINT "venue_custom_events_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "venue_custom_events_venue_idx" ON "venue_custom_events" USING btree ("venue_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "venue_custom_events_starts_idx" ON "venue_custom_events" USING btree ("starts_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "venue_custom_events_ends_idx" ON "venue_custom_events" USING btree ("ends_at");

