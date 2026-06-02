import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, name } = body;

    const columns: any[] = await prisma.$queryRaw`
      SELECT 
        column_name, 
        is_nullable, 
        column_default, 
        data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users_profile'
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `;

    const columnNames = columns.map(c => c.column_name);
    const notNullColumns = columns.filter(c => c.is_nullable === 'NO' && c.column_default === null).map(c => c.column_name);

    const insertPlan: any = {
      id: "generated-uuid",
      email: email?.toLowerCase(),
      display_name: name || null,
      password_hash: "[redacted]",
      auth_provider: "email",
      created_at: "now()",
      updated_at: "now()"
    };

    // If user_id exists, we'd map it to the same id
    if (columnNames.includes("user_id")) {
      insertPlan.user_id = "generated-uuid";
    }

    const missingRequired = notNullColumns.filter(col => !Object.keys(insertPlan).includes(col) && !["id", "email"].includes(col));

    return NextResponse.json({
      ok: true,
      targetTable: "public.users_profile",
      columnsFromInformationSchema: columnNames,
      notNullColumns: notNullColumns,
      insertColumnsPlanned: Object.keys(insertPlan),
      insertValuesPreview: insertPlan,
      missingRequiredColumns: missingRequired,
      wouldFail: missingRequired.length > 0
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
