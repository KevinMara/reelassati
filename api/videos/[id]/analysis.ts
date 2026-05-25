import { prisma } from '@/lib/prisma'

export default async function handler(req: any, res: any) {
  const { id } = req.query

  try {
    const analysis = await prisma.videoAnalysis.findFirst({
      where: { video_id: String(id) },
      orderBy: { created_at: 'desc' }
    })

    if (!analysis) return res.status(200).json({ status: 'not_ready' })

    return res.status(200).json(analysis)
  } catch (error: any) {
    return res.status(500).json({ error: error.message })
  }
}
