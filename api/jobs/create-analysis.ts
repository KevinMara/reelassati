import { prisma } from '../../src/lib/prisma'

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' })
  }

  try {
    const { videoId, clientId } = req.body

    if (!videoId) {
      return res.status(400).json({ ok: false, error: 'missing_video_id' })
    }

    const job = await prisma.job.create({
      data: {
        jobType: 'video_analysis',
        status: 'pending',
        videoId,
        clientId: clientId || null
      }
    })

    return res.status(200).json({
      ok: true,
      jobId: job.id
    })
  } catch (error: any) {
    console.error('Error creating analysis job:', error)
    return res.status(500).json({ 
      ok: false, 
      error: 'database_error' 
    })
  }
}
