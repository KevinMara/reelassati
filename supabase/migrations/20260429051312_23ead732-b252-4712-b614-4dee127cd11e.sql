
-- Helper used by RLS
CREATE OR REPLACE FUNCTION public.user_owns_client(_client_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.clients WHERE id = _client_id AND user_id = _user_id);
$$;

-- Client briefs
CREATE TABLE IF NOT EXISTS public.client_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  brand_voice jsonb,
  audience jsonb,
  content_strategy jsonb,
  scripting_preferences jsonb,
  editing_preferences jsonb,
  publishing_preferences jsonb,
  analytics_preferences jsonb,
  ads_strategy jsonb,
  operational jsonb,
  schema_version int NOT NULL DEFAULT 1,
  completion_pct int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "briefs select" ON public.client_briefs FOR SELECT TO authenticated
USING (public.user_owns_client(client_id, auth.uid()) OR public.is_owner(auth.uid()));
CREATE POLICY "briefs insert" ON public.client_briefs FOR INSERT TO authenticated
WITH CHECK (public.user_owns_client(client_id, auth.uid()));
CREATE POLICY "briefs update" ON public.client_briefs FOR UPDATE TO authenticated
USING (public.user_owns_client(client_id, auth.uid()) OR public.is_owner(auth.uid()));
CREATE POLICY "briefs delete" ON public.client_briefs FOR DELETE TO authenticated
USING (public.user_owns_client(client_id, auth.uid()) OR public.is_owner(auth.uid()));

-- Brief change log
CREATE TABLE IF NOT EXISTS public.brief_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id uuid NOT NULL REFERENCES public.client_briefs(id) ON DELETE CASCADE,
  field_path text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  changed_by text NOT NULL,
  reason text,
  changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.brief_change_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "change_log select" ON public.brief_change_log FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.client_briefs b
  WHERE b.id = brief_id AND (public.user_owns_client(b.client_id, auth.uid()) OR public.is_owner(auth.uid()))
));
CREATE POLICY "change_log insert" ON public.brief_change_log FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.client_briefs b
  WHERE b.id = brief_id AND public.user_owns_client(b.client_id, auth.uid())
));

-- Reference library
CREATE TABLE IF NOT EXISTS public.reference_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  title text,
  source_url text,
  storage_key text,
  duration_s numeric,
  language text NOT NULL DEFAULT 'it',
  content_hash text,
  content_category text NOT NULL DEFAULT 'uncategorized',
  subcategory text,
  format text,
  platform text[],
  reactions text[] NOT NULL DEFAULT '{}',
  goal text NOT NULL DEFAULT 'unspecified',
  actual_views int,
  actual_watch_through_pct numeric,
  actual_engagement_rate numeric,
  performance_tier text,
  curated_by_user boolean NOT NULL DEFAULT false,
  auto_promoted boolean NOT NULL DEFAULT false,
  quality_verified boolean NOT NULL DEFAULT false,
  neural_matrix_key text,
  region_timelines jsonb,
  visual_events jsonb,
  audio_events jsonb,
  dimension_scores jsonb,
  thumbnail_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ref_user_category ON public.reference_videos(user_id, content_category);
CREATE INDEX IF NOT EXISTS idx_ref_reactions ON public.reference_videos USING gin(reactions);
ALTER TABLE public.reference_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ref select" ON public.reference_videos FOR SELECT TO authenticated
USING (user_id = auth.uid() OR (user_id IS NULL AND quality_verified = true) OR public.is_owner(auth.uid()));
CREATE POLICY "ref insert" ON public.reference_videos FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
CREATE POLICY "ref update" ON public.reference_videos FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.is_owner(auth.uid()));
CREATE POLICY "ref delete" ON public.reference_videos FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.is_owner(auth.uid()));

-- Connected social accounts
CREATE TABLE IF NOT EXISTS public.connected_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  platform text NOT NULL,
  zernio_profile_key text,
  account_handle text,
  account_avatar_url text,
  status text NOT NULL DEFAULT 'active',
  connected_at timestamptz NOT NULL DEFAULT now(),
  last_sync_at timestamptz,
  UNIQUE(client_id, platform)
);
ALTER TABLE public.connected_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ca select" ON public.connected_accounts FOR SELECT TO authenticated
USING (public.user_owns_client(client_id, auth.uid()) OR public.is_owner(auth.uid()));
CREATE POLICY "ca insert" ON public.connected_accounts FOR INSERT TO authenticated
WITH CHECK (public.user_owns_client(client_id, auth.uid()));
CREATE POLICY "ca update" ON public.connected_accounts FOR UPDATE TO authenticated
USING (public.user_owns_client(client_id, auth.uid()));
CREATE POLICY "ca delete" ON public.connected_accounts FOR DELETE TO authenticated
USING (public.user_owns_client(client_id, auth.uid()));

-- Connected ad accounts
CREATE TABLE IF NOT EXISTS public.connected_ad_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  platform text NOT NULL,
  unified_to_connection_id text,
  account_name text,
  status text NOT NULL DEFAULT 'active',
  connected_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, platform)
);
ALTER TABLE public.connected_ad_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "caa select" ON public.connected_ad_accounts FOR SELECT TO authenticated
USING (public.user_owns_client(client_id, auth.uid()) OR public.is_owner(auth.uid()));
CREATE POLICY "caa insert" ON public.connected_ad_accounts FOR INSERT TO authenticated
WITH CHECK (public.user_owns_client(client_id, auth.uid()));
CREATE POLICY "caa update" ON public.connected_ad_accounts FOR UPDATE TO authenticated
USING (public.user_owns_client(client_id, auth.uid()));
CREATE POLICY "caa delete" ON public.connected_ad_accounts FOR DELETE TO authenticated
USING (public.user_owns_client(client_id, auth.uid()));

-- Caption styles
CREATE TABLE IF NOT EXISTS public.caption_styles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  name text NOT NULL,
  config jsonb NOT NULL,
  is_global boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.caption_styles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs select" ON public.caption_styles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR is_global = true);
CREATE POLICY "cs insert" ON public.caption_styles FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
CREATE POLICY "cs update" ON public.caption_styles FOR UPDATE TO authenticated
USING (user_id = auth.uid());
CREATE POLICY "cs delete" ON public.caption_styles FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- SFX library
CREATE TABLE IF NOT EXISTS public.sfx_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  storage_key text NOT NULL,
  duration_s numeric,
  tags text[],
  emotional_tags text[],
  volume_lufs numeric,
  license text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sfx_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sfx all" ON public.sfx_library FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Music library
CREATE TABLE IF NOT EXISTS public.music_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  storage_key text NOT NULL,
  duration_s numeric,
  mood text[],
  bpm int,
  genre text,
  license text,
  loopable boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.music_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "music all" ON public.music_library FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES
  ('reference_videos', 'reference_videos', false),
  ('client_logos', 'client_logos', false),
  ('caption_style_assets', 'caption_style_assets', false),
  ('sfx_files', 'sfx_files', false),
  ('music_files', 'music_files', false)
ON CONFLICT (id) DO NOTHING;

-- Generic per-user prefix policies for the new buckets
CREATE POLICY "user folder read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id IN ('reference_videos','client_logos','caption_style_assets','sfx_files','music_files')
  AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "user folder write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id IN ('reference_videos','client_logos','caption_style_assets','sfx_files','music_files')
  AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "user folder update" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id IN ('reference_videos','client_logos','caption_style_assets','sfx_files','music_files')
  AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "user folder delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id IN ('reference_videos','client_logos','caption_style_assets','sfx_files','music_files')
  AND auth.uid()::text = (storage.foldername(name))[1]
);
