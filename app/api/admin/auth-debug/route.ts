import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let usersProfileHasPasswordHash = false;
    let usersProfileHasAuthProvider = false;
    let usersProfileHasGoogleId = false;
    let usersProfileHasAvatarUrl = false;
    let usersProfileHasUpdatedAt = false;
    let databaseConnected = false;

    try {
      // Check column existence
      const columns: any[] = await prisma.$queryRaw`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users_profile'
      `;
      const columnNames = columns.map(c => c.column_name);
      
      usersProfileHasPasswordHash = columnNames.includes('password_hash');
      usersProfileHasAuthProvider = columnNames.includes('auth_provider');
      usersProfileHasGoogleId = columnNames.includes('google_id');
      usersProfileHasAvatarUrl = columnNames.includes('avatar_url');
      usersProfileHasUpdatedAt = columnNames.includes('updated_at');
      databaseConnected = true;
    } catch (e) {
      console.error("Database check failed in auth-debug:", e);
    }

    const googleClientIdConfigured = !!process.env.GOOGLE_CLIENT_ID;
    const googleClientSecretConfigured = !!process.env.GOOGLE_CLIENT_SECRET;
    const googleRedirectUriConfigured = !!process.env.GOOGLE_REDIRECT_URI;
    const authSecretConfigured = !!(process.env.AUTH_SECRET || process.env.INTERNAL_AGENT_SECRET);
    
    let passwordHashLibraryAvailable = false;
    try {
      const dummy = await bcrypt.hash("test", 10);
      passwordHashLibraryAvailable = !!dummy;
    } catch (e) {}

    return NextResponse.json({
      ok: true,
      databaseConnected,
      usersProfileHasPasswordHash,
      usersProfileHasAuthProvider,
      usersProfileHasGoogleId,
      usersProfileHasAvatarUrl,
      usersProfileHasUpdatedAt,
      authSecretConfigured,
      passwordHashLibraryAvailable,
      googleClientIdConfigured,
      googleClientSecretConfigured,
      googleRedirectUriConfigured,
      googleAuthConfigured: googleClientIdConfigured && googleClientSecretConfigured && googleRedirectUriConfigured
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
