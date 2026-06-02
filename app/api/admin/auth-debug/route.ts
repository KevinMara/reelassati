import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import fs from "fs";
import path from "path";

export const dynamic = 'force-dynamic';

export async function GET() {
  const debugInfo: any = {
    ok: true,
    databaseConnected: false,
    runtime: typeof process !== 'undefined' ? `Node ${process.version}` : 'Unknown',
    frameworkDetected: "Next.js App Router (Hybrid with React Router components)",
    activeSignupComponent: "app/auth/signup/page.tsx -> src/views/auth/Signup.tsx",
    activeLoginComponent: "app/auth/login/page.tsx -> src/views/auth/Login.tsx",
    activeDashboardComponent: "app/dashboard/page.tsx -> src/views/dashboard/DashboardHome.tsx",
    authRoutesDetected: {
      signup: fs.existsSync(path.join(process.cwd(), "app/api/auth/signup/route.ts")),
      login: fs.existsSync(path.join(process.cwd(), "app/api/auth/login/route.ts")),
      logout: fs.existsSync(path.join(process.cwd(), "app/api/auth/logout/route.ts")),
      me: fs.existsSync(path.join(process.cwd(), "app/api/auth/me/route.ts"))
    },
    usersProfileColumns: {
      id: { exists: false },
      user_id: { exists: false },
      email: { exists: false },
      display_name: { exists: false },
      password_hash: { exists: false },
      auth_provider: { exists: false },
      created_at: { exists: false },
      updated_at: { exists: false }
    },
    notNullColumns: [],
    authSecretConfigured: !!(process.env.AUTH_SECRET),
    internalAgentSecretConfigured: !!(process.env.INTERNAL_AGENT_SECRET),
    sessionSecretConfigured: !!(process.env.AUTH_SECRET || process.env.INTERNAL_AGENT_SECRET),
    databaseUrlConfigured: !!(process.env.DATABASE_URL),
    postgresUrlConfigured: !!(process.env.POSTGRES_URL),
    bcryptAvailable: typeof bcrypt?.hash === 'function',
    joseAvailable: typeof SignJWT === 'function'
  };

  try {
    // Check database connection
    const dbCheck = await prisma.$queryRaw`SELECT 1 as connected`.catch(() => null) as any[];

    if (dbCheck && dbCheck[0]?.connected === 1) {
      debugInfo.databaseConnected = true;

      // Detailed column inspection
      const columns: any[] = await prisma.$queryRaw`
        SELECT 
          column_name, 
          is_nullable, 
          column_default, 
          data_type 
        FROM information_schema.columns 
        WHERE table_name = 'users_profile'
        AND table_schema = 'public'
      `;

      if (columns && Array.isArray(columns)) {
        columns.forEach(col => {
          const name = col.column_name.toLowerCase();
          debugInfo.usersProfileColumns[name] = {
            exists: true,
            nullable: col.is_nullable === 'YES',
            hasDefault: col.column_default !== null,
            dataType: col.data_type
          };
          if (col.is_nullable === 'NO') {
            debugInfo.notNullColumns.push(name);
          }
        });
      }
    }
  } catch (error: any) {
    debugInfo.databaseConnected = false;
    debugInfo.error = error.message;
  }

  return NextResponse.json(debugInfo);
}
