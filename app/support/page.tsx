'use client';

import dynamic from 'next/dynamic';
import { PageWrapper } from '@/components/routing/PageWrapper';

const Support = dynamic(() => import('@/views/Support'), { ssr: false });

export default function SupportPage() {
  return (
    <PageWrapper>
      <Support />
    </PageWrapper>
  );
}
