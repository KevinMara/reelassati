import { prisma } from '@/lib/prisma'

export default async function handler(req: any, res: any) {
  const { id } = req.query

  if (!id) {
    return res.status(400).json({ ok: false, error: 'missing_video_id' })
  }

  const simpleUuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!simpleUuidRegex.test(String(id))) {
    return res.status(400).json({ ok: false, error: 'invalid_video_id' })
  }

  try {
    const analysis = await prisma.videoAnalysis.findFirst({
      where: { videoId: String(id) },
      orderBy: { createdAt: 'desc' }
    })

    if (!analysis) {
      return res.status(200).json({ 
        ok: true, 
        status: 'not_ready' 
      })
    }

    return res.status(200).json({
      ok: true,
      analysis
    })
  } catch (error: any) {
    console.error(`Database error fetching analysis for video ${id}:`, error)
    return res.status(500).json({ 
      ok: false, 
      error: 'database_error' 
    })
  }
}
