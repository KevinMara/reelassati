export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth-session";

type DbColumn = {
  column_name: string;
  is_nullable: string;
  column_default: string | null;
  data_type: string;
};

type UserRow = {
  id: string;
  email: string;
  display_name: string | null;
};

function cleanEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function cleanName(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

async function getUsersProfileColumns() {
  const rows = await prisma.$queryRaw<DbColumn[]>`
    SELECT column_name, is_nullable, column_default, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users_profile'
    ORDER BY ordinal_position
  `;

  return rows;
}

async function ensureSafeAuthColumns(columns: DbColumn[]) {
  const names = new Set(columns.map((c) => c.column_name));

  if (!names.has("users_profile")) {
    // no-op, kept intentionally harmless
  }

  if (!names.has("display_name")) {
    await prisma.$executeRawUnsafe(`ALTER TABLE public.users_profile ADD COLUMN IF NOT EXISTS display_name TEXT`);
  }

  if (!names.has("password_hash")) {
    await prisma.$executeRawUnsafe(`ALTER TABLE public.users_profile ADD COLUMN IF NOT EXISTS password_hash TEXT`);
  }

  if (!names.has("auth_provider")) {
    await prisma.$executeRawUnsafe(`ALTER TABLE public.users_profile ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'email'`);
  }

  if (!names.has("created_at")) {
    await prisma.$executeRawUnsafe(`ALTER TABLE public.users_profile ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now()`);
  }

  if (!names.has("updated_at")) {
    await prisma.$executeRawUnsafe(`ALTER TABLE public.users_profile ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()`);
  }

  if (!names.has("google_id")) {
    await prisma.$executeRawUnsafe(`ALTER TABLE public.users_profile ADD COLUMN IF NOT EXISTS google_id TEXT`);
  }

  if (!names.has("avatar_url")) {
    await prisma.$executeRawUnsafe(`ALTER TABLE public.users_profile ADD COLUMN IF NOT EXISTS avatar_url TEXT`);
  }

  if (names.has("user_id")) {
    await prisma.$executeRawUnsafe(`
      UPDATE public.users_profile
      SET user_id = id
      WHERE user_id IS NULL
    `);
  }

  await prisma.$executeRawUnsafe(`
    UPDATE public.users_profile
    SET auth_provider = COALESCE(auth_provider, 'email')
    WHERE auth_provider IS NULL
  `);

  await prisma.$executeRawUnsafe(`
    UPDATE public.users_profile
    SET updated_at = COALESCE(updated_at, now())
    WHERE updated_at IS NULL
  `);
}

function buildInsertPlan(columns: DbColumn[], input: { id: string; email: string; name: string; passwordHash: string }) {
  const byName = new Map(columns.map((c) => [c.column_name, c]));
  const insert: Record<string, string> = {};

  if (byName.has("id")) insert.id = input.id;
  if (byName.has("userId")) insert.userId = input.id;
  if (byName.has("user_id")) insert.user_id = input.id;
  if (byName.has("email")) insert.email = input.email;
  if (byName.has("displayName")) insert.displayName = input.name;
  if (byName.has("display_name")) insert.display_name = input.name;
  if (byName.has("name")) insert.name = input.name;
  if (byName.has("password_hash")) insert.password_hash = input.passwordHash;
  if (byName.has("auth_provider")) insert.auth_provider = "email";
  if (byName.has("google_id")) insert.google_id = null as any;
  if (byName.has("avatar_url")) insert.avatar_url = null as any;

  const safeKnown = new Set([
    "id",
    "userId",
    "user_id",
    "email",
    "displayName",
    "display_name",
    "name",
    "password_hash",
    "auth_provider",
    "google_id",
    "avatar_url",
    "created_at",
    "updated_at",
  ]);

  const unsupportedRequired = columns
    .filter((c) => c.is_nullable === "NO")
    .filter((c) => !c.column_default)
    .filter((c) => !safeKnown.has(c.column_name))
    .map((c) => c.column_name);

  return { insert, unsupportedRequired };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const name = cleanName(body.name);
    const email = cleanEmail(body.email);
    const password = typeof body.password === "string" ? body.password : "";

    if (!name || !email.includes("@") || password.length < 8) {
      return json({ ok: false, error: "invalid_input" }, 400);
    }

    let columns = await getUsersProfileColumns();

    if (!columns.length) {
      return json({ ok: false, error: "auth_schema_error", message: "users_profile_not_found" }, 500);
    }

    await ensureSafeAuthColumns(columns);
    columns = await getUsersProfileColumns();

    const existing = await prisma.$queryRaw<UserRow[]>`
      SELECT id::text, email, display_name
      FROM public.users_profile
      WHERE lower(email) = lower(${email})
      LIMIT 1
    `;

    if (existing.length > 0) {
      return json({ ok: false, error: "email_already_exists" }, 409);
    }

    const id = randomUUID();
    const passwordHash = await bcrypt.hash(password, 12);

        const created = await prisma.$queryRaw<UserRow[]>`
      INSERT INTO public.users_profile (
        "id",
        "userId",
        "email",
        "displayName",
        "password_hash",
        "auth_provider",
        "display_name",
        "user_id",
        "created_at",
        "updated_at"
      )
      VALUES (
        ${id}::uuid,
        ${id},
        ${email},
        ${name},
        ${passwordHash},
        'email',
        ${name},
        ${id}::uuid,
        now(),
        now()
      )
      RETURNING id::text, email, display_name
    `;
    const user = created[0];

    if (!user?.id) {
      return json({ ok: false, error: "auth_database_error", message: "user_not_created" }, 500);
    }

    const token = await createSessionToken(user);

    const response = json({ ok: true, user });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (error: any) {
    console.error("Signup error:", {
      code: error?.code,
      meta: error?.meta,
      message: error?.message,
    });

    if (error?.code === "P2002" || String(error?.message || "").includes("duplicate key")) {
      return json({ ok: false, error: "email_already_exists" }, 409);
    }

    if (error?.code === "P2022") {
      return json({ ok: false, error: "auth_schema_error", code: "P2022" }, 500);
    }

    if (error?.code === "P2010" && String(error?.message || "").includes("23502")) {
      return json({ ok: false, error: "auth_database_error", code: "23502", message: "not_null_violation" }, 500);
    }

    return json({
      ok: false,
      error: "auth_database_error",
      debugCode: error?.code || null,
      debugMeta: error?.meta || null,
      debugMessage: String(error?.message || "").slice(0, 500)
    }, 500);
  }
}






