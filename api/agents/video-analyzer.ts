import { prisma } from '@/lib/prisma'
import { verifyInternalAuth } from '@/src/lib/reelassati/security'
import { runVideoAnalyzer } from '@/src/lib/reelassati/agents/videoAnalyzer'

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!verifyInternalAuth(req)) return res.status(401).json({ error: 'Unauthorized' })

  const { job_id, video_id, tribe_data } = req.body

  if (!tribe_data?.normalized_scores) {
    return res.status(400).json({ error: 'Missing real TRIBE normalized scores' })
  }

  try {
    const analysisOutput = await runVideoAnalyzer(job_id, tribe_data)

    // Save agent run
    await prisma.agentRun.create({
      data: {
        jobId: job_id,
        videoId: video_id,
        agentName: 'video-analyzer',
        input: tribe_data,
        output: analysisOutput as any
      }
    })

    // Update analysis record if needed or return
    return res.status(200).json(analysisOutput)
  } catch (error: any) {
    return res.status(500).json({ error: error.message })
  }
}
