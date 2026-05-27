'use client';

import dynamic from 'next/dynamic';
import { PageWrapper } from '@/components/routing/PageWrapper';

const Suspended = dynamic(() => import('@/views/auth/Suspended'), { ssr: false });

export default function SuspendedPage() {
  return (
    <PageWrapper>
      <Suspended />
    </PageWrapper>
  );
}
