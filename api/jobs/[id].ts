import { prisma } from '@/lib/prisma'

export default async function handler(req: any, res: any) {
  const { id } = req.query

  if (!id) {
    return res.status(400).json({
      ok: false,
      error: "missing_job_id"
    })
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  // Standard UUID check (some versions might differ, but jobs usually use v4)
  // Let's use a more permissive one just in case
  const simpleUuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  if (!simpleUuidRegex.test(String(id))) {
    return res.status(400).json({
      ok: false,
      error: "invalid_job_id"
    })
  }

  try {
    const job = await prisma.job.findUnique({
      where: { id: String(id) },
      include: {
        video: true
      }
    })

    if (!job) {
      return res.status(404).json({
        ok: false,
        error: "job_not_found"
      })
    }

    return res.status(200).json({
      ok: true,
      job: {
        id: job.id,
        job_type: job.jobType,
        status: job.status,
        error_message: job.errorMessage,
        video_id: job.videoId,
        created_at: job.createdAt,
        started_at: job.startedAt,
        completed_at: job.completedAt,
        output: job.output
      }
    })
  } catch (error: any) {
    console.error(`Database error fetching job ${id}:`, error)
    return res.status(500).json({
      ok: false,
      error: "database_error"
    })
  }
}
