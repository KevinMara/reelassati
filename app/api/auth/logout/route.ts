import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/auth";
import { ensureAuthSchema } from "@/lib/ensure-auth-schema";

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    // Ensure schema is up to date
    await ensureAuthSchema();

    deleteSession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json({ ok: true }); // Still return ok:true as we want the user to be logged out anyway
  }
}
