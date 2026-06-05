import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSession } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
    }

    const { name, email, password } = body;

    if (!name || !email || !password || password.length < 8) {
      return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
    }

    const normalizedEmail = (email as string).toLowerCase().trim();
    const passwordHash = await hashPassword(password);

    try {
      // 1. Check for existing user (using explicit columns and lower email)
      const existing: any[] = await prisma.$queryRaw`
        SELECT id::text, email, display_name, password_hash
        FROM users_profile
        WHERE lower(email) = lower(${normalizedEmail})
        LIMIT 1;
      `;
      
      if (existing.length > 0) {
        return NextResponse.json({ ok: false, error: "email_already_exists" }, { status: 409 });
      }

      // 2. Perform explicit column insert matching real schema
      const result: any[] = await prisma.$queryRaw`
        INSERT INTO users_profile (
          email,
          display_name,
          password_hash,
          auth_provider,
          created_at,
          updated_at
        )
        VALUES (
          ${normalizedEmail},
          ${name},
          ${passwordHash},
          'email',
          now(),
          now()
        )
        RETURNING id::text, email, display_name;
      `;

      const newUser = result[0];
      if (!newUser || !newUser.id) {
        throw new Error("Failed to retrieve new user ID after insert");
      }

      await createSession(newUser.id);

      return NextResponse.json({
        ok: true,
        user: { id: newUser.id, email: newUser.email, display_name: newUser.display_name }
      });
    } catch (dbError: any) {
      console.error("[SIGNUP] Database error:", dbError.message, dbError.code);
      return NextResponse.json({ 
        ok: false, 
        error: "auth_database_error",
        code: dbError.code,
        message: dbError.message || "Authentication is temporarily unavailable."
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error("[SIGNUP] Exception:", error);
    return NextResponse.json({ 
      ok: false, 
      error: "auth_database_error",
      message: "Authentication is temporarily unavailable."
    }, { status: 500 });
  }
}
  } catch (error: any) {
    return NextResponse.json({ 
      ok: false, 
      error: "auth_database_error",
      message: "Authentication is temporarily unavailable."
    }, { status: 500 });
  }
}
