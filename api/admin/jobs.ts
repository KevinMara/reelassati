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

    return res.status(200).json({
      recentJobs,
      unavailableJobs
    })
  } catch (error: any) {
    return res.status(500).json({ error: error.message })
  }
}
