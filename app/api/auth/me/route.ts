import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
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
      return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });
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
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
