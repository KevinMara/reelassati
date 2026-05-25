import { prisma } from '../../src/lib/prisma'

export default async function handler(req: any, res: any) {
  try {
    const jobs = await prisma.job.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        video: true
      }
    })

    const unavailableJobs = await prisma.job.findMany({
      where: {
        status: 'tribe_unavailable'
      },
      take: 20,
      orderBy: { createdAt: 'desc' }
    })

    return res.status(200).json({
      ok: true,
      recentJobs: jobs,
      unavailableJobs: unavailableJobs
    })
  } catch (error: any) {
    console.error('Error fetching jobs:', error)
    return res.status(500).json({ 
      ok: false, 
      error: 'database_error' 
    })
  }
}
