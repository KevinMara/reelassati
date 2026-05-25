import { prisma } from '@/lib/prisma'
import { verifyInternalAuth } from '@/lib/reelassati/security'
import { runVideoAnalyzer } from '@/lib/reelassati/agents/videoAnalyzer'

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' })
  }
  
  if (!verifyInternalAuth(req)) {
    return res.status(401).json({ ok: false, error: 'unauthorized' })
  }

  const { job_id, video_id, tribe_data } = req.body

  if (!tribe_data?.normalized_scores) {
    return res.status(400).json({ ok: false, error: 'missing_tribe_data' })
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

    return res.status(200).json({
      ok: true,
      analysis: analysisOutput
    })
  } catch (error: any) {
    console.error('Video analyzer agent error:', error)
    return res.status(500).json({ 
      ok: false, 
      error: 'database_error' 
    })
  }
}
