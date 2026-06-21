CREATE TABLE IF NOT EXISTS "message_view_once_opens" (
  "message_id" text NOT NULL REFERENCES "messages"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "opened_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("message_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "message_view_once_opens_message_idx"
  ON "message_view_once_opens" ("message_id");

CREATE INDEX IF NOT EXISTS "message_view_once_opens_user_idx"
  ON "message_view_once_opens" ("user_id");
