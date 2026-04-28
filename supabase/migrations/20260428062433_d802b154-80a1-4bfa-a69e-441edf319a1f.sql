-- Phase 2: clients, activity_log, jobs, platform_settings

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  industry text,
  primary_language text default 'it',
  custom_brand_color text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger clients_set_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

alter table public.clients enable row level security;

create policy "Users view own clients or owner views all"
on public.clients for select to authenticated
using (user_id = auth.uid() or public.is_owner(auth.uid()));

create policy "Users insert own clients"
on public.clients for insert to authenticated
with check (user_id = auth.uid());

create policy "Users update own clients or owner"
on public.clients for update to authenticated
using (user_id = auth.uid() or public.is_owner(auth.uid()));

create policy "Users delete own clients or owner"
on public.clients for delete to authenticated
using (user_id = auth.uid() or public.is_owner(auth.uid()));

-- Activity log
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  agent_name text,
  action_type text,
  description text,
  related_entity_type text,
  related_entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_user_recent on public.activity_log(user_id, created_at desc);

alter table public.activity_log enable row level security;

create policy "Users view own activity or owner"
on public.activity_log for select to authenticated
using (user_id = auth.uid() or public.is_owner(auth.uid()));

create policy "Users insert own activity"
on public.activity_log for insert to authenticated
with check (user_id = auth.uid());

-- Jobs
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  agent_name text not null,
  job_type text not null,
  status text not null default 'queued',
  payload jsonb,
  result jsonb,
  progress_pct int not null default 0,
  progress_message text,
  estimated_cost_eur numeric,
  actual_cost_eur numeric,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists idx_jobs_active on public.jobs(status) where status in ('queued', 'running');

alter table public.jobs enable row level security;

create policy "Users view own jobs or owner"
on public.jobs for select to authenticated
using (user_id = auth.uid() or public.is_owner(auth.uid()));

create policy "Users insert own jobs"
on public.jobs for insert to authenticated
with check (user_id = auth.uid());

create policy "Users update own jobs or owner"
on public.jobs for update to authenticated
using (user_id = auth.uid() or public.is_owner(auth.uid()));

-- Platform settings
create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.platform_settings enable row level security;

create policy "Anyone authed can read settings"
on public.platform_settings for select to authenticated
using (true);

create policy "Owner manages settings insert"
on public.platform_settings for insert to authenticated
with check (public.is_owner(auth.uid()));

create policy "Owner manages settings update"
on public.platform_settings for update to authenticated
using (public.is_owner(auth.uid()));

create policy "Owner manages settings delete"
on public.platform_settings for delete to authenticated
using (public.is_owner(auth.uid()));

-- Seed defaults
insert into public.platform_settings (key, value) values
  ('default_budget_solo_eur', '5'::jsonb),
  ('default_budget_creator_eur', '15'::jsonb),
  ('default_budget_studio_eur', '50'::jsonb),
  ('cost_tribev2_inference_eur', '0.45'::jsonb),
  ('cost_deepgram_per_minute_eur', '0.005'::jsonb),
  ('cost_shotstack_per_minute_eur', '0.30'::jsonb),
  ('cost_elevenlabs_per_minute_eur', '0.20'::jsonb),
  ('cost_opus47_per_1k_input_tokens_eur', '0.014'::jsonb),
  ('cost_opus47_per_1k_output_tokens_eur', '0.07'::jsonb),
  ('cost_sonnet46_per_1k_input_tokens_eur', '0.0028'::jsonb),
  ('cost_sonnet46_per_1k_output_tokens_eur', '0.014'::jsonb),
  ('cost_haiku45_per_1k_input_tokens_eur', '0.0007'::jsonb),
  ('cost_haiku45_per_1k_output_tokens_eur', '0.0035'::jsonb)
on conflict (key) do nothing;

-- Realtime for jobs
alter publication supabase_realtime add table public.jobs;
