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

-- Unique index on email
CREATE UNIQUE INDEX IF NOT EXISTS "users_profile_email_key" ON "users_profile"("email");

-- Grant permissions (if needed, but usually not for service role)
GRANT ALL ON "users_profile" TO service_role;
GRANT ALL ON "users_profile" TO authenticated;
GRANT ALL ON "users_profile" TO anon;
