import { prisma } from '@/lib/prisma'
import { callTribe } from '@/src/lib/reelassati/tribeClient'

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end()

  const { blob_url, blob_key, title, goal, platform_targets, language, client_id, user_notes } = req.body

  try {
    const video = await prisma.video.create({
      data: {
        title,
        url: blob_url,
        storage_key: blob_key,
        client_id,
        metadata: { goal, platform_targets, language, user_notes }
      }
    })

    const job = await prisma.job.create({
      data: {
        video_id: video.id,
        job_type: 'analyze_video',
        status: 'queued'
      }
    })

    const tribeResult = await callTribe(blob_url, { job_id: job.id, goal })

    let finalStatus = 'waiting_for_tribe'
    let errorMessage = null

    if (tribeResult.status === 'failed' || tribeResult.status === 'tribe_gpu_required') {
      finalStatus = 'tribe_unavailable'
      errorMessage = tribeResult.error_message || 'TRIBE server error'
    }

    await prisma.job.update({
      where: { id: job.id },
      data: { 
        status: finalStatus,
        error_message: errorMessage
      }
    })

    return res.status(200).json({
      job_id: job.id,
      video_id: video.id,
      status: finalStatus
    })
  } catch (error: any) {
    return res.status(500).json({ error: error.message })
  }
}
