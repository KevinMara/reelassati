
-- 1. Fix profiles SELECT: remove broad "viewable by authenticated" policy
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;

CREATE POLICY "Users view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- 2. Fix profiles UPDATE: prevent privilege escalation on sensitive fields
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users update own profile non-privileged"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND is_owner = (SELECT is_owner FROM public.profiles WHERE id = auth.uid())
  AND is_unlimited = (SELECT is_unlimited FROM public.profiles WHERE id = auth.uid())
  AND plan_tier = (SELECT plan_tier FROM public.profiles WHERE id = auth.uid())
  AND access_status = (SELECT access_status FROM public.profiles WHERE id = auth.uid())
  AND monthly_api_budget_eur = (SELECT monthly_api_budget_eur FROM public.profiles WHERE id = auth.uid())
  AND api_spend_this_cycle_eur = (SELECT api_spend_this_cycle_eur FROM public.profiles WHERE id = auth.uid())
  AND budget_set_by = (SELECT budget_set_by FROM public.profiles WHERE id = auth.uid())
  AND budget_override_reason IS NOT DISTINCT FROM (SELECT budget_override_reason FROM public.profiles WHERE id = auth.uid())
);

-- Owner can update any profile (including privileged fields)
CREATE POLICY "Owner updates any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_owner(auth.uid()))
WITH CHECK (public.is_owner(auth.uid()));

-- 3. Fix chat_messages: scope to authenticated only
DROP POLICY IF EXISTS "users see own messages" ON public.chat_messages;

CREATE POLICY "users manage own messages"
ON public.chat_messages
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 4. Fix raw_videos storage policies: scope to authenticated only
DROP POLICY IF EXISTS "Users can upload their own footage" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own footage" ON storage.objects;

CREATE POLICY "Users can upload their own footage"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'raw_videos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own footage"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'raw_videos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 5. Revoke EXECUTE on internal SECURITY DEFINER helpers from authenticated.
-- These are intended for use inside RLS policies / triggers only.
REVOKE EXECUTE ON FUNCTION public.user_owns_client(uuid, uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.is_first_user() FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.is_owner(uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.increment_user_spend(uuid, numeric) FROM authenticated, anon, public;
