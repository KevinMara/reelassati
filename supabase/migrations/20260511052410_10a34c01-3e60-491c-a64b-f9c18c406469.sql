ALTER FUNCTION public.increment_user_spend(uuid, numeric) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.increment_user_spend(uuid, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_user_spend(uuid, numeric) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_user_spend(uuid, numeric) FROM anon;