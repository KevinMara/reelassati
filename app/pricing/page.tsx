'use client';

import dynamic from 'next/dynamic';
import { PageWrapper } from '@/components/routing/PageWrapper';

const Pricing = dynamic(() => import('@/views/Pricing'), { ssr: false });

export default function PricingPage() {
  return (
    <PageWrapper>
      <Pricing />
    </PageWrapper>
  );
}
