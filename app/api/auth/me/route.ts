import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureAuthSchema } from "@/lib/ensure-auth-schema";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Ensure schema is up to date
    await ensureAuthSchema();

    const session = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ ok: false, user: null });
    }

    const user = await prisma.userProfile.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        authProvider: true,
      },
    });

    if (!user) {
      // Session exists but user doesn't - session is orphaned
      return NextResponse.json({ ok: false, user: null });
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.displayName,
        avatar_url: user.avatarUrl,
        auth_provider: user.authProvider,
      },
    });
  } catch (error) {
    console.error("Auth me error:", error);
    return NextResponse.json({ ok: false, user: null });
  }
}
