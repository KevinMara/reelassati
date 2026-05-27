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
      return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    const { name, email, password } = body;

    if (!name || !email || !password) {
      return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
    }

    const normalizedEmail = (email as string).toLowerCase().trim();
    
    if (!normalizedEmail.includes("@") || !normalizedEmail.includes(".")) {
      return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
    }

    try {
      const existingUser = await prisma.userProfile.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        return NextResponse.json({ ok: false, error: "email_already_exists" }, { status: 409 });
      }

      const hash = await hashPassword(password);

      const user = await prisma.userProfile.create({
        data: {
          email: normalizedEmail,
          displayName: name,
          passwordHash: hash,
          authProvider: "email",
        },
      });

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
      console.error("Database error during signup:", dbError);
      if (dbError.code === 'P2002') {
         return NextResponse.json({ ok: false, error: "email_already_exists" }, { status: 409 });
      }
      return NextResponse.json({ ok: false, error: "auth_database_error", details: dbError.message }, { status: 500 });
    }
  } catch (error: any) {
    console.error("Signup exception:", error);
    return NextResponse.json({ 
      ok: false, 
      error: "internal_error", 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

