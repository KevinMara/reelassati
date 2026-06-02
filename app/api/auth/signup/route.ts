import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { ensureAuthSchema } from "@/lib/ensure-auth-schema";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth-session";

export const runtime = "nodejs";

type UserRow = {
  id: string;
  email: string;
  display_name: string | null;
  password_hash?: string | null;
};

function cleanEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function cleanName(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isDuplicateEmail(error: any) {
  return (
    error?.code === "P2002" ||
    error?.meta?.code === "23505" ||
    String(error?.message || "").includes("duplicate key")
  );
}

export async function POST(request: NextRequest) {
  try {
    await ensureAuthSchema();

    const body = await request.json().catch(() => ({}));
    const name = cleanName(body.name);
    const email = cleanEmail(body.email);
    const password = typeof body.password === "string" ? body.password : "";

    if (!name || !email.includes("@") || password.length < 8) {
      return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
    }

    const existing = await prisma.$queryRaw<UserRow[]>`
      SELECT id::text, email, display_name, password_hash
      FROM users_profile
      WHERE lower(email) = lower(${email})
      LIMIT 1
    `;

    if (existing.length > 0) {
      return NextResponse.json({ ok: false, error: "email_already_exists" }, { status: 409 });
    }

    const id = randomUUID();
    const passwordHash = await bcrypt.hash(password, 12);

    const created = await prisma.$queryRaw<UserRow[]>`
      INSERT INTO users_profile (
        id,
        user_id,
        email,
        display_name,
        password_hash,
        auth_provider,
        created_at,
        updated_at
      )
      VALUES (
        ${id}::uuid,
        ${id}::uuid,
        ${email},
        ${name},
        ${passwordHash},
        'email',
        now(),
        now()
      )
      RETURNING id::text, email, display_name
    `;

    const user = created[0];

    if (!user?.id) {
      return NextResponse.json({ ok: false, error: "auth_database_error", message: "user_not_created" }, { status: 500 });
    }

    const token = await createSessionToken(user);

    const response = NextResponse.json({ ok: true, user });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (error: any) {
    console.error("Signup error:", {
      code: error?.code,
      message: error?.message,
      meta: error?.meta,
    });

    if (isDuplicateEmail(error)) {
      return NextResponse.json({ ok: false, error: "email_already_exists" }, { status: 409 });
    }

    return NextResponse.json(
      {
        ok: false,
        error: "auth_database_error",
        code: error?.code || null,
        dbCode: error?.meta?.code || null,
        message: error?.message || null,
      },
      { status: 500 }
    );
  }
}
