import { prisma } from '../../../src/lib/prisma'

export default async function handler(req: any, res: any) {
  const { id } = req.query

  if (!id) {
    return res.status(400).json({ ok: false, error: 'missing_video_id' })
  }

  try {
    const analysis = await prisma.videoAnalysis.findFirst({
      where: { videoId: String(id) },
      orderBy: { createdAt: 'desc' }
    })

    if (!analysis) {
      return res.status(404).json({ ok: false, error: 'analysis_not_found' })
    }

    return res.status(200).json({
      ok: true,
      analysis
    })
  } catch (error: any) {
    console.error('Error fetching analysis:', error)
    return res.status(500).json({ 
      ok: false, 
      error: 'database_error' 
    })
  }
}
