
-- DRAFTS table (minimal — created here since publisher previously stored drafts only in-memory)
CREATE TABLE IF NOT EXISTS public.drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid,
  source_video_id uuid,
  title text,
  description text,
  hashtags text[],
  platforms text[],
  status text NOT NULL DEFAULT 'draft',
  thumbnail_candidates jsonb,
  thumbnail_selected_index int,
  thumbnail_custom_uploaded boolean NOT NULL DEFAULT false,
  thumbnail_source text,
  thumbnail_video_frame_timestamp_s numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drafts select" ON public.drafts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_owner(auth.uid()));
CREATE POLICY "drafts insert" ON public.drafts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "drafts update" ON public.drafts FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_owner(auth.uid()));
CREATE POLICY "drafts delete" ON public.drafts FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_owner(auth.uid()));

CREATE TRIGGER drafts_set_updated_at BEFORE UPDATE ON public.drafts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- THUMBNAIL GENERATIONS
CREATE TABLE IF NOT EXISTS public.thumbnail_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid REFERENCES public.drafts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  parent_generation_id uuid REFERENCES public.thumbnail_generations(id),
  refinement_instruction text,
  platform text,
  title text,
  quality text NOT NULL DEFAULT 'medium',
  tribev2_concept jsonb,
  opus_prompts jsonb,
  generated_image_keys text[],
  candidates jsonb,
  total_cost_eur numeric,
  status text NOT NULL DEFAULT 'pending',
  error_details jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_thumbnails_draft ON public.thumbnail_generations(draft_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_thumbnails_user ON public.thumbnail_generations(user_id, created_at DESC);

ALTER TABLE public.thumbnail_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "thumb select" ON public.thumbnail_generations FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_owner(auth.uid()));
CREATE POLICY "thumb insert" ON public.thumbnail_generations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "thumb update" ON public.thumbnail_generations FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_owner(auth.uid()));
CREATE POLICY "thumb delete" ON public.thumbnail_generations FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_owner(auth.uid()));

-- STORAGE BUCKET
INSERT INTO storage.buckets (id, name, public)
VALUES ('thumbnails', 'thumbnails', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "thumbnails read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "thumbnails write own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "thumbnails update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "thumbnails delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);
