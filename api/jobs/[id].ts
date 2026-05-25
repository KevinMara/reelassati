import { prisma } from '@/lib/prisma'

export default async function handler(req: any, res: any) {
  // Extract id from query (works for /api/jobs/[id].ts in Vercel/Next but we handle path manually if needed)
  // For Vercel Serverless with Vite, if the file is api/jobs/[id].ts, req.query.id should be populated
  const { id } = req.query

  if (!id) {
    return res.status(400).json({
      ok: false,
      error: "missing_job_id"
    })
  }

  // Handle special case "test"
  if (id === 'test') {
    return res.status(400).json({
      ok: false,
      error: "invalid_job_id"
    })
  }

  // UUID Regex as requested
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  const zeroUuid = "00000000-0000-0000-0000-000000000000"

  const isValidUuid = uuidRegex.test(String(id)) || id === zeroUuid

  if (!isValidUuid) {
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
    // Log the real error server-side ONLY
    console.error(`Database error fetching job ${id}:`, error)
    
    // Return a generic error to the client
    return res.status(500).json({
      ok: false,
      error: "database_error"
    })
  }
}
