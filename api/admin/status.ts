import { prisma } from '../../src/lib/prisma'

export default async function handler(req: any, res: any) {
  try {
    // 1. Check database connection & schema
    const requiredTables = [
      'users_profile', 'clients', 'videos', 'jobs', 'tribe_runs', 
      'agent_runs', 'video_analyses', 'scripts', 'edit_plans', 
      'publishing_plans', 'analytics_snapshots', 'platform_learnings', 'cost_events'
    ]

    let dbReady = false
    let missingTables: string[] = []
    
    try {
      const tablesResult: any[] = await prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `
      const existingTables = tablesResult.map(t => t.table_name)
      missingTables = requiredTables.filter(t => !existingTables.includes(t))
      dbReady = missingTables.length === 0
    } catch (e) {
      console.error('Database check failed:', e)
    }

    // 2. Build configuration booleans safely
    return res.status(200).json({
      ok: true,
      app: "reelassati",
      env: process.env.REELASSATI_APP_ENV || process.env.NODE_ENV || "production",
      database: {
        configured: Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL),
        ready: dbReady,
        requiredTables: [], // As requested in the return shape
        missingTables: missingTables
      },
      blob: {
        configured: Boolean(process.env.BLOB_READ_WRITE_TOKEN)
      },
      aiGateway: {
        configured: Boolean(process.env.AI_GATEWAY_API_KEY || process.env.LOVABLE_API_KEY)
      },
      tribe: {
        configured: Boolean(process.env.TRIBE_API_URL && process.env.TRIBE_API_KEY),
        status: (process.env.TRIBE_API_URL && process.env.TRIBE_API_KEY) ? "configured" : "pending_if_missing"
      },
      internal: {
        agentSecretConfigured: Boolean(process.env.INTERNAL_AGENT_SECRET)
      }
    })
  } catch (error: any) {
    console.error('Admin status error:', error)
    return res.status(200).json({ // Never allow the function to crash, return 200 with ok: false if needed, but user wants ok: true if possible with status info
      ok: true, 
      app: "reelassati",
      error: "internal_server_error_status_check"
    })
  }
}
