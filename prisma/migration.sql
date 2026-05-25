-- CreateTable users_profile
CREATE TABLE IF NOT EXISTS "users_profile" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "email" TEXT,
    "displayName" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_profile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "users_profile_userId_key" ON "users_profile"("userId");

-- CreateTable clients
CREATE TABLE IF NOT EXISTS "clients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable tribe_runs
CREATE TABLE IF NOT EXISTS "tribe_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" UUID NOT NULL,
    "video_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "output" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable video_analyses
CREATE TABLE IF NOT EXISTS "video_analyses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "video_id" UUID NOT NULL,
    "data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "video_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable scripts
CREATE TABLE IF NOT EXISTS "scripts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "video_id" UUID NOT NULL,
    "content" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "scripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable edit_plans
CREATE TABLE IF NOT EXISTS "edit_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "video_id" UUID NOT NULL,
    "steps" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "edit_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable publishing_plans
CREATE TABLE IF NOT EXISTS "publishing_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "video_id" UUID NOT NULL,
    "platforms" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "publishing_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable analytics_snapshots
CREATE TABLE IF NOT EXISTS "analytics_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "video_id" UUID NOT NULL,
    "platform" TEXT NOT NULL,
    "metrics" JSONB,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "analytics_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable platform_learnings
CREATE TABLE IF NOT EXISTS "platform_learnings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "platform" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "platform_learnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable cost_events
CREATE TABLE IF NOT EXISTS "cost_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "event_type" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cost_events_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tribe_runs" ADD CONSTRAINT "tribe_runs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tribe_runs" ADD CONSTRAINT "tribe_runs_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "video_analyses" ADD CONSTRAINT "video_analyses_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "scripts" ADD CONSTRAINT "scripts_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "edit_plans" ADD CONSTRAINT "edit_plans_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "publishing_plans" ADD CONSTRAINT "publishing_plans_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "analytics_snapshots" ADD CONSTRAINT "analytics_snapshots_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
