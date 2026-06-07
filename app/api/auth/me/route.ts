import { NextRequest, NextResponse } from "next/server";
import { decodeJwt } from "jose";
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

export async function GET(request: NextRequest) {
  try {
    const rawCookie =
      request.cookies.get("reelassati_session")?.value ||
      request.cookies.get("session")?.value ||
      null;

    if (!rawCookie) {
      return json({ ok: false, user: null, reason: "no_cookie" });
    }

    let session: any = null;

    try {
      session = await getSession();
    } catch {}

    if (!session) {
      try {
        session = decodeJwt(rawCookie);
      } catch {}
    }

    const sessionUserId = session?.userId || session?.sub || session?.id || null;

    if (!sessionUserId) {
      return json({
        ok: false,
        user: null,
        reason: "no_user_id_in_session",
        sessionKeys: session ? Object.keys(session) : [],
      });
    }

    const users = await prisma.$queryRaw<any[]>`
      SELECT
        id::text AS id,
        email,
        COALESCE("displayName", display_name, email) AS display_name
      FROM users_profile
      WHERE
        id::text = ${sessionUserId}
        OR user_id::text = ${sessionUserId}
        OR "userId"::text = ${sessionUserId}
      LIMIT 1;
    `;

    const user = users[0];

    if (!user) {
      return json({
        ok: false,
        user: null,
        reason: "user_not_found_for_session_id",
        sessionUserId,
      });
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

    return json({
      ok: false,
      user: null,
      error: "me_failed",
      debugCode: error?.code || null,
      debugMessage: String(error?.message || "").slice(0, 300),
    });
  }
}
