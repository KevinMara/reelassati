import { NextResponse } from "next/server";
import { getSession } from "./auth";
import { prisma } from "./prisma";

/**
 * Returns null if request is from an authenticated admin user.
 * Returns a NextResponse (401/403) otherwise.
 *
 * Admins are determined by env var ADMIN_EMAILS (comma-separated).
 * If ADMIN_EMAILS is not configured, all admin access is denied.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const session = await getSession();
  if (!session || !session.userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (adminEmails.length === 0) {
    return NextResponse.json({ ok: false, error: "admin_not_configured" }, { status: 403 });
  }

  try {
    const user = await prisma.userProfile.findUnique({
      where: { id: session.userId },
      select: { email: true },
    });
    if (!user || !adminEmails.includes(user.email.toLowerCase())) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  return null;
}

export async function isAdminSession(): Promise<boolean> {
  const session = await getSession();
  if (!session?.userId) return false;
  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (adminEmails.length === 0) return false;
  try {
    const user = await prisma.userProfile.findUnique({
      where: { id: session.userId },
      select: { email: true },
    });
    return !!user && adminEmails.includes(user.email.toLowerCase());
  } catch {
    return false;
  }
}
