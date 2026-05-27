import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword, createSession } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
    }

    const normalizedEmail = (email as string).toLowerCase().trim();

    try {
      const user = await prisma.userProfile.findUnique({
        where: { email: normalizedEmail },
      });

      if (!user || !user.passwordHash) {
        return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401 });
      }

      const isValid = await comparePassword(password, user.passwordHash);

      if (!isValid) {
        return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401 });
      }

      await createSession(user.id);

      return NextResponse.json({
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          display_name: user.displayName,
        },
      });
    } catch (dbError: any) {
      console.error("Database error during login:", dbError);
      return NextResponse.json({ ok: false, error: "database_error", details: dbError.message }, { status: 500 });
    }
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
