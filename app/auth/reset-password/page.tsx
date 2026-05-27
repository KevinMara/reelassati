'use client';

import dynamic from 'next/dynamic';
import { PageWrapper } from '@/components/routing/PageWrapper';

const ResetPassword = dynamic(() => import('@/views/auth/ResetPassword'), { ssr: false });

export default function ResetPasswordPage() {
  return (
    <PageWrapper>
      <ResetPassword />
    </PageWrapper>
  );
}
