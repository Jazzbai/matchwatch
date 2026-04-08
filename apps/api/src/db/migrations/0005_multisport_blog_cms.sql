CREATE TYPE "match_event_format" AS ENUM('HEAD_TO_HEAD', 'SINGLE_EVENT');
--> statement-breakpoint
CREATE TYPE "blog_publish_status" AS ENUM('DRAFT', 'PUBLISHED');
--> statement-breakpoint
CREATE TYPE "blog_comment_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "event_format" "match_event_format" DEFAULT 'HEAD_TO_HEAD' NOT NULL;
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "event_title" varchar(200);
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "event_subtitle" varchar(200);
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "rating_override" numeric(3, 2);
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "review_count_override" integer;
--> statement-breakpoint
CREATE TABLE "blog_categories" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" varchar(120) NOT NULL,
    "slug" varchar(160) NOT NULL,
    "description" text,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "blog_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "author_id" uuid NOT NULL,
    "title" varchar(200) NOT NULL,
    "slug" varchar(220) NOT NULL,
    "excerpt" varchar(500),
    "featured_image_url" varchar,
    "featured_image_s3_key" varchar,
    "content_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "content_html" text DEFAULT '' NOT NULL,
    "status" "blog_publish_status" DEFAULT 'DRAFT' NOT NULL,
    "published_at" timestamp,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    "deleted_at" timestamp,
    CONSTRAINT "blog_posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "blog_post_categories" (
    "post_id" uuid NOT NULL,
    "category_id" uuid NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "blog_post_categories_post_id_category_id_pk" PRIMARY KEY("post_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "blog_comments" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "post_id" uuid NOT NULL,
    "user_id" uuid NOT NULL,
    "content" text NOT NULL,
    "status" "blog_comment_status" DEFAULT 'PENDING' NOT NULL,
    "moderated_by" uuid,
    "moderated_at" timestamp,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "blog_post_categories" ADD CONSTRAINT "blog_post_categories_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "blog_post_categories" ADD CONSTRAINT "blog_post_categories_category_id_blog_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."blog_categories"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "blog_comments" ADD CONSTRAINT "blog_comments_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "blog_comments" ADD CONSTRAINT "blog_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "blog_comments" ADD CONSTRAINT "blog_comments_moderated_by_users_id_fk" FOREIGN KEY ("moderated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "blog_categories_active_idx" ON "blog_categories" USING btree ("is_active");
--> statement-breakpoint
CREATE INDEX "blog_categories_sort_idx" ON "blog_categories" USING btree ("sort_order");
--> statement-breakpoint
CREATE INDEX "blog_posts_status_idx" ON "blog_posts" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "blog_posts_published_at_idx" ON "blog_posts" USING btree ("published_at");
--> statement-breakpoint
CREATE INDEX "blog_posts_author_idx" ON "blog_posts" USING btree ("author_id");
--> statement-breakpoint
CREATE INDEX "blog_comments_post_idx" ON "blog_comments" USING btree ("post_id");
--> statement-breakpoint
CREATE INDEX "blog_comments_status_idx" ON "blog_comments" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "blog_comments_user_idx" ON "blog_comments" USING btree ("user_id");
