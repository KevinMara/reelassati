-- 1. Extend profiles with access-control + preference columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS ui_language text DEFAULT 'it',
  ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Europe/Rome',
  ADD COLUMN IF NOT EXISTS theme_preference text DEFAULT 'light',
  ADD COLUMN IF NOT EXISTS custom_accent_color text,
  ADD COLUMN IF NOT EXISTS plan_tier text NOT NULL DEFAULT 'solo',
  ADD COLUMN IF NOT EXISTS access_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS is_owner boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_unlimited boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS monthly_api_budget_eur numeric NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS api_spend_this_cycle_eur numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS budget_cycle_start date NOT NULL DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS budget_override_reason text,
  ADD COLUMN IF NOT EXISTS budget_set_by text DEFAULT 'system';

-- Constrain plan_tier and access_status to known values
DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_plan_tier_check
    CHECK (plan_tier IN ('solo', 'creator', 'studio', 'custom'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_access_status_check
    CHECK (access_status IN ('active', 'pending_approval', 'suspended'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Security-definer helper: is the current user the owner?
CREATE OR REPLACE FUNCTION public.is_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = _user_id AND is_owner = true
  );
$$;

-- 3. Security-definer helper: is there no user yet? (first signup = owner)
CREATE OR REPLACE FUNCTION public.is_first_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles);
$$;

-- 4. Replace handle_new_user to handle tier, owner bootstrap, and access_requests
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_tier text;
  first_user boolean;
  new_access_status text;
  new_budget numeric;
BEGIN
  first_user := NOT EXISTS (SELECT 1 FROM public.profiles);
  requested_tier := COALESCE(NEW.raw_user_meta_data->>'requested_tier', 'solo');

  IF requested_tier NOT IN ('solo', 'creator', 'studio', 'custom') THEN
    requested_tier := 'solo';
  END IF;

  IF first_user THEN
    new_access_status := 'active';
    new_budget := 5;
  ELSIF requested_tier = 'solo' THEN
    new_access_status := 'active';
    new_budget := 5;
  ELSIF requested_tier = 'creator' THEN
    new_access_status := 'pending_approval';
    new_budget := 15;
  ELSIF requested_tier = 'studio' THEN
    new_access_status := 'pending_approval';
    new_budget := 50;
  ELSE
    new_access_status := 'pending_approval';
    new_budget := 5;
  END IF;

  INSERT INTO public.profiles (
    id, email, display_name, avatar_url,
    plan_tier, access_status, is_owner, is_unlimited,
    monthly_api_budget_eur
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name'
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    CASE WHEN first_user THEN 'solo' ELSE requested_tier END,
    new_access_status,
    first_user,
    first_user,
    new_budget
  );

  -- If they asked for a paid tier and aren't the first/owner user, log an access request
  IF NOT first_user AND requested_tier IN ('creator', 'studio') THEN
    INSERT INTO public.access_requests (user_id, requested_tier, request_message, status)
    VALUES (
      NEW.id,
      requested_tier,
      NEW.raw_user_meta_data->>'request_message',
      'pending'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. access_requests table
CREATE TABLE IF NOT EXISTS public.access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_tier text NOT NULL CHECK (requested_tier IN ('creator', 'studio', 'custom')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  request_message text,
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own requests or owner views all" ON public.access_requests;
CREATE POLICY "Users view own requests or owner views all"
ON public.access_requests FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_owner(auth.uid()));

DROP POLICY IF EXISTS "Users create own requests" ON public.access_requests;
CREATE POLICY "Users create own requests"
ON public.access_requests FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Owner updates requests" ON public.access_requests;
CREATE POLICY "Owner updates requests"
ON public.access_requests FOR UPDATE
TO authenticated
USING (public.is_owner(auth.uid()));

-- 6. api_usage_log table
CREATE TABLE IF NOT EXISTS public.api_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  agent_name text,
  action_type text,
  external_service text,
  cost_eur numeric NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_user_cycle
  ON public.api_usage_log(user_id, created_at DESC);

ALTER TABLE public.api_usage_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own usage or owner views all" ON public.api_usage_log;
CREATE POLICY "Users view own usage or owner views all"
ON public.api_usage_log FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_owner(auth.uid()));

-- 7. Let the owner view all profiles (in addition to existing own-profile select)
DROP POLICY IF EXISTS "Owner can view all profiles" ON public.profiles;
CREATE POLICY "Owner can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.is_owner(auth.uid()));

-- 8. updated_at trigger on profiles (uses existing set_updated_at)
DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();