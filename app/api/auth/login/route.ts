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
  password_hash: string | null;
};

function cleanEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export async function POST(request: NextRequest) {
  try {
    await ensureAuthSchema();

    const body = await request.json().catch(() => ({}));
    const email = cleanEmail(body.email);
    const password = typeof body.password === "string" ? body.password : "";

    if (!email.includes("@") || password.length < 1) {
      return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
    }

    const rows = await prisma.$queryRaw<UserRow[]>`
      SELECT id::text, email, display_name, password_hash
      FROM users_profile
      WHERE lower(email) = lower(${email})
      LIMIT 1
    `;

    const user = rows[0];

    if (!user?.password_hash) {
      return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401 });
    }

    const safeUser = {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
    };

    const token = await createSessionToken(safeUser);

    const response = NextResponse.json({ ok: true, user: safeUser });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (error: any) {
    console.error("Login error:", {
      code: error?.code,
      message: error?.message,
      meta: error?.meta,
    });

    if (error?.code === "P2022") {
      return NextResponse.json({ ok: false, error: "auth_schema_error", code: "P2022" }, { status: 500 });
    }

    return NextResponse.json({ ok: false, error: "auth_database_error" }, { status: 500 });
  }
}

