CREATE TABLE IF NOT EXISTS "team_fan_venues" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "team_id" uuid NOT NULL,
    "venue_id" uuid NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "team_fan_venues"
    ADD CONSTRAINT IF NOT EXISTS "team_fan_venues_team_id_teams_id_fk"
        FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action,
    ADD CONSTRAINT IF NOT EXISTS "team_fan_venues_venue_id_venues_id_fk"
        FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;

CREATE UNIQUE INDEX IF NOT EXISTS "team_fan_venues_team_venue_unique"
    ON "team_fan_venues" ("team_id", "venue_id");
CREATE INDEX IF NOT EXISTS "team_fan_venues_team_idx"
    ON "team_fan_venues" ("team_id");
CREATE INDEX IF NOT EXISTS "team_fan_venues_venue_idx"
    ON "team_fan_venues" ("venue_id");
