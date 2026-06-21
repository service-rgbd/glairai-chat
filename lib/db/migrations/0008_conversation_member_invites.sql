CREATE TABLE IF NOT EXISTS "conversation_member_invites" (
  "id" text PRIMARY KEY,
  "conversation_id" text NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "invited_user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "invited_by_user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'pending',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "responded_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "conversation_member_invites_invited_user_idx"
  ON "conversation_member_invites" ("invited_user_id");

CREATE INDEX IF NOT EXISTS "conversation_member_invites_conversation_idx"
  ON "conversation_member_invites" ("conversation_id");

CREATE UNIQUE INDEX IF NOT EXISTS "conversation_member_invites_pending_unique"
  ON "conversation_member_invites" ("conversation_id", "invited_user_id")
  WHERE "status" = 'pending';
