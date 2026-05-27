-- Add missing columns to users_profile table if they don't exist
ALTER TABLE public.users_profile 
ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Ensure display_name exists (it was displayName in Prisma, display_name in DB)
-- Based on @@map("users_profile"), Prisma's displayName is already display_name in DB.
-- Just making sure it's TEXT.
ALTER TABLE public.users_profile ALTER COLUMN display_name TYPE TEXT;
ALTER TABLE public.users_profile ALTER COLUMN password_hash TYPE TEXT;
ALTER TABLE public.users_profile ALTER COLUMN auth_provider TYPE TEXT;

-- Create trigger for updated_at if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_profile_updated_at') THEN
        CREATE TRIGGER update_users_profile_updated_at
        BEFORE UPDATE ON public.users_profile
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
