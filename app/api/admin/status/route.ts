import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const requiredTables = [
      'users_profile', 'clients', 'videos', 'jobs', 'tribe_runs', 
      'agent_runs', 'video_analyses', 'scripts', 'edit_plans', 
      'publishing_plans', 'analytics_snapshots', 'platform_learnings', 'cost_events'
    ];

    let ready = false;
    let missingTables: string[] = [];

    try {
      const tablesResult: any[] = await prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `;
      const existingTables = tablesResult.map(t => t.table_name);
      missingTables = requiredTables.filter(t => !existingTables.includes(t));
      ready = missingTables.length === 0;
    } catch (e) {
      ready = false;
      missingTables = requiredTables;
    }

    return NextResponse.json({
      ok: true,
      app: "reelassati",
      env: process.env.REELASSATI_APP_ENV || "unknown",
      database: {
        configured: Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL),
        ready: ready,
        missingTables: missingTables
      },
      blob: {
        configured: Boolean(process.env.BLOB_READ_WRITE_TOKEN)
      },
      aiGateway: {
        configured: Boolean(process.env.AI_GATEWAY_API_KEY)
      },
      tribe: {
        configured: Boolean(process.env.TRIBE_API_URL && process.env.TRIBE_API_KEY),
        status: (process.env.TRIBE_API_URL && process.env.TRIBE_API_KEY) ? "configured" : "pending"
      },
      internal: {
        agentSecretConfigured: Boolean(process.env.INTERNAL_AGENT_SECRET)
      }
    });
  } catch (error: any) {
    console.error('Status route error:', error);
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
}
