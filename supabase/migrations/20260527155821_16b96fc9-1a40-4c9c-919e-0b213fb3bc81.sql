-- Ensure columns exist in users_profile
DO $$ 
BEGIN 
    -- Add password_hash
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users_profile' AND column_name = 'password_hash') THEN
        ALTER TABLE public.users_profile ADD COLUMN password_hash TEXT;
    END IF;

    -- Add auth_provider
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users_profile' AND column_name = 'auth_provider') THEN
        ALTER TABLE public.users_profile ADD COLUMN auth_provider TEXT DEFAULT 'email';
    END IF;

    -- Add google_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users_profile' AND column_name = 'google_id') THEN
        ALTER TABLE public.users_profile ADD COLUMN google_id TEXT;
        -- Use an anonymous block for the constraint too
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_profile_google_id_unique') THEN
            ALTER TABLE public.users_profile ADD CONSTRAINT users_profile_google_id_unique UNIQUE (google_id);
        END IF;
    END IF;

    -- Add avatar_url
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users_profile' AND column_name = 'avatar_url') THEN
        ALTER TABLE public.users_profile ADD COLUMN avatar_url TEXT;
    END IF;

    -- Add updated_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users_profile' AND column_name = 'updated_at') THEN
        ALTER TABLE public.users_profile ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
    END IF;
END $$;

-- Enable RLS
ALTER TABLE public.users_profile ENABLE ROW LEVEL SECURITY;

-- Ensure service_role has access (this is what Prisma uses)
GRANT ALL ON public.users_profile TO service_role;

-- Users can read their own profile (if using Data API directly)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own profile' AND tablename = 'users_profile') THEN
        CREATE POLICY "Users can view their own profile" ON public.users_profile FOR SELECT USING (auth.uid() = id);
    END IF;
END $$;

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_users_profile_updated ON public.users_profile;
CREATE TRIGGER on_users_profile_updated
  BEFORE UPDATE ON public.users_profile
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
