'use client';

import dynamic from 'next/dynamic';
import { NextRouteAdapter } from '@/components/routing/NextRouteAdapter';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const DashboardHome = dynamic(() => import('@/views/dashboard/DashboardHome'), { ssr: false });

export default function DashboardPage() {
  return (
    <ErrorBoundary>
      <NextRouteAdapter>
        <DashboardHome />
      </NextRouteAdapter>
    </ErrorBoundary>
  );
}
