import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSession } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      console.error("[SIGNUP] Failed to parse request body:", e);
      return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
    }

    const { name, email, password } = body;

    if (!name || !email || !password) {
      console.warn("[SIGNUP] Missing required fields:", { name: !!name, email: !!email, password: !!password });
      return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
    }

    if (password.length < 8) {
      console.warn("[SIGNUP] Password too short");
      return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
    }

    const normalizedEmail = (email as string).toLowerCase().trim();
    
    // Basic email validation
    if (!normalizedEmail.includes("@") || !normalizedEmail.includes(".")) {
      console.warn("[SIGNUP] Invalid email format:", normalizedEmail);
      return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
    }

    try {
      // Check if user already exists
      const existingUser = await prisma.userProfile.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        console.warn("[SIGNUP] Email already exists:", normalizedEmail);
        return NextResponse.json({ ok: false, error: "email_already_exists" }, { status: 409 });
      }

      // Hash password and create user
      const hash = await hashPassword(password);

      console.log("[SIGNUP] Attempting to create user profile in database...");
      const user = await prisma.userProfile.create({
        data: {
          email: normalizedEmail,
          displayName: name,
          passwordHash: hash,
          authProvider: "email",
        },
      });
      console.log("[SIGNUP] User profile created successfully:", user.id);

      // Create session
      try {
        await createSession(user.id);
        console.log("[SIGNUP] Session created for user:", user.id);
      } catch (sessionError) {
        console.error("[SIGNUP] Session creation failed:", sessionError);
        return NextResponse.json({ ok: false, error: "auth_session_error" }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          display_name: user.displayName,
        },
      });
    } catch (dbError: any) {
      console.error("[SIGNUP] Prisma database error:", {
        code: dbError.code,
        message: dbError.message,
        clientVersion: dbError.clientVersion,
        meta: dbError.meta
      });
      
      // Prisma P2002 is Unique constraint violation
      if (dbError.code === 'P2002') {
         return NextResponse.json({ ok: false, error: "email_already_exists", code: dbError.code }, { status: 409 });
      }
      
      return NextResponse.json({ 
        ok: false, 
        error: "auth_database_error", 
        code: dbError.code || "UNKNOWN_PRISMA_ERROR"
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error("[SIGNUP] Global signup exception:", error?.message || error);
    return NextResponse.json({ 
      ok: false, 
      error: "auth_database_error",
      message: "Internal server error during signup"
    }, { status: 500 });
  }
}
