-- This trigger helper manages RLS for database-owner DDL and must never be
-- callable through the public Data API.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
