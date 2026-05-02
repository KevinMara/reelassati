GRANT EXECUTE ON FUNCTION public.is_owner(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.user_owns_client(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_first_user() TO authenticated, anon;