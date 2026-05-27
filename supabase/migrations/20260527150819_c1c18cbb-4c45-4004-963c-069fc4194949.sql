
-- 1. Enable RLS deny-by-default on users_profile (accessed only via Prisma/service_role)
ALTER TABLE public.users_profile ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.users_profile FROM anon, authenticated;
GRANT ALL ON public.users_profile TO service_role;

-- 2. Storage policies for raw_videos UPDATE/DELETE scoped to user's folder
CREATE POLICY "Users can update own raw videos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'raw_videos' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'raw_videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own raw videos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'raw_videos' AND auth.uid()::text = (storage.foldername(name))[1]);
