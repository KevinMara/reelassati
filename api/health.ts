import { prisma } from '@/lib/prisma'

export default async function handler(req: any, res: any) {
  try {
    let database_ready = false
    try {
      await prisma.$queryRaw`SELECT 1`
      database_ready = true
    } catch (e) {
      console.error('Health check database error:', e)
    }

    res.status(200).json({
      ok: true,
      app: "reelassati",
      env: process.env.NODE_ENV || "production",
      database_ready
    })
  } catch (error: any) {
    res.status(500).json({
      ok: false,
      error: "health_check_failed"
    })
  }
}
