ALTER TABLE "conversation_members"
ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;

ALTER TABLE "conversation_members"
ADD COLUMN IF NOT EXISTS "muted_at" timestamp with time zone;

ALTER TABLE "conversation_members"
ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
