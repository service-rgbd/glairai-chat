CREATE TABLE IF NOT EXISTS "channel_reports" (
  "id" text PRIMARY KEY NOT NULL,
  "channel_id" text NOT NULL REFERENCES "channels"("id") ON DELETE CASCADE,
  "reporter_user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "reason" text DEFAULT '' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "channel_reports_channel_reporter_idx"
  ON "channel_reports" ("channel_id", "reporter_user_id");
CREATE INDEX IF NOT EXISTS "channel_reports_channel_idx" ON "channel_reports" ("channel_id");
CREATE INDEX IF NOT EXISTS "channel_reports_reporter_idx" ON "channel_reports" ("reporter_user_id");
CREATE INDEX IF NOT EXISTS "channel_reports_created_at_idx" ON "channel_reports" ("created_at");
