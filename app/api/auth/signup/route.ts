import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSession } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ ok: false, error: "password_too_short" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await prisma.userProfile.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json({ ok: false, error: "email_already_exists" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const userId = uuidv4();

    const user = await prisma.userProfile.create({
      data: {
        userId,
        email: normalizedEmail,
        displayName: name,
        passwordHash,
        authProvider: "email",
      },
    });

    await createSession(user.userId);

    return NextResponse.json({
      ok: true,
      user: {
        id: user.userId,
        email: user.email,
        display_name: user.displayName,
      },
    });
  } catch (error: any) {
    console.error("Signup error:", error);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
