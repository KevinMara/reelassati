create table if not exists public.support_tickets (
  id text primary key,
  requester_user_id uuid references auth.users(id) on delete set null,
  requester_email text not null,
  requester_name text,
  category text not null check (category in ('account','billing','studio','generation','publishing','privacy','bug','other')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  subject text not null check (char_length(subject) between 4 and 180),
  description text not null check (char_length(description) between 10 and 8000),
  conversation jsonb not null default '[]'::jsonb,
  ai_summary text,
  status text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  email_status text not null default 'pending' check (email_status in ('pending','sent','failed','configuration_required')),
  provider_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_tickets_requester_created_idx
  on public.support_tickets (requester_user_id, created_at desc);
create index if not exists support_tickets_email_created_idx
  on public.support_tickets (requester_email, created_at desc);
create index if not exists support_tickets_status_created_idx
  on public.support_tickets (status, created_at desc);

alter table public.support_tickets enable row level security;
revoke all on table public.support_tickets from anon, authenticated;
grant select on table public.support_tickets to authenticated;

drop policy if exists "Customers can view their own support tickets" on public.support_tickets;
create policy "Customers can view their own support tickets"
on public.support_tickets
for select
to authenticated
using ((select auth.uid()) = requester_user_id);

create table if not exists public.support_rate_limits (
  key text primary key,
  request_count integer not null default 0,
  window_started_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.support_rate_limits enable row level security;
revoke all on table public.support_rate_limits from anon, authenticated;

drop policy if exists "No direct support rate-limit access" on public.support_rate_limits;
create policy "No direct support rate-limit access"
on public.support_rate_limits
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

create or replace function public.claim_support_rate_limit(
  p_key text,
  p_limit integer,
  p_window_started_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_count integer;
begin
  insert into public.support_rate_limits as limits
    (key, request_count, window_started_at, updated_at)
  values
    (p_key, 1, p_window_started_at, now())
  on conflict (key) do update
    set request_count = limits.request_count + 1,
        updated_at = now()
  returning request_count into next_count;

  return next_count <= greatest(1, least(p_limit, 1000));
end;
$$;

revoke all on function public.claim_support_rate_limit(text, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_support_rate_limit(text, integer, timestamptz) to service_role;
