DO $$ BEGIN
  CREATE TYPE "channel_media_type" AS ENUM ('text', 'image', 'video');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "channel_admin_role" AS ENUM ('owner', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "channels" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "avatar_url" text,
  "owner_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "category" text,
  "is_verified" boolean DEFAULT false NOT NULL,
  "is_public" boolean DEFAULT true NOT NULL,
  "followers_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "channels_owner_idx" ON "channels" ("owner_id");
CREATE INDEX IF NOT EXISTS "channels_name_idx" ON "channels" ("name");
CREATE INDEX IF NOT EXISTS "channels_category_idx" ON "channels" ("category");
CREATE INDEX IF NOT EXISTS "channels_created_at_idx" ON "channels" ("created_at");
CREATE INDEX IF NOT EXISTS "channels_followers_count_idx" ON "channels" ("followers_count");

CREATE TABLE IF NOT EXISTS "channel_admins" (
  "channel_id" text NOT NULL REFERENCES "channels"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" "channel_admin_role" DEFAULT 'admin' NOT NULL,
  "added_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("channel_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "channel_admins_user_idx" ON "channel_admins" ("user_id");

CREATE TABLE IF NOT EXISTS "channel_followers" (
  "channel_id" text NOT NULL REFERENCES "channels"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "followed_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("channel_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "channel_followers_user_idx" ON "channel_followers" ("user_id");
CREATE INDEX IF NOT EXISTS "channel_followers_followed_at_idx" ON "channel_followers" ("followed_at");

CREATE TABLE IF NOT EXISTS "channel_posts" (
  "id" text PRIMARY KEY NOT NULL,
  "channel_id" text NOT NULL REFERENCES "channels"("id") ON DELETE CASCADE,
  "author_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "content" text DEFAULT '' NOT NULL,
  "media_url" text,
  "media_type" "channel_media_type" DEFAULT 'text' NOT NULL,
  "views_count" integer DEFAULT 0 NOT NULL,
  "reactions_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "channel_posts_channel_created_idx" ON "channel_posts" ("channel_id", "created_at");
CREATE INDEX IF NOT EXISTS "channel_posts_author_idx" ON "channel_posts" ("author_id");
CREATE INDEX IF NOT EXISTS "channel_posts_created_at_idx" ON "channel_posts" ("created_at");

CREATE TABLE IF NOT EXISTS "channel_reactions" (
  "id" text PRIMARY KEY NOT NULL,
  "post_id" text NOT NULL REFERENCES "channel_posts"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "emoji" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "channel_reactions_post_user_idx" ON "channel_reactions" ("post_id", "user_id");
CREATE INDEX IF NOT EXISTS "channel_reactions_post_idx" ON "channel_reactions" ("post_id");
CREATE INDEX IF NOT EXISTS "channel_reactions_user_idx" ON "channel_reactions" ("user_id");

CREATE TABLE IF NOT EXISTS "channel_post_views" (
  "post_id" text NOT NULL REFERENCES "channel_posts"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("post_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "channel_post_views_post_idx" ON "channel_post_views" ("post_id");
CREATE INDEX IF NOT EXISTS "channel_post_views_user_idx" ON "channel_post_views" ("user_id");
