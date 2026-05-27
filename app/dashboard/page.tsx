'use client';

import { useEffect, useState } from 'react';
import nextDynamic from 'next/dynamic';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export const dynamic = 'force-dynamic';

const DashboardHome = nextDynamic(() => import('@/views/dashboard/DashboardHome'), { ssr: false });

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <DashboardHome />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
