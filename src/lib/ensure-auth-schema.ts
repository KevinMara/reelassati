import { prisma } from "./prisma";

/**
 * Idempotent schema repair for the users_profile table.
 * Adds missing columns required for email/password authentication.
 * Server-only.
 */
export async function ensureAuthSchema() {
  if (typeof window !== "undefined") {
    throw new Error("ensureAuthSchema can only be called on the server");
  }

  try {
    console.log("[SCHEMA] Checking and repairing users_profile schema...");
    
    // 1. Add missing columns if they don't exist
    // We use raw query to handle schema mismatches
    await prisma.$executeRawUnsafe(`
      ALTER TABLE users_profile
      ADD COLUMN IF NOT EXISTS display_name TEXT,
      ADD COLUMN IF NOT EXISTS password_hash TEXT,
      ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'email',
      ADD COLUMN IF NOT EXISTS google_id TEXT,
      ADD COLUMN IF NOT EXISTS avatar_url TEXT,
      ADD COLUMN IF NOT EXISTS user_id UUID,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
    `);

    // 2. Ensure defaults and backfills
    await prisma.$executeRawUnsafe(`
      UPDATE users_profile
      SET
        auth_provider = COALESCE(auth_provider, 'email'),
        updated_at = COALESCE(updated_at, now()),
        created_at = COALESCE(created_at, now()),
        user_id = COALESCE(user_id, id)
      WHERE auth_provider IS NULL OR updated_at IS NULL OR created_at IS NULL OR user_id IS NULL;
    `);

    // 3. Optional: If we found user_id was NOT NULL and failing, we ensure it's handled.
    // Based on the 23502 error hint, if user_id was added as NOT NULL without a default, we fix it.
    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN 
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users_profile' AND column_name = 'user_id' AND is_nullable = 'NO'
        ) THEN
          ALTER TABLE users_profile ALTER COLUMN user_id DROP NOT NULL;
        END IF;
      END $$;
    `);

    console.log("[SCHEMA] users_profile schema repair completed successfully.");
    return { ok: true };
  } catch (error: any) {
    console.error("[SCHEMA] Schema repair failed:", {
      message: error.message,
      code: error.code
    });
    return { ok: false, error: error.message, code: error.code };
  }
}
