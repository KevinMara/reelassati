import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureAuthSchema } from "@/lib/ensure-auth-schema";
import { readSessionToken, SESSION_COOKIE } from "@/lib/auth-session";

export const runtime = "nodejs";

type UserRow = {
  id: string;
  email: string;
  display_name: string | null;
};

export async function GET(request: NextRequest) {
  try {
    await ensureAuthSchema();

    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const session = await readSessionToken(token);

    if (!session) {
      return NextResponse.json({ ok: false, user: null });
    }

    const rows = await prisma.$queryRaw<UserRow[]>`
      SELECT id::text, email, display_name
      FROM users_profile
      WHERE id = ${session.id}::uuid
      LIMIT 1
    `;

    const user = rows[0];

    if (!user) {
      return NextResponse.json({ ok: false, user: null });
    }

    return NextResponse.json({ ok: true, user });
  } catch (error: any) {
    console.error("Me error:", {
      code: error?.code,
      message: error?.message,
      meta: error?.meta,
    });

    return NextResponse.json({ ok: false, user: null });
  }
}
