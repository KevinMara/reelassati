import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    const dbCheck = await prisma.$queryRaw`SELECT 1`.catch(() => null);
    
    // Check users_profile table columns
    const columns = await prisma.$queryRaw<any[]>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users_profile'
    `.catch(() => []);
    
    const columnNames = columns.map((c: any) => c.column_name);


    return NextResponse.json({
      ok: true,
      databaseConnected: !!dbCheck,
      usersProfileHasPasswordHash: columnNames.includes('password_hash'),
      usersProfileHasAuthProvider: columnNames.includes('auth_provider'),
      usersProfileHasUpdatedAt: columnNames.includes('updated_at'),
      authSecretConfigured: !!(process.env.AUTH_SECRET || process.env.INTERNAL_AGENT_SECRET),
      passwordHashLibraryAvailable: typeof bcrypt.hash === 'function',
      googleAuthConfigured: false
    });
  } catch (error: any) {
    console.error("Auth debug error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
