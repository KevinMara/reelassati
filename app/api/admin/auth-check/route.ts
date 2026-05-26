import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    auth: {
      configured: true,
      passwordAuth: true,
      googleAuth: false, // Default to false as requested unless OAuth is configured
    },
  });
}
