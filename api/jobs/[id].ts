import { prisma } from '@/lib/prisma'

export default async function handler(req: any, res: any) {
  const { id } = req.query

  try {
    const job = await prisma.job.findUnique({
      where: { id: String(id) },
      include: {
        video: true
      }
    })

    if (!job) return res.status(404).json({ error: 'Job not found' })

    return res.status(200).json(job)
  } catch (error: any) {
    return res.status(500).json({ error: error.message })
  }
}
