import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

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

async function main() {
  console.log('--- Database Migration Start ---')
  
  if (!dbUrl) {
    console.error('Error: DATABASE_URL or POSTGRES_URL is not set. Migration cannot proceed.')
    process.exit(1)
  }

  console.log(`Using database connection: ${dbUrl.split('@')[1] || 'URL hidden'}`)

  try {
    const migrationPath = path.join(process.cwd(), 'prisma', 'migration.sql')
    if (!fs.existsSync(migrationPath)) {
      console.error(`Error: Migration file not found at ${migrationPath}`)
      process.exit(1)
    }

    const rawSql = fs.readFileSync(migrationPath, 'utf8')
    
    // Remove comments and split by semicolon correctly
    const cleanSql = rawSql
      .replace(/--.*$/gm, '') // Remove single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
    
    const statements = cleanSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0)
    
    // Prepend extension check
    statements.unshift('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')

    console.log(`Executing ${statements.length} SQL statements...`)

    let executedCount = 0
    let skippedCount = 0

    for (const statement of statements) {
      try {
        await prisma.$executeRawUnsafe(statement)
        executedCount++
      } catch (err: any) {
        const message = err.message || ''
        const isIgnorable = 
          message.includes('already exists') || 
          message.includes('relation already exists') ||
          message.includes('already a foreign key') ||
          message.includes('duplicate key value') ||
          message.includes('permission denied to create extension') ||
          message.includes('already enabled')
        
        if (isIgnorable) {
          skippedCount++
          continue
        }
        
        console.error(`Error executing statement: ${statement.substring(0, 100)}...`)
        console.error(err)
        
        const upper = statement.toUpperCase()
        if (upper.includes('CREATE TABLE') || upper.includes('ALTER TABLE')) {
           console.error('Critical failure during schema modification.')
           process.exit(1)
        }
      }
    }
    
    console.log(`Migration execution finished. Executed: ${executedCount}, Skipped: ${skippedCount}`)

    // Verification step
    console.log('Verifying required tables...')
    const tables: any[] = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `
    const existingTables = tables.map(t => t.table_name)
    console.log('Found tables:', existingTables.join(', '))

    const missingTables = REQUIRED_TABLES.filter(t => !existingTables.includes(t))

    if (missingTables.length > 0) {
      console.error('ERROR: The following required tables are missing after migration:')
      console.error(missingTables.join(', '))
      process.exit(1)
    }

    console.log('--- Migration completed successfully. All 13 required tables are present. ---')
  } catch (error) {
    console.error('Migration encountered a fatal error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
