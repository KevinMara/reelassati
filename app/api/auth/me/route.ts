import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    const session: any = await getSession();

    const userId = session?.userId || session?.sub || session?.id;

    if (!userId) {
      return json({ ok: false, user: null });
    }

    const users = await prisma.$queryRaw<any[]>`
      SELECT
        id::text AS id,
        email,
        COALESCE("displayName", display_name, email) AS display_name
      FROM users_profile
      WHERE id = ${userId}::uuid
      LIMIT 1;
    `;

    const user = users[0];

    if (!user) {
      return json({ ok: false, user: null, reason: "user_not_found" });
    }

    return json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
      },
    });
  } catch (error: any) {
    console.error("Me error:", {
      code: error?.code,
      message: error?.message,
      meta: error?.meta,
    });

    return json({ ok: false, user: null, error: "invalid_session" });
  }
}
