ALTER TABLE "device_tokens" ADD COLUMN IF NOT EXISTS "voip_push_token" text;

CREATE INDEX IF NOT EXISTS "device_tokens_voip_push_token_idx" ON "device_tokens" ("voip_push_token");
