ALTER TABLE "conversations"
ADD COLUMN IF NOT EXISTS "group_settings" jsonb;
