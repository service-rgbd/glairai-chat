CREATE TABLE IF NOT EXISTS "message_view_once_screenshots" (
  "message_id" text NOT NULL REFERENCES "messages"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "captured_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("message_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "message_view_once_screenshots_message_idx"
  ON "message_view_once_screenshots" ("message_id");
