import { NextResponse } from 'next/server';

export async function GET() {
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
