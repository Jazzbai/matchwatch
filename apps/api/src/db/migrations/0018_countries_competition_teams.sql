-- Migration 0018: countries table, team_type enum, competition_teams join table

-- 1. New enum
CREATE TYPE "team_type" AS ENUM ('national_team', 'club', 'franchise');

-- 2. Countries reference table
CREATE TABLE IF NOT EXISTS "countries" (
    "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "name"         varchar(100) NOT NULL,
    "iso2"         varchar(2)   NOT NULL UNIQUE,
    "iso3"         varchar(3)   NOT NULL UNIQUE,
    "fifa_code"    varchar(10),
    "ioc_code"     varchar(10),
    "flag_emoji"   varchar(10),
    "flag_svg_url" varchar(500),
    "is_active"    boolean NOT NULL DEFAULT true,
    "created_at"   timestamp NOT NULL DEFAULT now(),
    "updated_at"   timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "countries_iso2_idx" ON "countries" ("iso2");
CREATE INDEX IF NOT EXISTS "countries_iso3_idx" ON "countries" ("iso3");

-- 3. Add new columns to teams
ALTER TABLE "teams"
    ADD COLUMN IF NOT EXISTS "country_id" uuid REFERENCES "countries"("id"),
    ADD COLUMN IF NOT EXISTS "team_type"  "team_type" NOT NULL DEFAULT 'club';

CREATE INDEX IF NOT EXISTS "teams_country_idx" ON "teams" ("country_id");

-- 4. Competition teams join table (tournament participation + group assignments)
CREATE TABLE IF NOT EXISTS "competition_teams" (
    "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "competition_id"   uuid NOT NULL REFERENCES "leagues"("id") ON DELETE CASCADE,
    "team_id"          uuid NOT NULL REFERENCES "teams"("id")   ON DELETE CASCADE,
    "group_name"       varchar(10),
    "seeded_position"  integer,
    "status"           varchar(30) NOT NULL DEFAULT 'active',
    "created_at"       timestamp NOT NULL DEFAULT now(),
    UNIQUE ("competition_id", "team_id")
);

CREATE INDEX IF NOT EXISTS "competition_teams_competition_idx" ON "competition_teams" ("competition_id");
CREATE INDEX IF NOT EXISTS "competition_teams_team_idx"        ON "competition_teams" ("team_id");
CREATE INDEX IF NOT EXISTS "competition_teams_group_idx"       ON "competition_teams" ("group_name");
