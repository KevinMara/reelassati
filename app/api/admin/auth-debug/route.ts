import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import fs from "fs";
import path from "path";
import { createHash } from "crypto";

export const dynamic = 'force-dynamic';

function getFingerprint(url: string | undefined): string {
  if (!url) return "none";
  const hash = createHash("sha256").update(url).digest("hex");
  return `sha256:${hash.slice(-8)}`;
}

export async function GET() {
  const debugInfo: any = {
    ok: true,
    databaseConnected: false,
    runtime: typeof process !== 'undefined' ? `Node ${process.version}` : 'Unknown',
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    vercelGitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA,
    vercelGitCommitRef: process.env.VERCEL_GIT_COMMIT_REF,
    databaseUrlConfigured: !!(process.env.DATABASE_URL),
    postgresUrlConfigured: !!(process.env.POSTGRES_URL),
    databaseUrlFingerprint: getFingerprint(process.env.DATABASE_URL),
    postgresUrlFingerprint: getFingerprint(process.env.POSTGRES_URL),
    currentDatabase: null,
    currentSchema: null,
    currentUser: null,
    usersProfileRegclass: null,
    usersProfileColumnsOrdered: [],
    notNullColumns: [],
    constraints: [],
    triggers: [],
    rules: [],
    viewsOrTablesNamedUsersProfile: [],
    authRoutesDetected: {
      signup: fs.existsSync(path.join(process.cwd(), "app/api/auth/signup/route.ts")),
      login: fs.existsSync(path.join(process.cwd(), "app/api/auth/login/route.ts")),
      logout: fs.existsSync(path.join(process.cwd(), "app/api/auth/logout/route.ts")),
      me: fs.existsSync(path.join(process.cwd(), "app/api/auth/me/route.ts"))
    },
    authSecretConfigured: !!(process.env.AUTH_SECRET),
    internalAgentSecretConfigured: !!(process.env.INTERNAL_AGENT_SECRET),
    sessionSecretConfigured: !!(process.env.AUTH_SECRET || process.env.INTERNAL_AGENT_SECRET),
    bcryptAvailable: typeof bcrypt?.hash === 'function',
    joseAvailable: typeof SignJWT === 'function'
  };

  try {
    const dbCheck = await prisma.$queryRaw`SELECT 1 as connected, current_database(), current_schema(), current_user`.catch(() => null) as any[];

    if (dbCheck && dbCheck[0]?.connected === 1) {
      debugInfo.databaseConnected = true;
      debugInfo.currentDatabase = dbCheck[0].current_database;
      debugInfo.currentSchema = dbCheck[0].current_schema;
      debugInfo.currentUser = dbCheck[0].current_user;

      const regclass = await prisma.$queryRaw`SELECT 'public.users_profile'::regclass::text as reg`.catch(() => null) as any[];
      debugInfo.usersProfileRegclass = regclass ? regclass[0]?.reg : null;

      const columns: any[] = await prisma.$queryRaw`
        SELECT 
          ordinal_position as "ordinalPosition",
          column_name as "columnName", 
          is_nullable = 'YES' as "nullable", 
          column_default is not null as "hasDefault",
          column_default as "columnDefault",
          data_type as "dataType" 
        FROM information_schema.columns 
        WHERE table_name = 'users_profile'
        AND table_schema = 'public'
        ORDER BY ordinal_position
      `;
      debugInfo.usersProfileColumnsOrdered = columns || [];
      debugInfo.notNullColumns = (columns || [])
        .filter(c => !c.nullable)
        .map(c => c.columnName);

      const constraints: any[] = await prisma.$queryRaw`
        SELECT
          conname AS name,
          contype AS type,
          pg_get_constraintdef(oid) AS definition
        FROM pg_constraint
        WHERE conrelid = 'public.users_profile'::regclass
        ORDER BY conname
      `.catch(() => []);
      debugInfo.constraints = constraints || [];

      const triggers: any[] = await prisma.$queryRaw`
        SELECT 
          trigger_name as "triggerName",
          event_manipulation as "eventManipulation",
          action_statement as "actionStatement"
        FROM information_schema.triggers
        WHERE event_object_table = 'users_profile'
      `.catch(() => []);
      debugInfo.triggers = triggers || [];

      const rules: any[] = await prisma.$queryRaw`
        SELECT 
          schemaname, tablename, rulename as "ruleName", definition
        FROM pg_rules
        WHERE tablename = 'users_profile'
      `.catch(() => []);
      debugInfo.rules = rules || [];

      const viewsTables: any[] = await prisma.$queryRaw`
        SELECT table_schema as "tableSchema", table_name as "tableName", table_type as "tableType"
        FROM information_schema.tables
        WHERE table_name = 'users_profile'
      `.catch(() => []);
      debugInfo.viewsOrTablesNamedUsersProfile = viewsTables || [];
    }
  } catch (error: any) {
    debugInfo.databaseConnected = false;
    debugInfo.error = error.message;
  }

  return NextResponse.json(debugInfo);
}
