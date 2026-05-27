import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { isAdminSession } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const id = params.id;
    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        video: true
      }
    });

    if (!job) {
      return NextResponse.json({ ok: false, error: 'job_not_found' }, { status: 404 });
    }

    const isAdmin = await isAdminSession();
    if (!isAdmin && job.video?.ownerUserId !== session.userId) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      ok: true,
      job: {
        id: job.id,
        status: job.status,
        jobType: job.jobType,
        result: job.result,
        createdAt: job.createdAt
      }
    });
  } catch (error: any) {
    console.error('Job fetch error:', error);
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
}
