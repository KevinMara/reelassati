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

    // 1. Fetch real schema at runtime
    const columns: any[] = await prisma.$queryRaw`
      SELECT column_name, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'users_profile' AND table_schema = 'public'
    `;
    
    const colMap = new Set(columns.map(c => c.column_name.toLowerCase()));
    const notNullNoDefault = columns
      .filter(c => c.is_nullable === 'NO' && c.column_default === null)
      .map(c => c.column_name.toLowerCase());

    // 2. Build the data object based on existing columns
    const userId = uuidv4();
    const data: any = {};
    const timestamp = new Date();

    if (colMap.has("id")) data.id = userId;
    if (colMap.has("email")) data.email = normalizedEmail;
    if (colMap.has("display_name")) data.display_name = name;
    else if (colMap.has("name")) data.name = name;

    const hash = await hashPassword(password);
    if (colMap.has("password_hash")) data.password_hash = hash;
    if (colMap.has("auth_provider")) data.auth_provider = "email";
    if (colMap.has("user_id")) data.user_id = userId;
    if (colMap.has("created_at")) data.created_at = timestamp;
    if (colMap.has("updated_at")) data.updated_at = timestamp;

    // Check for missing NOT NULL columns
    const missing = notNullNoDefault.filter(col => data[col] === undefined);
    if (missing.length > 0) {
      return NextResponse.json({
        ok: false,
        error: "auth_schema_error",
        message: "unsupported_not_null_columns",
        columns: missing
      }, { status: 500 });
    }

    // 3. Perform explicit column insert using raw SQL to be safe from Prisma model drift
    const colNames = Object.keys(data);
    const colValues = Object.values(data);
    const valuePlaceholders = colNames.map((_, i) => `$${i + 1}`).join(", ");
    const columnList = colNames.join(", ");

    try {
      // Check for existing user first (using explicit column)
      const existing: any[] = await prisma.$queryRawUnsafe(
        `SELECT id FROM users_profile WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        normalizedEmail
      );
      
      if (existing.length > 0) {
        return NextResponse.json({ ok: false, error: "email_already_exists" }, { status: 409 });
      }

      await prisma.$executeRawUnsafe(
        `INSERT INTO users_profile (${columnList}) VALUES (${valuePlaceholders})`,
        ...colValues
      );

      await createSession(userId);

      return NextResponse.json({
        ok: true,
        user: { id: userId, email: normalizedEmail, display_name: name }
      });
    } catch (dbError: any) {
      console.error("[SIGNUP] Database error:", dbError.message);
      return NextResponse.json({ 
        ok: false, 
        error: "auth_database_error",
        message: "Authentication is temporarily unavailable."
      }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({ 
      ok: false, 
      error: "auth_database_error",
      message: "Authentication is temporarily unavailable."
    }, { status: 500 });
  }
}
