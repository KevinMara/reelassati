import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

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

async function main() {
  console.log('--- Database Migration Start ---')
  
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL
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

    const sql = fs.readFileSync(migrationPath, 'utf8')
    
    // Split by semicolon, but handle potential issues with simple splitting
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    console.log(`Executing ${statements.length} SQL statements...`)

    let executedCount = 0
    let skippedCount = 0

    for (const statement of statements) {
      try {
        await prisma.$executeRawUnsafe(statement)
        executedCount++
      } catch (err: any) {
        const message = err.message || ''
        if (
          message.includes('already exists') || 
          message.includes('relation already exists') ||
          message.includes('already a foreign key') ||
          message.includes('duplicate key value')
        ) {
          skippedCount++
          continue
        }
        
        console.error(`Error executing statement: ${statement.substring(0, 100)}...`)
        console.error(err)
        // For CREATE TABLE statements, we really want them to succeed or be skipped if they exist
        if (statement.toUpperCase().includes('CREATE TABLE')) {
           console.error('Critical failure during table creation.')
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

    console.log('--- Migration completed successfully. All required tables are present. ---')
  } catch (error) {
    console.error('Migration encountered a fatal error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
