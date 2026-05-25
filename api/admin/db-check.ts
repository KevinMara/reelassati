import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const REQUIRED_TABLES = [
  'users_profile',
  'clients',
  'videos',
  'jobs',
  'tribe_runs',
  'agent_runs',
  'video_analyses',
  'scripts',
  'edit_plans',
  'publishing_plans',
  'analytics_snapshots',
  'platform_learnings',
  'cost_events'
]

export default async function handler(req: any, res: any) {
  // Simple check if database env vars are set
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL
  if (!dbUrl) {
    return res.status(500).json({
      ok: false,
      error: 'DATABASE_URL or POSTGRES_URL environment variable is not set.'
    })
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Query information_schema.tables to check for existence
    const tables: any[] = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name ASC
    `

    const existingTables = tables.map(t => t.table_name)
    const missingTables = REQUIRED_TABLES.filter(t => !existingTables.includes(t))
    const ready = missingTables.length === 0

    return res.status(200).json({
      ok: true,
      ready,
      tables: existingTables,
      requiredTables: REQUIRED_TABLES,
      missingTables: missingTables
    })
  } catch (error: any) {
    console.error('Database check error:', error)
    return res.status(500).json({
      ok: false,
      ready: false,
      error: error.message || 'Unknown database error'
    })
  } finally {
    await prisma.$disconnect()
  }
}
