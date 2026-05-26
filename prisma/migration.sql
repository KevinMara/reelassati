-- Create Extension for UUID generation if not exists
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateTable users_profile
CREATE TABLE IF NOT EXISTS "users_profile" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "display_name" TEXT,
    "password_hash" TEXT,
    "auth_provider" TEXT DEFAULT 'email',
    "created_at" TIMESTAMPTZ DEFAULT now(),
    "updated_at" TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT "users_profile_pkey" PRIMARY KEY ("id")
);

-- Make email unique if not already
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'users_profile_email_key') THEN
        CREATE UNIQUE INDEX "users_profile_email_key" ON "users_profile"("email");
    END IF;
END $$;

-- Add updated_at if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users_profile' AND column_name='updated_at') THEN
        ALTER TABLE "users_profile" ADD COLUMN "updated_at" TIMESTAMPTZ DEFAULT now();
    END IF;
END $$;

-- Add password_hash if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users_profile' AND column_name='password_hash') THEN
        ALTER TABLE "users_profile" ADD COLUMN "password_hash" TEXT;
    END IF;
END $$;

-- Add auth_provider if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users_profile' AND column_name='auth_provider') THEN
        ALTER TABLE "users_profile" ADD COLUMN "auth_provider" TEXT DEFAULT 'email';
    END IF;
END $$;

-- Ensure created_at is TIMESTAMPTZ
ALTER TABLE "users_profile" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;
ALTER TABLE "users_profile" ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ;

-- CreateTable clients
CREATE TABLE IF NOT EXISTS "clients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable videos
CREATE TABLE IF NOT EXISTS "videos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" UUID,
    "owner_user_id" TEXT NOT NULL,
    "url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable jobs
CREATE TABLE IF NOT EXISTS "jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "video_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "job_type" TEXT NOT NULL,
    "payload" JSONB,
    "result" JSONB,
    "created_at" TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable tribe_runs
CREATE TABLE IF NOT EXISTS "tribe_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" UUID NOT NULL,
    "video_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "output" JSONB,
    "created_at" TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT "tribe_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable agent_runs
CREATE TABLE IF NOT EXISTS "agent_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" UUID NOT NULL,
    "video_id" UUID NOT NULL,
    "agent_name" TEXT NOT NULL,
    "input" JSONB,
    "output" JSONB,
    "created_at" TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable video_analyses
CREATE TABLE IF NOT EXISTS "video_analyses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "video_id" UUID NOT NULL,
    "data" JSONB,
    "created_at" TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT "video_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable scripts
CREATE TABLE IF NOT EXISTS "scripts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "video_id" UUID NOT NULL,
    "content" JSONB,
    "created_at" TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT "scripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable edit_plans
CREATE TABLE IF NOT EXISTS "edit_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "video_id" UUID NOT NULL,
    "steps" JSONB,
    "created_at" TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT "edit_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable publishing_plans
CREATE TABLE IF NOT EXISTS "publishing_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "video_id" UUID NOT NULL,
    "platforms" JSONB,
    "created_at" TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT "publishing_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable analytics_snapshots
CREATE TABLE IF NOT EXISTS "analytics_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "video_id" UUID NOT NULL,
    "platform" TEXT NOT NULL,
    "metrics" JSONB,
    "captured_at" TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT "analytics_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable platform_learnings
CREATE TABLE IF NOT EXISTS "platform_learnings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "platform" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT "platform_learnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable cost_events
CREATE TABLE IF NOT EXISTS "cost_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "event_type" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT "cost_events_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'videos_client_id_fkey') THEN
        ALTER TABLE "videos" ADD CONSTRAINT "videos_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_video_id_fkey') THEN
        ALTER TABLE "jobs" ADD CONSTRAINT "jobs_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tribe_runs_job_id_fkey') THEN
        ALTER TABLE "tribe_runs" ADD CONSTRAINT "tribe_runs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tribe_runs_video_id_fkey') THEN
        ALTER TABLE "tribe_runs" ADD CONSTRAINT "tribe_runs_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_runs_job_id_fkey') THEN
        ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_runs_video_id_fkey') THEN
        ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'video_analyses_video_id_fkey') THEN
        ALTER TABLE "video_analyses" ADD CONSTRAINT "video_analyses_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'scripts_video_id_fkey') THEN
        ALTER TABLE "scripts" ADD CONSTRAINT "scripts_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'edit_plans_video_id_fkey') THEN
        ALTER TABLE "edit_plans" ADD CONSTRAINT "edit_plans_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'publishing_plans_video_id_fkey') THEN
        ALTER TABLE "publishing_plans" ADD CONSTRAINT "publishing_plans_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'analytics_snapshots_video_id_fkey') THEN
        ALTER TABLE "analytics_snapshots" ADD CONSTRAINT "analytics_snapshots_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateIndexes
CREATE INDEX IF NOT EXISTS "idx_videos_owner_user_id" ON "videos"("owner_user_id");
CREATE INDEX IF NOT EXISTS "idx_videos_client_id" ON "videos"("client_id");
CREATE INDEX IF NOT EXISTS "idx_jobs_video_id" ON "jobs"("video_id");
CREATE INDEX IF NOT EXISTS "idx_jobs_status" ON "jobs"("status");
CREATE INDEX IF NOT EXISTS "idx_jobs_job_type" ON "jobs"("job_type");
CREATE INDEX IF NOT EXISTS "idx_tribe_runs_job_id" ON "tribe_runs"("job_id");
CREATE INDEX IF NOT EXISTS "idx_tribe_runs_video_id" ON "tribe_runs"("video_id");
CREATE INDEX IF NOT EXISTS "idx_agent_runs_job_id" ON "agent_runs"("job_id");
CREATE INDEX IF NOT EXISTS "idx_agent_runs_video_id" ON "agent_runs"("video_id");
CREATE INDEX IF NOT EXISTS "idx_video_analyses_video_id" ON "video_analyses"("video_id");
CREATE INDEX IF NOT EXISTS "idx_platform_learnings_archived" ON "platform_learnings"("archived");
CREATE INDEX IF NOT EXISTS "idx_platform_learnings_expires_at" ON "platform_learnings"("expires_at");
