REVOKE EXECUTE ON FUNCTION public.is_owner(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_first_user() FROM anon, authenticated, public;