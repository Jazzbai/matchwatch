CREATE TABLE IF NOT EXISTS "stadiums" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"city" varchar(100),
	"country" varchar(100),
	"external_id" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stadiums_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stadiums_name_idx" ON "stadiums" USING btree ("name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stadiums_city_idx" ON "stadiums" USING btree ("city");
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "stadium_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "matches" ADD CONSTRAINT "matches_stadium_id_stadiums_id_fk" FOREIGN KEY ("stadium_id") REFERENCES "public"."stadiums"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
