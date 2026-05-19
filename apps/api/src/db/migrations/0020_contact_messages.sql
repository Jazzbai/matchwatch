CREATE TABLE IF NOT EXISTS "contact_messages" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" varchar(120) NOT NULL,
    "email" varchar(255) NOT NULL,
    "topic" varchar(60) NOT NULL,
    "message" text NOT NULL,
    "status" varchar(30) NOT NULL DEFAULT 'new',
    "created_at" timestamp DEFAULT now() NOT NULL
);
