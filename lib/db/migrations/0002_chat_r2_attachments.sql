CREATE TABLE IF NOT EXISTS chat_message_attachments (
  id text PRIMARY KEY,
  message_id text NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  object_key text NOT NULL UNIQUE,
  public_url text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 2097152),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_upload_intents (
  id text PRIMARY KEY,
  conversation_id text NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES chat_users(id) ON DELETE CASCADE,
  object_key text NOT NULL UNIQUE,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 2097152),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_message_attachments_message_id_idx
  ON chat_message_attachments (message_id);

CREATE INDEX IF NOT EXISTS chat_upload_intents_owner_conversation_idx
  ON chat_upload_intents (user_id, conversation_id);

CREATE INDEX IF NOT EXISTS chat_upload_intents_expires_at_idx
  ON chat_upload_intents (expires_at);

ALTER TABLE chat_message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_upload_intents ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE chat_message_attachments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE chat_upload_intents FROM PUBLIC, anon, authenticated;
