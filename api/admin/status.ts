import { prisma } from '../../src/lib/prisma'

export default async function handler(req: any, res: any) {
  try {
    // 1. Check database connection & schema (Reuse working db-check logic)
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
      console.error('Database check failed in status:', e)
      dbReady = false
    }

    // 2. Build configuration booleans safely
    // Use the exact return shape requested
    return res.status(200).json({
      ok: true,
      app: "reelassati",
      env: "production",
      database: {
        configured: Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL),
        ready: dbReady,
        requiredTables: [],
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
    console.error('Admin status critical error:', error)
    // Never allow the function to crash
    return res.status(200).json({
      ok: true,
      app: "reelassati",
      env: "production",
      error: "unexpected_status_error",
      database: { configured: false, ready: false, requiredTables: [], missingTables: [] },
      blob: { configured: false },
      aiGateway: { configured: false },
      tribe: { configured: false, status: "error" },
      internal: { agentSecretConfigured: false }
    })
  }
}
