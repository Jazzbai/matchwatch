CREATE TABLE IF NOT EXISTS "entity_slug_redirects" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "entity_type" varchar(40) NOT NULL,
    "entity_id" uuid NOT NULL,
    "slug" varchar(180) NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "entity_slug_redirects_type_slug_unique"
    ON "entity_slug_redirects" ("entity_type", "slug");

CREATE INDEX IF NOT EXISTS "entity_slug_redirects_entity_idx"
    ON "entity_slug_redirects" ("entity_type", "entity_id");
