import { prisma } from '@/lib/prisma'
import { verifyTribeAuth } from '@/src/lib/reelassati/security'
import { runVideoAnalyzer } from '@/src/lib/reelassati/agents/videoAnalyzer'

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!verifyTribeAuth(req)) return res.status(401).json({ error: 'Unauthorized' })

  const { job_id, video_id, status, tribe_data, error_code, error_message } = req.body

  try {
    // 1. Record the TRIBE run
    await prisma.tribeRun.create({
      data: {
        jobId: job_id,
        videoId: video_id,
        name: 'tribe_v1',
        output: tribe_data || { error_code, error_message }
      }
    })

    // 2. Handle failure
    if (status === 'failed' || error_code === 'TRIBE_GPU_REQUIRED') {
      await prisma.job.update({
        where: { id: job_id },
        data: {
          status: 'tribe_unavailable',
          error_message: error_message || 'TRIBE GPU Required'
        }
      })
      return res.status(200).json({ ok: true })
    }

    // 3. Process success
    if (status === 'completed' && tribe_data?.normalized_scores) {
      // Run video analyzer
      const analysisOutput = await runVideoAnalyzer(job_id, tribe_data)

      // Save analysis
      await prisma.videoAnalysis.create({
        data: {
          videoId: video_id,
          data: analysisOutput as any
        }
      })

      // Update job
      await prisma.job.update({
        where: { id: job_id },
        data: {
          status: 'completed',
          completedAt: new Date()
        }
      })

      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: 'Unexpected tribe status' })
  } catch (error: any) {
    console.error('Webhook error:', error)
    return res.status(500).json({ error: error.message })
  }
}
