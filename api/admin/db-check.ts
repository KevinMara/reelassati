import { prisma } from '@/lib/prisma'

export default async function handler(req: any, res: any) {
  try {
    const requiredTables = [
      'users_profile', 'clients', 'videos', 'jobs', 'tribe_runs', 
      'agent_runs', 'video_analyses', 'scripts', 'edit_plans', 
      'publishing_plans', 'analytics_snapshots', 'platform_learnings', 'cost_events'
    ]

    const tablesResult: any[] = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `
    const existingTables = tablesResult.map(t => t.table_name)
    const missingTables = requiredTables.filter(t => !existingTables.includes(t))
    const ready = missingTables.length === 0

    return res.status(200).json({
      ok: true,
      tables: existingTables,
      requiredTables,
      missingTables,
      ready
    })
  } catch (error: any) {
    console.error('Database check error:', error)
    return res.status(500).json({ 
      ok: false, 
      error: "database_error" 
    })
  }
}
