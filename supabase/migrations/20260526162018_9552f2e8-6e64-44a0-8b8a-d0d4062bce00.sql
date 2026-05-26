ALTER TABLE "users_profile" ENABLE ROW LEVEL SECURITY;

-- Since the app uses its own session management and access via Prisma (service_role),
-- we can keep RLS enabled but with no public policies if we only use service_role.
-- However, if the frontend needs to query it directly (not recommended here), we'd need more.
-- For now, let's just enable it to satisfy the linter.
