import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting migration...')
  
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Skipping migration.')
    process.exit(1)
  }

  try {
    const migrationPath = path.join(process.cwd(), 'prisma', 'migration.sql')
    const sql = fs.readFileSync(migrationPath, 'utf8')
    
    // Split by semicolon and filter out empty lines to run statements one by one
    // Note: This is a simple split and might not handle complex SQL (like functions) well, 
    // but for CREATE TABLE/INDEX it's usually fine.
    // Alternatively, run the whole block if the driver supports it.
    
    console.log('Applying migration SQL...')
    await prisma.$executeRawUnsafe(sql)
    
    console.log('Migration completed successfully.')
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
