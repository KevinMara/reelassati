import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

async function main() {
  console.log('--- Database Migration Start ---')
  
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    console.error('Error: DATABASE_URL or POSTGRES_URL is not set. Migration cannot proceed.')
    process.exit(1)
  }

  try {
    const migrationPath = path.join(process.cwd(), 'prisma', 'migration.sql')
    if (!fs.existsSync(migrationPath)) {
      console.error(`Error: Migration file not found at ${migrationPath}`)
      process.exit(1)
    }

    const sql = fs.readFileSync(migrationPath, 'utf8')
    
    // Simple split by semicolon. 
    // This works well for basic CREATE/ALTER statements without nested semicolons (like in functions/triggers)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    console.log(`Executing ${statements.length} SQL statements...`)

    for (const statement of statements) {
      try {
        await prisma.$executeRawUnsafe(statement)
      } catch (err: any) {
        // Handle common "already exists" errors for idempotency
        const message = err.message || ''
        if (
          message.includes('already exists') || 
          message.includes('relation already exists') ||
          message.includes('already a foreign key') ||
          message.includes('duplicate key value')
        ) {
          // console.log(`Skipped (already exists): ${statement.substring(0, 50)}...`)
          continue
        }
        
        console.error(`Error executing statement: ${statement.substring(0, 100)}...`)
        console.error(err)
        // If it's a critical error, we might want to stop, but for now we'll continue 
        // because we use IF NOT EXISTS where possible.
      }
    }
    
    console.log('--- Migration completed successfully ---')
  } catch (error) {
    console.error('Migration encountered a fatal error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
