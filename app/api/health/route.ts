import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ok: true,
    app: "reelassati",
    env: process.env.REELASSATI_APP_ENV || "unknown",
    database_ready: true
  });
}
