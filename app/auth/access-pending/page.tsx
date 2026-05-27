'use client';

import dynamic from 'next/dynamic';
import { PageWrapper } from '@/components/routing/PageWrapper';

const AccessPending = dynamic(() => import('@/views/auth/AccessPending'), { ssr: false });

export default function AccessPendingPage() {
  return (
    <PageWrapper>
      <AccessPending />
    </PageWrapper>
  );
}
