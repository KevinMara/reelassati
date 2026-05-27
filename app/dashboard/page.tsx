'use client';

import nextDynamic from 'next/dynamic';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export const dynamic = 'force-dynamic';

const DashboardHome = nextDynamic(() => import('@/views/dashboard/DashboardHome'), { ssr: false });



export default function DashboardPage() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <DashboardHome />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

