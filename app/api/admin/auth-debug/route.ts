import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureAuthSchema } from "@/lib/ensure-auth-schema";
import { hasSessionSecret } from "@/lib/auth-session";

export const runtime = "nodejs";

export async function GET() {
  const result: any = {
    ok: true,
    databaseConnected: false,
    usersProfileColumns: {},
    authSecretConfigured: Boolean(process.env.AUTH_SECRET),
    internalAgentSecretConfigured: Boolean(process.env.INTERNAL_AGENT_SECRET),
    sessionSecretConfigured: hasSessionSecret(),
    databaseUrlConfigured: Boolean(process.env.DATABASE_URL),
    postgresUrlConfigured: Boolean(process.env.POSTGRES_URL),
    bcryptAvailable: true,
    joseAvailable: true,
  };

  try {
    await ensureAuthSchema();
    await prisma.$queryRaw`SELECT 1`;
    result.databaseConnected = true;

    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users_profile'
    `;

    const names = new Set(columns.map((c) => c.column_name));

    for (const column of [
      "id",
      "email",
      "display_name",
      "password_hash",
      "auth_provider",
      "google_id",
      "avatar_url",
      "created_at",
      "updated_at",
    ]) {
      result.usersProfileColumns[column] = names.has(column);
    }

    return NextResponse.json(result);
  } catch (error: any) {
    result.ok = false;
    result.error = "auth_debug_failed";
    result.code = error?.code || null;
    result.message = error?.message || null;
    return NextResponse.json(result, { status: 500 });
  }
}
