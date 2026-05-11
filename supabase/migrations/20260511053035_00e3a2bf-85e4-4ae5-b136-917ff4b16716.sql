-- Drop existing chat_messages table if it exists
DROP TABLE IF EXISTS public.chat_messages CASCADE;

-- Recreate with the provided schema
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  agent_name text,
  role text NOT NULL,                  -- 'user' | 'agent'
  content text NOT NULL,
  is_streaming_chunk boolean DEFAULT false,
  is_final boolean DEFAULT true,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_chat_session ON chat_messages(session_id, created_at);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own messages" ON chat_messages FOR ALL USING (user_id = auth.uid());

-- Enable Realtime
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
    ELSE
        CREATE PUBLICATION supabase_realtime FOR TABLE chat_messages;
    END IF;
END $$;
