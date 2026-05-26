import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { isAdminSession } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { id } = params;
  const idStr = String(id || '');

  // Validation
  if (!idStr) {
    return NextResponse.json({ ok: false, error: "missing_job_id" }, { status: 400 });
  }

  // Explicit check for "test" keyword from requirements
  if (idStr === 'test') {
    return NextResponse.json({ ok: false, error: "invalid_job_id" }, { status: 400 });
  }

  // UUID validation (standard UUID + zero UUID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const zeroUuid = "00000000-0000-0000-0000-000000000000";
  const isValidUuid = uuidRegex.test(idStr) || idStr === zeroUuid;

  if (!isValidUuid) {
    return NextResponse.json({ ok: false, error: "invalid_job_id" }, { status: 400 });
  }

  try {
    const job = await prisma.job.findUnique({
      where: { id: idStr }
    });

    if (!job) {
      return NextResponse.json({ ok: false, error: "job_not_found" }, { status: 404 });
    }

    return NextResponse.json({
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
    });
  } catch (dbError: any) {
    // Real error logged server-side only as requested
    console.error(`Production Database Error fetching job ${idStr}:`, dbError);
    return NextResponse.json({ ok: false, error: "database_error" }, { status: 500 });
  }
}
