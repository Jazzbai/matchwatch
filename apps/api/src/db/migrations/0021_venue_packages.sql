CREATE TABLE IF NOT EXISTS "venue_packages" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "venue_id" uuid NOT NULL REFERENCES "venues"("id"),
    "name" varchar(150) NOT NULL,
    "description" text,
    "price" numeric(10, 2) NOT NULL,
    "currency" varchar(3) DEFAULT 'USD',
    "max_party_size" integer,
    "inclusions" jsonb DEFAULT '[]'::jsonb,
    "image_url" varchar,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "venue_packages_venue_idx" ON "venue_packages" ("venue_id");
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "package_id" uuid REFERENCES "venue_packages"("id");
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "payment_status" varchar(20);
