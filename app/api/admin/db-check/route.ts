import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export async function GET() {
  const guard = await requireAdmin();
  if (guard) return guard;
  try {
    const requiredTables = [
      'users_profile', 'clients', 'videos', 'jobs', 'tribe_runs', 
      'agent_runs', 'video_analyses', 'scripts', 'edit_plans', 
      'publishing_plans', 'analytics_snapshots', 'platform_learnings', 'cost_events'
    ];

    let existingTables: string[] = [];
    let missingTables: string[] = [];
    let ready = false;

    try {
      const tablesResult: any[] = await prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `;
      existingTables = tablesResult.map(t => t.table_name);
      missingTables = requiredTables.filter(t => !existingTables.includes(t));
      ready = missingTables.length === 0;
    } catch (dbErr) {
      console.error('DB Check Query Error:', dbErr);
      return NextResponse.json({
        ok: true,
        ready: false,
        error: "database_query_failed",
        missingTables: requiredTables
      });
    }

    return NextResponse.json({
      ok: true,
      ready,
      missingTables,
      allRequiredTablesExist: ready
    });
  } catch (error: any) {
    console.error('Database check handler error:', error);
    return NextResponse.json({ 
      ok: true, 
      ready: false,
      error: "unexpected_db_check_error" 
    });
  }
}
