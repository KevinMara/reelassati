import { PrismaClient } from '@prisma/client'

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl
    }
  }
})

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
  if (!dbUrl) {
    return res.status(500).json({
      ok: false,
      error: 'Neither DATABASE_URL nor POSTGRES_URL environment variable is set.'
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
    const ready = REQUIRED_TABLES.every(t => existingTables.includes(t))

    return res.status(200).json({
      ok: true,
      ready,
      tables: existingTables,
      requiredTables: REQUIRED_TABLES,
      missingTables: missingTables,
      env: {
        has_database_url: !!process.env.DATABASE_URL,
        has_postgres_url: !!process.env.POSTGRES_URL
      }
    })
  } catch (error: any) {
    console.error('Database check error:', error)
    return res.status(500).json({
      ok: false,
      ready: false,
      error: error.message || 'Unknown database error',
      details: error.toString()
    })
  } finally {
    await prisma.$disconnect()
  }
}
