ALTER TABLE chat_message_attachments
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

UPDATE chat_message_attachments
SET expires_at = created_at + interval '7 days'
WHERE expires_at IS NULL;

ALTER TABLE chat_message_attachments
  ALTER COLUMN expires_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS chat_message_attachments_expires_at_idx
  ON chat_message_attachments (expires_at);

ALTER TABLE chat_upload_intents
  ADD COLUMN IF NOT EXISTS uploaded_at timestamptz;
