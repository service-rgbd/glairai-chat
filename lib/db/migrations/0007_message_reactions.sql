CREATE TABLE IF NOT EXISTS "message_reactions" (
  "message_id" text NOT NULL REFERENCES "messages"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "emoji" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("message_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "message_reactions_message_idx" ON "message_reactions" ("message_id");
CREATE INDEX IF NOT EXISTS "message_reactions_user_idx" ON "message_reactions" ("user_id");
