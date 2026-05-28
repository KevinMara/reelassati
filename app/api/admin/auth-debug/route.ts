import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import * as jose from "jose";

export const dynamic = 'force-dynamic';

export async function GET() {
  const debugInfo: any = {
    ok: true,
    databaseConnected: false,
    usersProfileColumns: {
      id: false,
      email: false,
      display_name: false,
      password_hash: false,
      auth_provider: false,
      created_at: false,
      updated_at: false
    },
    authSecretConfigured: !!process.env.AUTH_SECRET,
    internalAgentSecretConfigured: !!process.env.INTERNAL_AGENT_SECRET,
    bcryptAvailable: typeof bcrypt.hash === 'function',
    joseAvailable: typeof jose.SignJWT === 'function',
    databaseUrlConfigured: !!process.env.DATABASE_URL,
    postgresUrlConfigured: !!process.env.POSTGRES_URL
  };

  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    debugInfo.databaseConnected = true;

    // Check columns in users_profile table
    // Note: We use the actual table name 'users_profile' as defined in prisma/schema.prisma @@map
    const columns: any[] = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users_profile'
    `;

    if (columns && Array.isArray(columns)) {
      const columnNames = columns.map(c => c.column_name);
      debugInfo.usersProfileColumns = {
        id: columnNames.includes('id'),
        email: columnNames.includes('email'),
        display_name: columnNames.includes('display_name'),
        password_hash: columnNames.includes('password_hash'),
        auth_provider: columnNames.includes('auth_provider'),
        created_at: columnNames.includes('created_at'),
        updated_at: columnNames.includes('updated_at')
      };
    }
  } catch (error) {
    console.error("[AUTH-DEBUG] Database check failed:", error);
    debugInfo.databaseConnected = false;
  }

  return NextResponse.json(debugInfo);
}
