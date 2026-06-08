DO $$ BEGIN
  CREATE TYPE "call_session_status" AS ENUM(
    'ringing',
    'answered',
    'ended',
    'cancelled',
    'declined',
    'missed'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "call_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "conversation_id" text NOT NULL REFERENCES "conversations"("id") ON DELETE cascade,
  "type" text NOT NULL,
  "caller_user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "caller_name" text NOT NULL,
  "caller_avatar_url" text,
  "callee_user_ids" text NOT NULL,
  "status" "call_session_status" DEFAULT 'ringing' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "answered_at" timestamp with time zone,
  "call_log_created" boolean DEFAULT false NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "call_sessions_conversation_idx" ON "call_sessions" ("conversation_id");
CREATE INDEX IF NOT EXISTS "call_sessions_caller_idx" ON "call_sessions" ("caller_user_id");
CREATE INDEX IF NOT EXISTS "call_sessions_status_idx" ON "call_sessions" ("status");
CREATE INDEX IF NOT EXISTS "call_sessions_created_at_idx" ON "call_sessions" ("created_at");
