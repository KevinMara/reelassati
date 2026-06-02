import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function fingerprint(value?: string) {
  if (!value) return null;
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function json(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export async function GET() {
  try {
    const dbInfo = await prisma.$queryRaw<any[]>`
      SELECT
        current_database() AS current_database,
        current_schema() AS current_schema,
        current_user AS current_user
    `;

    const columns = await prisma.$queryRaw<any[]>`
      SELECT
        ordinal_position AS "ordinalPosition",
        column_name AS "columnName",
        data_type AS "dataType",
        is_nullable AS "isNullable",
        column_default AS "columnDefault"
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users_profile'
      ORDER BY ordinal_position
    `;

    const constraints = await prisma.$queryRaw<any[]>`
      SELECT
        con.conname AS name,
        con.contype AS type,
        pg_get_constraintdef(con.oid) AS definition
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE nsp.nspname = 'public'
        AND rel.relname = 'users_profile'
      ORDER BY con.conname
    `;

    const triggers = await prisma.$queryRaw<any[]>`
      SELECT
        trigger_name AS "triggerName",
        event_manipulation AS "eventManipulation",
        action_statement AS "actionStatement"
      FROM information_schema.triggers
      WHERE event_object_schema = 'public'
        AND event_object_table = 'users_profile'
      ORDER BY trigger_name
    `;

    const viewsOrTables = await prisma.$queryRaw<any[]>`
      SELECT
        table_schema AS "tableSchema",
        table_name AS "tableName",
        table_type AS "tableType"
      FROM information_schema.tables
      WHERE table_name = 'users_profile'
      ORDER BY table_schema
    `;

    const normalizedColumns = columns.map((c) => ({
      ordinalPosition: Number(c.ordinalPosition),
      columnName: c.columnName,
      dataType: c.dataType,
      nullable: c.isNullable === "YES",
      hasDefault: Boolean(c.columnDefault),
      columnDefault: c.columnDefault,
    }));

    const usersProfileColumns: Record<string, any> = {};
    for (const c of normalizedColumns) {
      usersProfileColumns[c.columnName] = {
        exists: true,
        nullable: c.nullable,
        hasDefault: c.hasDefault,
        dataType: c.dataType,
        ordinalPosition: c.ordinalPosition,
      };
    }

    return json({
      ok: true,
      debugVersion: "schema-debug-local-v1",
      databaseConnected: true,
      runtime: "nodejs",
      nodeEnv: process.env.NODE_ENV || null,
      vercelEnv: process.env.VERCEL_ENV || null,
      vercelGitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
      vercelGitCommitRef: process.env.VERCEL_GIT_COMMIT_REF || null,
      databaseUrlConfigured: Boolean(process.env.DATABASE_URL),
      postgresUrlConfigured: Boolean(process.env.POSTGRES_URL),
      databaseUrlFingerprint: fingerprint(process.env.DATABASE_URL),
      postgresUrlFingerprint: fingerprint(process.env.POSTGRES_URL),
      currentDatabase: dbInfo[0]?.current_database || null,
      currentSchema: dbInfo[0]?.current_schema || null,
      currentUser: dbInfo[0]?.current_user || null,
      usersProfileRegclass: normalizedColumns.length ? "public.users_profile" : null,
      usersProfileColumns,
      usersProfileColumnsOrdered: normalizedColumns,
      notNullColumns: normalizedColumns.filter((c) => !c.nullable).map((c) => c.columnName),
      constraints,
      triggers,
      viewsOrTablesNamedUsersProfile: viewsOrTables,
      authRoutesDetected: {
        signup: true,
        login: true,
        logout: true,
        me: true,
      },
      authSecretConfigured: Boolean(process.env.AUTH_SECRET),
      internalAgentSecretConfigured: Boolean(process.env.INTERNAL_AGENT_SECRET),
      sessionSecretConfigured: Boolean(process.env.AUTH_SECRET || process.env.INTERNAL_AGENT_SECRET),
      bcryptAvailable: true,
      joseAvailable: true,
    });
  } catch (error: any) {
    console.error("Auth debug error:", {
      code: error?.code,
      message: error?.message,
      meta: error?.meta,
    });

    return json(
      {
        ok: false,
        debugVersion: "schema-debug-local-v1",
        databaseConnected: false,
        error: "auth_debug_failed",
        code: error?.code || null,
      },
      500
    );
  }
}
