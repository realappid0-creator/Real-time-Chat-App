CREATE TABLE IF NOT EXISTS chat_push_subscriptions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES chat_users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS chat_push_subscriptions_endpoint_unique
  ON chat_push_subscriptions (endpoint);

CREATE INDEX IF NOT EXISTS chat_push_subscriptions_user_id_idx
  ON chat_push_subscriptions (user_id);

ALTER TABLE chat_push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE chat_push_subscriptions FROM PUBLIC, anon, authenticated;
