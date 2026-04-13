-- Match Point: phone auth, predictions, venue check-ins, QR banners

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" varchar(20) UNIQUE;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "phone_auth_sessions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "phone" varchar(20) NOT NULL,
    "otp_hash" varchar(255) NOT NULL,
    "expires_at" timestamp NOT NULL,
    "verified" boolean DEFAULT false NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "phone_auth_phone_idx" ON "phone_auth_sessions" USING btree ("phone");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "predictions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "match_id" uuid NOT NULL,
    "venue_id" uuid,
    "predicted_winner" varchar(10) NOT NULL,
    "predicted_home_score" integer,
    "predicted_away_score" integer,
    "points" integer DEFAULT 0 NOT NULL,
    "settled" boolean DEFAULT false NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "predictions" ADD CONSTRAINT "predictions_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "predictions" ADD CONSTRAINT "predictions_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "predictions" ADD CONSTRAINT "predictions_venue_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "predictions_user_match_idx" ON "predictions" USING btree ("user_id", "match_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "predictions_match_idx" ON "predictions" USING btree ("match_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "predictions_user_idx" ON "predictions" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "predictions_settled_idx" ON "predictions" USING btree ("settled");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "venue_checkins" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "venue_id" uuid NOT NULL,
    "match_id" uuid,
    "source" varchar(20) DEFAULT 'qr' NOT NULL,
    "checked_in_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "venue_checkins" ADD CONSTRAINT "venue_checkins_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "venue_checkins" ADD CONSTRAINT "venue_checkins_venue_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "venue_checkins" ADD CONSTRAINT "venue_checkins_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "checkins_user_venue_match_idx" ON "venue_checkins" USING btree ("user_id", "venue_id", "match_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checkins_venue_idx" ON "venue_checkins" USING btree ("venue_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checkins_user_idx" ON "venue_checkins" USING btree ("user_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "venue_qr_banners" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "venue_id" uuid NOT NULL UNIQUE,
    "title" varchar(200) DEFAULT 'Scan to Predict & Win' NOT NULL,
    "landing_url" varchar(500) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "venue_qr_banners" ADD CONSTRAINT "venue_qr_banners_venue_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;