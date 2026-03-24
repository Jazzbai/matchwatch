CREATE TYPE "public"."motorsport_entry_status" AS ENUM('ENTERED', 'ACTIVE', 'FINISHED', 'DNF', 'DNS', 'DSQ', 'WITHDRAWN');

CREATE TABLE "drivers" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "external_id" varchar(80),
    "name" varchar(150) NOT NULL,
    "short_name" varchar(60),
    "nationality" varchar(80),
    "country_code" varchar(3),
    "headshot_url" varchar,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "drivers_external_id_unique" UNIQUE("external_id")
);

CREATE TABLE "entrants" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "external_id" varchar(80),
    "league_id" uuid,
    "name" varchar(150) NOT NULL,
    "short_name" varchar(60),
    "brand_color" varchar(20),
    "logo_url" varchar,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "entrants_external_id_unique" UNIQUE("external_id")
);

CREATE TABLE "manufacturers" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "external_id" varchar(80),
    "league_id" uuid,
    "name" varchar(150) NOT NULL,
    "short_name" varchar(60),
    "logo_url" varchar,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "manufacturers_external_id_unique" UNIQUE("external_id")
);

CREATE TABLE "event_entries" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "match_id" uuid NOT NULL,
    "external_id" varchar(120),
    "car_number" varchar(20),
    "driver_id" uuid,
    "entrant_id" uuid,
    "manufacturer_id" uuid,
    "display_name" varchar(200),
    "grid_position" integer,
    "start_position" integer,
    "finish_position" integer,
    "status" "public"."motorsport_entry_status" DEFAULT 'ENTERED' NOT NULL,
    "points" numeric(8, 2),
    "metadata" jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "event_entries_external_id_unique" UNIQUE("external_id")
);

ALTER TABLE "entrants" ADD CONSTRAINT "entrants_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "manufacturers" ADD CONSTRAINT "manufacturers_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "event_entries" ADD CONSTRAINT "event_entries_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "event_entries" ADD CONSTRAINT "event_entries_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "event_entries" ADD CONSTRAINT "event_entries_entrant_id_entrants_id_fk" FOREIGN KEY ("entrant_id") REFERENCES "public"."entrants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "event_entries" ADD CONSTRAINT "event_entries_manufacturer_id_manufacturers_id_fk" FOREIGN KEY ("manufacturer_id") REFERENCES "public"."manufacturers"("id") ON DELETE no action ON UPDATE no action;

CREATE INDEX "drivers_name_idx" ON "drivers" USING btree ("name");
CREATE INDEX "entrants_league_idx" ON "entrants" USING btree ("league_id");
CREATE INDEX "entrants_name_idx" ON "entrants" USING btree ("name");
CREATE INDEX "manufacturers_league_idx" ON "manufacturers" USING btree ("league_id");
CREATE INDEX "manufacturers_name_idx" ON "manufacturers" USING btree ("name");
CREATE INDEX "event_entries_match_idx" ON "event_entries" USING btree ("match_id");
CREATE INDEX "event_entries_driver_idx" ON "event_entries" USING btree ("driver_id");
CREATE INDEX "event_entries_entrant_idx" ON "event_entries" USING btree ("entrant_id");
CREATE INDEX "event_entries_manufacturer_idx" ON "event_entries" USING btree ("manufacturer_id");
