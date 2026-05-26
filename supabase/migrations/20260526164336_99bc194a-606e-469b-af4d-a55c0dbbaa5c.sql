-- Add google_id and avatar_url to users_profile
ALTER TABLE public.users_profile 
ADD COLUMN IF NOT EXISTS google_id TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add unique constraint to google_id if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'users_profile_google_id_key') THEN
        CREATE UNIQUE INDEX users_profile_google_id_key ON public.users_profile(google_id);
    END IF;
END $$;
