import { prisma } from '@/lib/prisma'

export default async function handler(req: any, res: any) {
  try {
    const recentJobs = await prisma.job.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { video: true }
    })

    const unavailableJobs = await prisma.job.findMany({
      where: { status: 'tribe_unavailable' },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { video: true }
    })

    const failedJobs = await prisma.job.findMany({
      where: { status: 'failed' },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { video: true }
    })

    return res.status(200).json({
      ok: true,
      recentJobs,
      unavailableJobs,
      failedJobs
    })
  } catch (error: any) {
    console.error('Fetch admin jobs error:', error)
    return res.status(500).json({ 
      ok: false, 
      error: "database_error" 
    })
  }
}
