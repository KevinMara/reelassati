import { prisma } from '../../src/lib/prisma'

export default async function handler(req: any, res: any) {
  try {
    let jobs: any[] = []
    let unavailableJobs: any[] = []

    try {
      jobs = await prisma.job.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: {
          video: true
        }
      })

      unavailableJobs = await prisma.job.findMany({
        where: {
          status: 'tribe_unavailable'
        },
        take: 20,
        orderBy: { createdAt: 'desc' }
      })
    } catch (dbErr) {
      console.error('Admin jobs database error:', dbErr)
      // Return empty lists rather than 500
    }

    return res.status(200).json({
      ok: true,
      recentJobs: jobs,
      unavailableJobs: unavailableJobs
    })
  } catch (error: any) {
    console.error('Error in admin jobs handler:', error)
    return res.status(200).json({ 
      ok: false, 
      error: 'internal_server_error',
      recentJobs: [],
      unavailableJobs: []
    })
  }
}
