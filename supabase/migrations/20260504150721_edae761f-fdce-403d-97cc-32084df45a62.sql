
ALTER TABLE public.jobs REPLICA IDENTITY FULL;
CREATE INDEX IF NOT EXISTS idx_jobs_user_created ON public.jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_agent_status ON public.jobs(agent_name, status);
