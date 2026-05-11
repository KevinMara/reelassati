INSERT INTO storage.buckets (id, name, public) 
VALUES ('raw_videos', 'raw_videos', false)
ON CONFLICT (id) DO NOTHING;

-- Policies for raw_videos
CREATE POLICY "Users can upload their own footage" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'raw_videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view their own footage" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'raw_videos' AND (storage.foldername(name))[1] = auth.uid()::text);
