import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
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

    const passwordHash = await bcrypt.hash(password, 12);

    const created = await prisma.$queryRaw<UserRow[]>`
      INSERT INTO users_profile (email, display_name, password_hash, auth_provider, updated_at)
      VALUES (${email}, ${name}, ${passwordHash}, 'email', now())
      RETURNING id::text, email, display_name
    `;

    const user = created[0];
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

    if (error?.code === "P2002" || error?.code === "23505") {
      return NextResponse.json({ ok: false, error: "email_already_exists" }, { status: 409 });
    }

    if (error?.code === "P2022") {
      return NextResponse.json({ ok: false, error: "auth_schema_error", code: "P2022" }, { status: 500 });
    }

    return NextResponse.json({ ok: false, error: "auth_database_error" }, { status: 500 });
  }
}
