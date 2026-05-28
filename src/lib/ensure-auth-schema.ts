import "server-only";
import { prisma } from "@/lib/prisma";

let ensured: Promise<void> | null = null;

export function ensureAuthSchema() {
  if (!ensured) {
    ensured = (async () => {
      await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS users_profile (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email TEXT UNIQUE,
          display_name TEXT,
          created_at TIMESTAMPTZ DEFAULT now()
        );
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE users_profile
        ADD COLUMN IF NOT EXISTS display_name TEXT,
        ADD COLUMN IF NOT EXISTS password_hash TEXT,
        ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'email',
        ADD COLUMN IF NOT EXISTS google_id TEXT,
        ADD COLUMN IF NOT EXISTS avatar_url TEXT,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
      `);

      await prisma.$executeRawUnsafe(`
        UPDATE users_profile
        SET
          auth_provider = COALESCE(auth_provider, 'email'),
          updated_at = COALESCE(updated_at, now());
      `);
    })();
  }

  return ensured;
}
