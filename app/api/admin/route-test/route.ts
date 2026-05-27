import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export async function GET() {
  const guard = await requireAdmin();
  if (guard) return guard;
  return NextResponse.json({
    ok: true,
    framework: "nextjs-app-router",
    runtime: "vercel",
    routes: {
      health: "/api/health",
      dbCheck: "/api/admin/db-check",
      adminStatus: "/api/admin/status",
      jobs: "/api/jobs/[id]"
    }
  });
}
