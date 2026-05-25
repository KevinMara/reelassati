import { prisma } from '@/lib/prisma'

export default async function handler(req: any, res: any) {
  try {
    // Check database connection
    let dbConnected = false
    try {
      await prisma.$queryRaw`SELECT 1`
      dbConnected = true
    } catch (e) {
      console.error('Database connection check failed:', e)
    }

    // Check configuration
    const config = {
      DATABASE_URL: !!process.env.DATABASE_URL,
      POSTGRES_URL: !!process.env.POSTGRES_URL,
      BLOB_READ_WRITE_TOKEN: !!process.env.BLOB_READ_WRITE_TOKEN,
      AI_GATEWAY_API_KEY: !!(process.env.AI_GATEWAY_API_KEY || process.env.LOVABLE_API_KEY),
      TRIBE_API_URL: !!process.env.TRIBE_API_URL,
      TRIBE_API_KEY: !!process.env.TRIBE_API_KEY,
      INTERNAL_AGENT_SECRET: !!process.env.INTERNAL_AGENT_SECRET,
    }

    // Determine TRIBE status
    let tribeStatus = 'unavailable'
    if (config.TRIBE_API_URL && config.TRIBE_API_KEY) {
      tribeStatus = 'configured'
    }

    return res.status(200).json({
      ok: true,
      app: "reelassati",
      env: process.env.NODE_ENV || "production",
      database_ready: dbConnected,
      config,
      tribeStatus,
      aiGatewayConfigured: config.AI_GATEWAY_API_KEY,
      blobConfigured: config.BLOB_READ_WRITE_TOKEN
    })
  } catch (error: any) {
    console.error('Admin status error:', error)
    return res.status(500).json({ 
      ok: false, 
      error: 'internal_server_error' 
    })
  }
}
