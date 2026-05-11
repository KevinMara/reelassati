create table public.chat_messages (
  id uuid not null default gen_random_uuid() primary key,
  session_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  is_final boolean not null default true,
  created_at timestamp with time zone not null default now()
);

alter table public.chat_messages enable row level security;

create policy "Users can view their own chat messages"
  on public.chat_messages for select
  using (auth.uid() = user_id);

create policy "Users can insert their own chat messages"
  on public.chat_messages for insert
  with check (auth.uid() = user_id);

-- Check if publication exists before adding table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
    ELSE
        CREATE PUBLICATION supabase_realtime FOR TABLE chat_messages;
    END IF;
END $$;
