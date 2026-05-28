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
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
    `);

    // 2. Ensure defaults are set for existing rows
    await prisma.$executeRawUnsafe(`
      UPDATE users_profile
      SET
        auth_provider = COALESCE(auth_provider, 'email'),
        updated_at = COALESCE(updated_at, now())
      WHERE auth_provider IS NULL OR updated_at IS NULL;
    `);

    console.log("[SCHEMA] users_profile schema repair completed successfully.");
    return { ok: true };
  } catch (error: any) {
    console.error("[SCHEMA] Schema repair failed:", {
      message: error.message,
      code: error.code
    });
    // We don't throw here to avoid blocking the app if the DB is partially working
    // but we return the error for the caller to handle if needed
    return { ok: false, error: error.message, code: error.code };
  }
}
