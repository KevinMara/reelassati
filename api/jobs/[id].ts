import { prisma } from '../../src/lib/prisma'

export default async function handler(req: any, res: any) {
  try {
    const { id } = req.query
    const idStr = String(id || '')

    if (!idStr) {
      return res.status(400).json({
        ok: false,
        error: "missing_job_id"
      })
    }

    // Handle special case "test"
    if (idStr === 'test') {
      return res.status(400).json({
        ok: false,
        error: "invalid_job_id"
      })
    }

    // UUID Regex: 8-4-4-4-12 hex chars
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const zeroUuid = "00000000-0000-0000-0000-000000000000"

    const isValidUuid = uuidRegex.test(idStr) || idStr === zeroUuid

    if (!isValidUuid) {
      return res.status(400).json({
        ok: false,
        error: "invalid_job_id"
      })
    }

    try {
      const job = await prisma.job.findUnique({
        where: { id: idStr }
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
          error_message: (job as any).errorMessage || null,
          video_id: job.videoId,
          created_at: job.createdAt,
          started_at: (job as any).startedAt || null,
          completed_at: (job as any).completedAt || null,
          output: job.result || job.payload || {}
        }
      })
    } catch (dbError: any) {
      // Log real error server-side ONLY
      console.error(`Database error fetching job ${idStr}:`, dbError)
      return res.status(500).json({
        ok: false,
        error: "database_error"
      })
    }
  } catch (error: any) {
    console.error('Jobs handler unexpected error:', error)
    return res.status(500).json({ 
      ok: false, 
      error: "internal_server_error" 
    })
  }
}
