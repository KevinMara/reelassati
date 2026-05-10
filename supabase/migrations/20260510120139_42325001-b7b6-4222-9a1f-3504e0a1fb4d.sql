-- Revoke EXECUTE from PUBLIC for all security definer functions in public schema
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_first_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_owner(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_owns_client(uuid, uuid) FROM PUBLIC, anon;

-- Ensure authenticated users can still execute the functions needed for RLS
GRANT EXECUTE ON FUNCTION public.is_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_owns_client(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_first_user() TO authenticated;
