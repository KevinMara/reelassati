import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = 'force-dynamic';

export async function GET() {
  const guard = await requireAdmin();
  if (guard) return guard;
  
  try {
    const dbCheck = await prisma.$queryRaw`SELECT 1`.catch(() => null);
    
    // Check users_profile table columns
    const columns = await prisma.$queryRaw<any[]>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'users_profile'
    `.catch(() => []);
    
    const columnNames = columns.map((c: any) => c.column_name);

    return NextResponse.json({
      ok: true,
      databaseConnected: !!dbCheck,
      usersProfileHasPasswordHash: columnNames.includes('password_hash'),
      usersProfileHasAuthProvider: columnNames.includes('auth_provider'),
      usersProfileHasGoogleId: columnNames.includes('google_id'),
      usersProfileHasAvatarUrl: columnNames.includes('avatar_url'),
      usersProfileHasUpdatedAt: columnNames.includes('updated_at'),
      authSecretConfigured: !!(process.env.AUTH_SECRET || process.env.INTERNAL_AGENT_SECRET),
      passwordHashLibraryAvailable: typeof bcrypt.hash === 'function',
      googleClientIdConfigured: !!process.env.GOOGLE_CLIENT_ID,
      googleClientSecretConfigured: !!process.env.GOOGLE_CLIENT_SECRET,
      googleRedirectUriConfigured: !!process.env.GOOGLE_REDIRECT_URI,
      googleAuthConfigured: !!(
        process.env.GOOGLE_CLIENT_ID &&
        process.env.GOOGLE_CLIENT_SECRET &&
        process.env.GOOGLE_REDIRECT_URI
      )
    });
  } catch (error: any) {
    console.error("Auth debug error:", error);
    return NextResponse.json({ ok: false, databaseConnected: false, error: error.message }, { status: 500 });
  }
}
