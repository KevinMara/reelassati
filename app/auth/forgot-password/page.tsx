'use client';

import dynamic from 'next/dynamic';
import { PageWrapper } from '@/components/routing/PageWrapper';

const ForgotPassword = dynamic(() => import('@/views/auth/ForgotPassword'), { ssr: false });

export default function ForgotPasswordPage() {
  return (
    <PageWrapper>
      <ForgotPassword />
    </PageWrapper>
  );
}
