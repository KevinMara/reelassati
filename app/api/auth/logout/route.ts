import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth-session";
import { ensureAuthSchema } from "@/lib/ensure-auth-schema";

export const runtime = "nodejs";

export async function POST() {
  await ensureAuthSchema().catch(() => null);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
