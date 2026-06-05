import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword, createSession } from "@/lib/auth";
import { ensureAuthSchema } from "@/lib/ensure-auth-schema";

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // Ensure schema is up to date before any operation
    await ensureAuthSchema();

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
    }

    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401 });
    }

    const normalizedEmail = (email as string).toLowerCase().trim();

    try {
      // Find user case-insensitively using raw query for exact control
      const results: any[] = await prisma.$queryRaw`
        SELECT id::text, email, display_name, password_hash, auth_provider
        FROM users_profile
        WHERE lower(email) = lower(${normalizedEmail})
        LIMIT 1;
      `;

      const user = results[0];

      if (!user || !user.password_hash || user.auth_provider !== "email") {
        return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401 });
      }

      const isValid = await comparePassword(password, user.password_hash);

      if (!isValid) {
        return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401 });
      }

      try {
        await createSession(user.id);
      } catch (sessionError) {
        console.error("Session creation failed during login:", sessionError);
        return NextResponse.json({ ok: false, error: "auth_session_error" }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          display_name: user.display_name,
        },
      });
    } catch (dbError: any) {
      console.error("Database error during login:", dbError);
      
      // Prisma P2022 is Column does not exist
      if (dbError.code === 'P2022') {
        return NextResponse.json({ 
          ok: false, 
          error: "auth_schema_error", 
          code: "P2022" 
        }, { status: 500 });
      }

      return NextResponse.json({ 
        ok: false, 
        error: "auth_database_error", 
        code: dbError.code || "UNKNOWN_PRISMA_ERROR" 
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error("Login exception:", error);
    return NextResponse.json({ ok: false, error: "auth_database_error" }, { status: 500 });
  }
}
