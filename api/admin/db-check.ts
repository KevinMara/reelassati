import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Query information_schema.tables to check for existence
    const tables: any[] = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `

    return res.status(200).json({
      ok: true,
      tables: tables.map(t => t.table_name)
    })
  } catch (error: any) {
    console.error('Database check error:', error)
    return res.status(500).json({
      ok: false,
      error: error.message
    })
  } finally {
    await prisma.$disconnect()
  }
}
