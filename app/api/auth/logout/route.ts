import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export async function POST() {
  deleteSession();
  return NextResponse.json({ ok: true });
}
