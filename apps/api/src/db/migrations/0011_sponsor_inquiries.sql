CREATE TABLE IF NOT EXISTS "sponsor_inquiries" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "company" varchar(200) NOT NULL,
    "contact_name" varchar(100),
    "email" varchar(255) NOT NULL,
    "phone" varchar(30),
    "website" varchar(500),
    "tier" varchar(50) NOT NULL,
    "message" text,
    "status" varchar(30) NOT NULL DEFAULT 'new',
    "created_at" timestamp DEFAULT now() NOT NULL
);